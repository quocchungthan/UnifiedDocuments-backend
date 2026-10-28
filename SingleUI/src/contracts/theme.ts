export const themePreferences = ['system', 'light', 'dark'] as const;

export type ThemePreference = (typeof themePreferences)[number];

export function parseThemePreference(value: unknown): ThemePreference {
  if (value === 'system' || value === 'light' || value === 'dark') {
    return value;
  }
  throw new TypeError('Theme must be system, light, or dark.');
}
