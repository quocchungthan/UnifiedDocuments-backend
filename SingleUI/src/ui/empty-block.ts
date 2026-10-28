import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { IconNode } from 'lucide';
import { Icon } from './icon';

/** Empty, signed-out or error placeholder: icon, one-line title, short hint, optional action. */
@Component({
  selector: 'emfc-empty-block',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'empty-block', '[attr.role]': "alert() ? 'alert' : null" },
  template: `<emfc-icon [icon]="icon()" [size]="32" />
    <strong>{{ title() }}</strong>
    @if (hint()) {
      <span>{{ hint() }}</span>
    }
    <ng-content />`,
})
export class EmptyBlock {
  readonly icon = input.required<IconNode>();
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly alert = input(false);
}
