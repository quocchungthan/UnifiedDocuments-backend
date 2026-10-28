import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { resolveLocale } from '../contracts/locale';
import { setTheme } from '../theme/runtime';

@Injectable({ providedIn: 'root' })
export class SystemPreferences {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly selectedLocale = signal(this.readLocale());
  readonly locale = this.selectedLocale.asReadonly();

  constructor() {
    setTheme(this.document.documentElement, 'system');
    this.document.documentElement.lang = this.locale();
    const update = () => {
      this.selectedLocale.set(this.readLocale());
      this.document.documentElement.lang = this.locale();
    };
    this.window?.addEventListener('languagechange', update);
    const scheme = this.window?.matchMedia?.('(prefers-color-scheme: dark)');
    const paint = () => this.paintThemeColor();
    paint();
    scheme?.addEventListener('change', paint);
    inject(DestroyRef).onDestroy(() => {
      this.window?.removeEventListener('languagechange', update);
      scheme?.removeEventListener('change', paint);
    });
  }

  /** Browser chrome follows the generated palette canvas role; no hex duplicated here. */
  private paintThemeColor() {
    const meta = this.document.querySelector('meta[name="theme-color"]');
    const canvas = this.window
      ?.getComputedStyle(this.document.documentElement)
      .getPropertyValue('--color-canvas')
      .trim();
    if (meta && canvas) meta.setAttribute('content', canvas);
  }

  private readLocale() {
    const navigator = this.window?.navigator;
    return resolveLocale(
      navigator?.languages.length ? navigator.languages : navigator ? [navigator.language] : [],
    );
  }
}
