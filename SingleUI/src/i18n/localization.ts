import { Injectable, computed, inject } from '@angular/core';
import type { SupportedLocale } from '../contracts/locale';
import { SystemPreferences } from '../preferences/system-preferences';

export type MessageCatalog<Key extends string> = Record<
  SupportedLocale,
  Readonly<Record<Key, string>>
>;

@Injectable({ providedIn: 'root' })
export class Localization {
  private readonly preferences = inject(SystemPreferences);
  messages<Key extends string>(catalog: MessageCatalog<Key>): Readonly<Record<Key, string>> {
    return catalog[this.preferences.locale()];
  }
}

export function useMessages<Key extends string>(catalog: MessageCatalog<Key>) {
  const localization = inject(Localization);
  return computed(() => localization.messages(catalog));
}
