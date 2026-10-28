export const supportedLocales = ['en', 'vi'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export function resolveLocale(languages: readonly string[]): SupportedLocale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'en' || base === 'vi') {
      return base;
    }
  }
  return 'en';
}
