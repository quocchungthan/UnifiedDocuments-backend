import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'emfc-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section
    class="stack"
    [class.panel]="!flat()"
    [class.card]="!flat()"
    [attr.aria-label]="heading()"
  >
    @if (heading()) {
      <header class="panel-heading">
        <h2>{{ heading() }}</h2>
        <ng-content select="[panel-actions]" />
      </header>
    }
    <ng-content />
  </section>`,
})
export class Panel {
  readonly heading = input('');
  readonly flat = input(false);
}
