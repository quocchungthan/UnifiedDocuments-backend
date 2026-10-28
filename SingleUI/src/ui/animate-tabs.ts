import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * Animate UI (`animate-ui.com`)-inspired shared-layout sliding tab & navigation indicator.
 * Tracks active (`aria-current` / `aria-pressed`) and hovered buttons via CSS custom properties
 * so spring-physics pseudo-elements glide smoothly without mutating button contrast or DOM structure.
 */
@Directive({
  selector: '[emfcAnimateTabs]',
  host: {
    class: 'animate-tabs',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerleave)': 'onPointerLeave()',
    '(click)': 'scheduleSync()',
  },
})
export class AnimateTabs {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private frame = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.syncActive();
      const mutationObserver = new MutationObserver(() => this.scheduleSync());
      mutationObserver.observe(this.host, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-current', 'aria-pressed', 'class'],
      });
      const resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => this.scheduleSync())
          : null;
      resizeObserver?.observe(this.host);
      destroyRef.onDestroy(() => {
        if (this.frame) cancelAnimationFrame(this.frame);
        mutationObserver.disconnect();
        resizeObserver?.disconnect();
      });
    });
  }

  protected onPointerMove(event: PointerEvent) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const target = event.target instanceof Element ? event.target.closest('button, a') : null;
    if (!(target instanceof HTMLElement) || !this.host.contains(target)) {
      this.onPointerLeave();
      return;
    }
    this.host.style.setProperty('--aui-hover-x', `${target.offsetLeft}px`);
    this.host.style.setProperty('--aui-hover-y', `${target.offsetTop}px`);
    this.host.style.setProperty('--aui-hover-w', `${target.offsetWidth}px`);
    this.host.style.setProperty('--aui-hover-h', `${target.offsetHeight}px`);
    this.host.style.setProperty('--aui-hover-o', '1');
  }

  protected onPointerLeave() {
    this.host.style.setProperty('--aui-hover-o', '0');
  }

  protected scheduleSync() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.syncActive();
    });
  }

  private syncActive() {
    const active = this.host.querySelector<HTMLElement>(
      '[aria-current="page"], [aria-current="true"], [aria-pressed="true"]',
    );
    if (!active) {
      this.host.style.setProperty('--aui-active-o', '0');
      return;
    }
    this.host.style.setProperty('--aui-active-x', `${active.offsetLeft}px`);
    this.host.style.setProperty('--aui-active-y', `${active.offsetTop}px`);
    this.host.style.setProperty('--aui-active-w', `${active.offsetWidth}px`);
    this.host.style.setProperty('--aui-active-h', `${active.offsetHeight}px`);
    this.host.style.setProperty('--aui-active-o', '1');
    this.host.setAttribute('data-aui-tabs', 'ready');
  }
}
