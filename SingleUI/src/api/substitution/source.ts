import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject, signal } from '@angular/core';
import {
  defaultSelection,
  parseSourceSelection,
  type SourceMode,
  type SourceScenario,
  type SourceSelection,
  type SubstituteReason,
} from '../../contracts/service-source';
import { ServiceRequestError, ServiceUnavailableError, type ServiceName } from '../http/request';

export const SOURCE_SELECTION = new InjectionToken<SourceSelection>('SOURCE_SELECTION', {
  providedIn: 'root',
  factory: () => {
    try {
      return parseSourceSelection(inject(DOCUMENT).location?.search ?? '');
    } catch (error) {
      console.error(error);
      return defaultSelection;
    }
  },
});

export interface CallOptions {
  /**
   * Commands (sending, creating, revoking) never fall back automatically: doing so
   * would present local work as server work. They use the substitute only once the
   * source already shows substitute mode.
   */
  command?: boolean;
}

/**
 * One capability's live client and its substitute behind the same interface `T`.
 * Read-only state shows which one answered so the UI can label it truthfully.
 */
export class ServiceSource<T> {
  private readonly modeState: ReturnType<typeof signal<SourceMode>>;
  private readonly reasonState = signal<SubstituteReason | null>(null);
  private readonly detailState = signal('');
  readonly mode;
  readonly reason = this.reasonState.asReadonly();
  /** Why live failed, when the substitute stands in for an unavailable service. */
  readonly detail = this.detailState.asReadonly();
  readonly scenario: SourceScenario;

  constructor(
    readonly service: ServiceName,
    private readonly live: T,
    private readonly substitute: T,
    private readonly selection: SourceSelection,
  ) {
    const substituted = selection.policy === 'substitute';
    this.modeState = signal<SourceMode>(substituted ? 'substitute' : 'live');
    this.mode = this.modeState.asReadonly();
    if (substituted) this.reasonState.set('selected');
    this.scenario = selection.scenario;
  }

  async call<R>(operation: (api: T) => Promise<R>, options: CallOptions = {}): Promise<R> {
    if (this.modeState() === 'substitute') return operation(this.substitute);
    try {
      return await operation(this.live);
    } catch (error) {
      if (
        error instanceof ServiceUnavailableError &&
        error.service === this.service &&
        this.selection.policy === 'auto' &&
        !options.command
      ) {
        // A concurrent read may already have switched; still answer from the substitute.
        if (this.modeState() === 'live') {
          this.modeState.set('substitute');
          this.reasonState.set('unavailable');
          this.detailState.set(error.message);
        }
        return operation(this.substitute);
      }
      throw error;
    }
  }

  /** User choice; the caller reloads its data afterwards. */
  useSubstitute() {
    this.modeState.set('substitute');
    this.reasonState.set('selected');
    this.detailState.set('');
  }

  useLive() {
    this.modeState.set('live');
    this.reasonState.set(null);
    this.detailState.set('');
  }
}

export function serviceSource<T>(service: ServiceName, live: T, substitute: T) {
  return new ServiceSource(service, live, substitute, inject(SOURCE_SELECTION));
}

/**
 * Shape a substitute answer for the selected scenario. `loading` never settles and
 * `failure` rejects as a server error, so error and loading screens can be shown.
 */
export function scenarioResult<R>(
  service: ServiceName,
  scenario: SourceScenario,
  variants: { default: () => R } & Partial<Record<'signed-out' | 'empty', () => R>>,
): Promise<R> {
  if (scenario === 'loading') return new Promise<R>(() => undefined);
  if (scenario === 'failure')
    return Promise.reject(new ServiceRequestError(service, 500, 'substitute failure scenario'));
  return Promise.resolve((variants[scenario] ?? variants.default)());
}
