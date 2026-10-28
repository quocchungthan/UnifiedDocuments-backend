import { Directive, ElementRef, inject } from '@angular/core';

/**
 * In-page link that moves focus to its `#target` without navigating. With
 * `<base href="/">` a plain `#id` link resolves to `/#id`, dropping the query string
 * (and with it `?api=` selections) and reloading the app.
 */
@Directive({
  selector: 'a[emfcSkipLink]',
  host: { '(click)': 'skip($event)' },
})
export class SkipLink {
  private readonly anchor = inject<ElementRef<HTMLAnchorElement>>(ElementRef);

  protected skip(event: MouseEvent) {
    const id = this.anchor.nativeElement.getAttribute('href')?.replace(/^#/, '');
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus();
  }
}
