import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject } from '@angular/core';
import { SystemPreferences } from './system-preferences';

export function productDocument(app: string, title: string | (() => string)) {
  const document = inject(DOCUMENT);
  const preferences = inject(SystemPreferences);
  document.documentElement.dataset['emfcApp'] = app;
  effect(() => {
    preferences.locale();
    document.title = typeof title === 'function' ? title() : title;
  });
  inject(DestroyRef).onDestroy(() => {
    delete document.documentElement.dataset['emfcApp'];
  });
}
