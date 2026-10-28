import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

/**
 * Collapses an open popup: emits when the pointer goes down outside the host (and outside
 * `emfcDismissIgnore`, normally the toggle button that reopens it) or when Escape is pressed.
 * Place it on the element rendered only while the popup is open.
 */
@Directive({ selector: '[emfcDismiss]' })
export class Dismiss {
  readonly emfcDismissIgnore = input<readonly (Element | null | undefined)[]>([]);
  readonly emfcDismiss = output<void>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const pointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || host.contains(target)) return;
      if (this.emfcDismissIgnore().some((element) => element?.contains(target))) return;
      this.emfcDismiss.emit();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.emfcDismiss.emit();
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', key);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', key);
    });
  }
}
