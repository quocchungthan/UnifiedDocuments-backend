import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { IconNode } from 'lucide';
import { Icon } from './icon';

/** Compact figure with icon; wrap several in `.metrics`. */
@Component({
  selector: 'emfc-metric',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'metric' },
  template: `<span class="metric__icon"><emfc-icon [icon]="icon()" [size]="20" /></span>
    <span class="metric__value">{{ value() }}</span>
    <span class="metric__label">{{ label() }}</span>
    @if (hint()) {
      <span class="metric__hint">{{ hint() }}</span>
    }`,
})
export class Metric {
  readonly icon = input.required<IconNode>();
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  /** Short qualifier under the label, e.g. the period the figure covers. */
  readonly hint = input('');
}
