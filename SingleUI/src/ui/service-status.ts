import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  isDevMode,
  output,
} from '@angular/core';
import { CloudOff, FlaskConical, RefreshCw, Wifi } from 'lucide';
import type { ServiceSource } from '../api/substitution/source';
import { useMessages } from '../i18n/localization';
import { Action } from './action';
import { Icon } from './icon';

const messages = {
  en: {
    live: 'Live service',
    selected: 'Substitute data · stays in this browser',
    unavailable: 'Service unreachable · substitute data',
    tryLive: 'Try live service',
    useSubstitute: 'Use substitute data',
    preview: 'Preview data · service unavailable',
  },
  vi: {
    live: 'Dịch vụ trực tiếp',
    selected: 'Dữ liệu thay thế · chỉ trong trình duyệt này',
    unavailable: 'Không kết nối được dịch vụ · dữ liệu thay thế',
    tryLive: 'Thử dịch vụ trực tiếp',
    useSubstitute: 'Dùng dữ liệu thay thế',
    preview: 'Dữ liệu minh họa · dịch vụ không khả dụng',
  },
};

/** Source controls are diagnostics; an unavailable production service still needs a truthful warning. */
@Component({
  selector: 'emfc-service-status',
  imports: [Action, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (diagnostics) {
      <div class="service-status" [attr.data-mode]="source().mode()">
        <span class="service-status__badge" role="status" [attr.title]="source().detail() || null">
          <emfc-icon [icon]="glyph()" [size]="16" [class.spin]="busy()" />
          {{ label() }}
        </span>
        @if (source().mode() === 'substitute') {
          <emfc-action
            [secondary]="true"
            [icon]="RefreshCw"
            [disabled]="busy()"
            [busy]="busy()"
            (activate)="useLive.emit()"
            >{{ copy().tryLive }}</emfc-action
          >
        } @else {
          <emfc-action [secondary]="true" [icon]="FlaskConical" (activate)="useSubstitute.emit()">{{
            copy().useSubstitute
          }}</emfc-action>
        }
      </div>
    } @else if (source().mode() === 'substitute') {
      <span class="service-status__badge" role="status">{{ copy().preview }}</span>
    }`,
  styles: [
    `
      .service-status {
        display: flex;
        flex-wrap: wrap;
        gap: var(--emfc-space-3, 12px);
        align-items: center;
        font-size: var(--emfc-text-sm);
      }
      :host:empty {
        display: none;
      }
      .service-status__badge {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        min-height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        background: var(--emfc-accent-soft);
        color: var(--emfc-on-accent-soft);
        font-weight: 600;
      }
      [data-mode='live'] .service-status__badge {
        background: var(--emfc-surface-alt);
        color: var(--emfc-ink);
      }
    `,
  ],
})
export class ServiceStatus {
  protected readonly diagnostics =
    isDevMode() || new URLSearchParams(inject(DOCUMENT).location?.search ?? '').has('api');
  readonly source = input.required<ServiceSource<unknown>>();
  readonly busy = input(false);
  readonly useLive = output<void>();
  readonly useSubstitute = output<void>();
  protected readonly copy = useMessages(messages);
  protected readonly RefreshCw = RefreshCw;
  protected readonly FlaskConical = FlaskConical;
  protected readonly glyph = computed(() =>
    this.source().mode() === 'live'
      ? Wifi
      : this.source().reason() === 'unavailable'
        ? CloudOff
        : FlaskConical,
  );
  protected readonly label = computed(() => {
    const source = this.source();
    if (source.mode() === 'live') return this.copy().live;
    return source.reason() === 'unavailable' ? this.copy().unavailable : this.copy().selected;
  });
}
