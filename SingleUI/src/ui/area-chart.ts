import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { useMessages } from '../i18n/localization';

export interface AreaSeries {
  label: string;
  values: readonly number[];
}
const messages = {
  en: { values: 'Values', explore: 'Use arrow keys to read each point.' },
  vi: { values: 'Giá trị', explore: 'Dùng phím mũi tên để đọc từng điểm.' },
} as const;
let instance = 0;
const WIDTH = 640;
const HEIGHT = 160;

/**
 * Smooth trend chart for up to two series. Series differ by stroke pattern (solid vs dashed),
 * not by colour alone; the pointer or arrow keys reveal exact values.
 */
@Component({
  selector: 'emfc-area-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<figure [attr.aria-label]="label()">
    <div class="plot" tabindex="0" role="group" [attr.aria-label]="label() + '. ' + m().explore"
      (pointermove)="point($event)" (pointerleave)="active.set(null)" (blur)="active.set(null)" (keydown)="key($event)">
      <div class="axis" aria-hidden="true">
        @for (tick of ticks(); track tick) { <span [style.bottom.%]="(tick / maximum()) * 100">{{ tick }}</span> }
      </div>
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" class="stop-strong" /><stop offset="1" class="stop-clear" />
          </linearGradient>
        </defs>
        @for (tick of ticks(); track tick) {
          <line class="grid" x1="0" [attr.x2]="width" [attr.y1]="y(tick)" [attr.y2]="y(tick)" />
        }
        @for (shape of shapes(); track shape.label; let index = $index) {
          @if (index === 0) { <path class="area" [attr.d]="shape.area" [attr.fill]="'url(#' + gradient + ')'" /> }
          <path class="line" [class.secondary]="index > 0" [attr.d]="shape.line" />
        }
        @if (active() !== null) {
          <line class="cursor" [attr.x1]="x(active()!)" [attr.x2]="x(active()!)" y1="0" [attr.y2]="height" />
        }
      </svg>
      @if (active() !== null) {
        <div class="readout" role="status" [style.left]="'clamp(72px, ' + (active()! / Math.max(1, count() - 1)) * 100 + '%, calc(100% - 64px))'">
          <strong>{{ labels()[active()!] }}</strong>
          @for (line of series(); track line.label) { <span>{{ line.label }} · {{ line.values[active()!] }}</span> }
        </div>
      }
    </div>
    <div class="dates" aria-hidden="true"><span>{{ labels()[0] }}</span><span>{{ labels().at(-1) }}</span></div>
    <figcaption class="legend">
      @for (line of series(); track line.label; let index = $index) {
        <span><svg width="24" height="8" aria-hidden="true"><line x1="0" x2="24" y1="4" y2="4" [class.secondary]="index > 0" /></svg>{{ line.label }} · {{ total(line) }}</span>
      }
    </figcaption>
  </figure>`,
  styles: `
    /* Keep labels, readout and focus ring paired with shared surfaces in both themes. */
    :host { display: block; min-width: 0; }
    figure { margin: 0; }
    .plot { position: relative; height: var(--area-chart-height, 168px); padding-left: 28px; border-radius: var(--emfc-radius-sm); outline: none; touch-action: pan-y; }
    .plot:focus-visible { box-shadow: 0 0 0 3px var(--emfc-focus); }
    .axis { position: absolute; inset: 0 auto 0 0; width: 20px; color: var(--emfc-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
    .axis span { position: absolute; right: 0; transform: translateY(50%); }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    .grid { stroke: var(--emfc-line); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .stop-strong { stop-color: var(--emfc-accent); stop-opacity: 0.32; }
    .stop-clear { stop-color: var(--emfc-accent); stop-opacity: 0; }
    .line { fill: none; stroke: var(--emfc-accent); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .line.secondary, .legend line.secondary { stroke: var(--emfc-ink); stroke-dasharray: 6 5; stroke-width: 2; }
    .legend line { stroke: var(--emfc-accent); stroke-width: 3; }
    .cursor { stroke: var(--emfc-muted); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .readout { position: absolute; top: 0; z-index: 1; display: grid; gap: 2px; min-width: 128px; padding: var(--emfc-space-2) var(--emfc-space-3);
      border: 1px solid var(--emfc-control-line); border-radius: var(--emfc-radius-sm); background: var(--emfc-surface); color: var(--emfc-ink);
      box-shadow: var(--shadow-card); font-size: 12px; font-variant-numeric: tabular-nums; transform: translateX(-50%); pointer-events: none; }
    .dates { display: flex; justify-content: space-between; margin: var(--emfc-space-2) 0 0 28px; color: var(--emfc-muted); font-size: 12px; }
    .legend { display: flex; flex-wrap: wrap; gap: var(--emfc-space-4); margin-top: var(--emfc-space-3); color: var(--emfc-ink); font-size: var(--emfc-text-sm); }
    .legend span { display: inline-flex; align-items: center; gap: var(--emfc-space-2); }
    .legend svg { width: 24px; height: 8px; }
  `,
})
export class AreaChart {
  readonly label = input.required<string>();
  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly AreaSeries[]>();
  protected readonly m = useMessages(messages);
  protected readonly Math = Math;
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly gradient = `area-chart-${++instance}`;
  protected readonly active = signal<number | null>(null);
  protected readonly count = computed(() => this.labels().length);
  protected readonly maximum = computed(() => Math.max(2, ...this.series().flatMap((line) => [...line.values])));
  protected readonly ticks = computed(() => [...new Set([0, Math.ceil(this.maximum() / 2), this.maximum()])]);
  protected x = (index: number) => (index / Math.max(1, this.count() - 1)) * WIDTH;
  protected y = (value: number) => HEIGHT - (value / this.maximum()) * (HEIGHT - 6);
  /** Monotone-ish smoothing with horizontal control points avoids overshooting below zero. */
  protected readonly shapes = computed(() =>
    this.series().map((line) => {
      const points = line.values.map((value, index) => [this.x(index), this.y(value)] as const);
      const path = points
        .map(([px, py], index) => {
          if (!index) return `M${px},${py}`;
          const [qx, qy] = points[index - 1];
          const mid = (px + qx) / 2;
          return `C${mid},${qy} ${mid},${py} ${px},${py}`;
        })
        .join(' ');
      return { label: line.label, line: path, area: `${path} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z` };
    }),
  );
  protected total = (line: AreaSeries) => line.values.reduce((sum, value) => sum + value, 0);

  protected point(event: PointerEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (event.clientX - box.left - 28) / Math.max(1, box.width - 28);
    this.active.set(Math.min(this.count() - 1, Math.max(0, Math.round(ratio * (this.count() - 1)))));
  }

  protected key(event: KeyboardEvent) {
    const last = this.count() - 1;
    const current = this.active();
    const next =
      event.key === 'ArrowRight' ? Math.min(last, (current ?? -1) + 1)
      : event.key === 'ArrowLeft' ? Math.max(0, (current ?? last + 1) - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : event.key === 'Escape' ? null
      : undefined;
    if (next === undefined) return;
    event.preventDefault();
    this.active.set(next);
  }
}
