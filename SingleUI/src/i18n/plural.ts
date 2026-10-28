import { computed, inject } from '@angular/core';
import { SystemPreferences } from '../preferences/system-preferences';

/** Picks the singular or plural template by the locale's plural rules and fills `{count}`. */
export function pluralLabel(rules: Intl.PluralRules, count: number, one: string, other: string) {
  return (rules.select(count) === 'one' ? one : other).replace(/\{count\}/g, String(count));
}

/** Locale-following count label for templates, e.g. plural(1, m().session, m().sessions). */
export function usePlural() {
  const preferences = inject(SystemPreferences);
  const rules = computed(() => new Intl.PluralRules(preferences.locale()));
  return (count: number, one: string, other: string) => pluralLabel(rules(), count, one, other);
}
