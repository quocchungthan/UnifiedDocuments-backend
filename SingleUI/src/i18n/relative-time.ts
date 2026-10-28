import { computed, inject } from '@angular/core';
import { SystemPreferences } from '../preferences/system-preferences';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** Elapsed time from an ISO timestamp or epoch milliseconds, e.g. "now", "5 min. ago"; empty when unknown. */
export function relativeTime(format: Intl.RelativeTimeFormat, iso: string | number | null | undefined, nowMs: number) {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.max(0, Math.round((nowMs - time) / 1000));
  if (seconds < 10) return format.format(0, 'second');
  const [unit, size] = UNITS.find(([, size]) => seconds >= size)!;
  return format.format(-Math.floor(seconds / size), unit);
}

/** Locale-following relative time formatter for templates. */
export function useRelativeTime() {
  const preferences = inject(SystemPreferences);
  const format = computed(() => new Intl.RelativeTimeFormat(preferences.locale(), { numeric: 'auto', style: 'short' }));
  return (iso: string | number | null | undefined, nowMs: number) => relativeTime(format(), iso, nowMs);
}
