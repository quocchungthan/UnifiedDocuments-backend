import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { IconNode } from 'lucide';
import { Icon } from './icon';

@Component({
  selector: 'emfc-action',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    class="button"
    [class.button--secondary]="secondary()"
    [type]="type()"
    [disabled]="disabled()"
    [attr.aria-busy]="busy() || null"
    (click)="activate.emit()"
  >
    @if (icon(); as glyph) {
      <emfc-icon [icon]="glyph" [size]="16" />
    }
    <ng-content />
  </button>`,
})
export class Action {
  readonly secondary = input(false);
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly icon = input<IconNode | null>(null);
  readonly type = input<'button' | 'submit'>('button');
  readonly activate = output<void>();
}
