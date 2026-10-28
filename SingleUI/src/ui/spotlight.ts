import { Directive, ElementRef, inject } from '@angular/core';

/** Decorative pointer-following tint; one style write per animation frame. */
@Directive({
  selector: '[emfcSpotlight]',
  host: { class: 'spotlight', '(pointermove)': 'move($event)' },
})
export class Spotlight {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private frame = 0;

  protected move(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const box = this.host.getBoundingClientRect();
      this.host.style.setProperty('--spot-x', `${event.clientX - box.left}px`);
      this.host.style.setProperty('--spot-y', `${event.clientY - box.top}px`);
    });
  }
}
