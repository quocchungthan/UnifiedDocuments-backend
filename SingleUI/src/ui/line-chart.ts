import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface LineSeries {
  label: string;
  values: readonly number[];
}
@Component({
  selector: 'emfc-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="plot" tabindex="0" role="region" [attr.aria-label]="label()">
    <svg viewBox="0 0 720 250" role="img" [attr.aria-label]="label()">
      @for (tick of ticks(); track tick.y) {
        <line x1="70" x2="700" [attr.y1]="tick.y" [attr.y2]="tick.y" />
        <text x="64" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.value }}</text>
      }
      @for (line of lines(); track line.label; let index = $index) {
        <path [attr.d]="line.path" [class.secondary]="index % 2 === 1" />
      }
      <text x="70" y="240">{{ labels()[0] }}</text>
      <text x="700" y="240" text-anchor="end">{{ labels().at(-1) }}</text>
    </svg></div>
    <div class="legend">
      @for (line of series(); track line.label; let index = $index) {
        <span><span aria-hidden="true">{{ index % 2 ? '┄' : '━' }}</span> {{ line.label }}</span>
      }
    </div>`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      /* Keep labels and focus readable against the enclosing shared surface. */
      .plot { overflow-x: auto; }
      .plot:focus-visible { outline: 3px solid var(--emfc-focus); outline-offset: 3px; }
      .legend { display: flex; flex-wrap: wrap; gap: var(--emfc-space-4); margin-top: var(--emfc-space-2); font-size: var(--emfc-text-sm); }
      svg {
        display: block;
        width: 100%;
        min-width: 720px;
      }
      path {
        fill: none;
        stroke: var(--emfc-accent);
        stroke-width: 3;
      }
      path.secondary {
        stroke: currentColor;
        stroke-dasharray: 8 5;
      }
      line {
        stroke: var(--emfc-line);
      }
      text {
        fill: var(--emfc-muted);
        font-size: 12px;
      }
    `,
  ],
})
export class LineChart {
  readonly label = input.required<string>();
  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly LineSeries[]>();
  private readonly maximum = computed(() =>
    Math.max(1, ...this.series().flatMap((series) => [...series.values])),
  );
  protected readonly ticks = computed(() =>
    [0, 1, 2, 3].map((index) => ({
      y: 210 - index * 60,
      value: Math.round((this.maximum() * index) / 3).toLocaleString(),
    })),
  );
  protected readonly lines = computed(() =>
    this.series().map((series) => ({
      label: series.label,
      path: series.values
        .map(
          (value, index, values) =>
            `${index === 0 ? 'M' : 'L'} ${70 + (index / Math.max(1, values.length - 1)) * 630} ${210 - (value / this.maximum()) * 180}`,
        )
        .join(' '),
    })),
  );
}
