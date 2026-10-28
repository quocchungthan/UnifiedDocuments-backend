import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Daily integer count columns: HTML labels remain legible when the plot shrinks on mobile. */
@Component({
  selector: 'emfc-count-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<figure [attr.aria-label]="label()">
    <div class="plot">
      <div class="axis" aria-hidden="true">
        @for (tick of ticks(); track tick) {
          <span [style.bottom.%]="(tick / maximum()) * 100">{{ tick }}</span>
        }
      </div>
      <svg viewBox="0 0 640 160" preserveAspectRatio="none" aria-hidden="true">
        @for (tick of ticks(); track tick) {
          <line
            x1="0"
            x2="640"
            [attr.y1]="160 - (tick / maximum()) * 160"
            [attr.y2]="160 - (tick / maximum()) * 160"
          />
        }
        @for (bar of bars(); track $index) {
          <rect
            [attr.x]="bar.x"
            [attr.y]="bar.y"
            [attr.width]="bar.width"
            [attr.height]="bar.height"
            rx="1"
          />
        }
      </svg>
    </div>
    <div class="dates" aria-hidden="true">
      <span>{{ labels()[0] }}</span
      ><span>{{ labels().at(-1) }}</span>
    </div>
    <details>
      <summary>{{ label() }}</summary>
      <div class="values">
        @for (date of labels(); track date; let index = $index) {
          <span
            >{{ date }}: <strong>{{ values()[index] }}</strong></span
          >
        }
      </div>
    </details>
  </figure>`,
  styles: [
    `
      /* Keep integer labels and plot contrast readable in both themes; do not shrink label text with SVG. */
      :host {
        display: block;
        min-width: 0;
      }
      figure {
        margin: 12px 0 0;
      }
      .plot {
        height: 180px;
        padding-left: 32px;
        position: relative;
      }
      .axis {
        position: absolute;
        inset: 0 auto 0 0;
        width: 24px;
        color: var(--emfc-muted);
        font-size: 12px;
      }
      .axis span {
        position: absolute;
        right: 0;
        transform: translateY(50%);
      }
      svg {
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      line {
        stroke: var(--emfc-line);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      rect {
        fill: var(--emfc-accent);
      }
      .dates {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin: 12px 0 16px 32px;
        color: var(--emfc-muted);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      summary {
        cursor: pointer;
        min-height: 44px;
        display: list-item;
        padding: 12px 0;
        color: var(--emfc-ink);
        font-size: var(--emfc-text-sm);
      }
      .values {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
        padding: 12px;
        max-height: 240px;
        overflow: auto;
        background: var(--emfc-surface-alt);
        color: var(--emfc-ink);
        font-size: var(--emfc-text-sm);
      }
    `,
  ],
})
export class CountChart {
  readonly label = input.required<string>();
  readonly labels = input.required<readonly string[]>();
  readonly values = input.required<readonly number[]>();
  protected readonly maximum = computed(() => Math.max(1, ...this.values()));
  protected readonly ticks = computed(() => [
    ...new Set([0, Math.ceil(this.maximum() / 2), this.maximum()]),
  ]);
  /** Columns fill 70% of each day slot; zero days keep a hairline so gaps stay legible. */
  protected readonly bars = computed(() => {
    const values = this.values();
    const slot = 640 / Math.max(1, values.length);
    const width = Math.max(1, slot * 0.7);
    return values.map((value, index) => {
      const height = value > 0 ? (value / this.maximum()) * 160 : 0;
      return { x: index * slot + (slot - width) / 2, y: 160 - height, width, height };
    });
  });
}
