import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'emfc-heat-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="heat-strip" role="img" [attr.aria-label]="label()">
    @for (day of days(); track day.date) {
      <i
        [attr.data-level]="
          day.count === 0 ? 0 : day.count <= 1 ? 1 : day.count <= 3 ? 2 : day.count <= 6 ? 3 : 4
        "
        [title]="day.date + ': ' + day.count"
      ></i>
    }
  </span>`,
  styles: [
    `
      .heat-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
      }
      i {
        display: block;
        width: 9px;
        height: 9px;
        border-radius: 2px;
        background: var(--emfc-surface-alt);
        border: 1px solid var(--emfc-line);
      }
      i[data-level='1'] {
        background: color-mix(in srgb, var(--emfc-accent) 25%, var(--emfc-surface));
      }
      i[data-level='2'] {
        background: color-mix(in srgb, var(--emfc-accent) 50%, var(--emfc-surface));
      }
      i[data-level='3'] {
        background: color-mix(in srgb, var(--emfc-accent) 75%, var(--emfc-surface));
      }
      i[data-level='4'] {
        background: var(--emfc-accent);
      }
    `,
  ],
})
export class HeatStrip {
  readonly days = input.required<readonly { date: string; count: number }[]>();
  readonly label = input.required<string>();
}
