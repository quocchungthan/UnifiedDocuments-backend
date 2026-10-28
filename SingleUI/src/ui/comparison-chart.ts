import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'emfc-comparison-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 720 230" role="img" [attr.aria-label]="label()">
      @for (bar of bars(); track $index) {
        <rect
          class="reference"
          [attr.x]="bar.x"
          [attr.y]="200 - bar.reference"
          [attr.width]="bar.width"
          [attr.height]="bar.reference"
        />
        <rect
          class="actual"
          [attr.x]="bar.x + 2"
          [attr.y]="200 - bar.actual"
          [attr.width]="bar.width - 4"
          [attr.height]="bar.actual"
        />
      }
      <text x="10" y="225">{{ labels()[0] }}</text>
      <text x="710" y="225" text-anchor="end">{{ labels().at(-1) }}</text>
    </svg>
    <p>{{ legend() }}</p>`,
  styles: [
    `
      :host {
        display: block;
      }
      svg {
        width: 100%;
        max-height: 300px;
      }
      .reference {
        fill: none;
        stroke: var(--emfc-accent);
        stroke-width: 1.5;
      }
      .actual {
        fill: var(--emfc-accent);
      }
      text {
        fill: currentColor;
        font-size: 12px;
      }
    `,
  ],
})
export class ComparisonChart {
  readonly label = input.required<string>();
  readonly legend = input.required<string>();
  readonly labels = input.required<readonly string[]>();
  readonly actual = input.required<readonly number[]>();
  readonly reference = input.required<readonly number[]>();
  protected readonly bars = computed(() => {
    const max = Math.max(0.01, ...this.actual(), ...this.reference()),
      width = 700 / Math.max(1, this.labels().length);
    return this.labels().map((_, index) => ({
      x: 10 + index * width,
      width: Math.max(5, width - 2),
      actual: ((this.actual()[index] ?? 0) / max) * 190,
      reference: ((this.reference()[index] ?? 0) / max) * 190,
    }));
  });
}
