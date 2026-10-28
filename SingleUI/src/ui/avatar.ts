import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Picture when available, otherwise initials; decorative next to a visible name. */
@Component({
  selector: 'emfc-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'avatar', 'aria-hidden': 'true', '[style.--avatar-size]': "size() + 'px'" },
  template: `@if (picture()) {
      <img [src]="picture()" alt="" referrerpolicy="no-referrer" />
    } @else {
      {{ initials() }}
    }`,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly picture = input<string | null>(null);
  readonly size = input(32);
  protected readonly initials = computed(() =>
    this.name()
      .split(/[\s._@-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join(''),
  );
}
