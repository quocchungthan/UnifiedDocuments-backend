import type { Inspection, Snapshot } from '../../contracts/bridge';
import type { SourceScenario } from '../../contracts/service-source';
import { demoSnapshot } from '../../domains/bridge/demo';
import { scenarioResult } from '../substitution/source';
import type { BridgeApi } from './client';

function emptySnapshot(): Snapshot {
  return {
    now: new Date().toISOString(),
    roles: [],
    sessions: [],
    delegations: [],
    humanQueue: [],
    assignments: [],
    log: [],
  };
}

/** Local PARA examples only. Replies update this in-memory sample and never reach Bridge. */
export class BridgeSubstitute implements BridgeApi {
  private data = demoSnapshot();
  constructor(private readonly scenario: SourceScenario) {}

  snapshot(): Promise<Snapshot> {
    return scenarioResult<Snapshot>('bridge', this.scenario, {
      default: () => this.data,
      empty: emptySnapshot,
    });
  }

  inspect(id: string): Promise<Inspection> {
    return scenarioResult<Inspection>('bridge', this.scenario, {
      default: () => ({
        sessionId: id,
        available: true,
        diagnosis: 'Local substitute · no real agent log is inspected.',
        recent: [],
      }),
      empty: () => ({ sessionId: id, available: false, diagnosis: 'No local sessions to inspect.', recent: [] }),
    });
  }

  async reply(id: string, message: string): Promise<void> {
    if (!message.trim()) throw new Error('Enter a response before sending.');
    await scenarioResult('bridge', this.scenario, {
      default: () => {
        if (!this.data.sessions.some((session) => session.sessionId === id))
          throw new Error('Unknown local session.');
        this.data = {
          ...this.data,
          sessions: this.data.sessions.map((session) =>
            session.sessionId === id
              ? {
                  ...session,
                  state: 'working',
                  question: undefined,
                  needs: [],
                  progress: [
                    ...session.progress,
                    { ts: new Date().toISOString(), note: `Local reply: ${message}` },
                  ],
                }
              : session,
          ),
          log: [...this.data.log, `Local reply recorded for ${id}. No real agent received it.`],
        };
      },
    });
  }
}
