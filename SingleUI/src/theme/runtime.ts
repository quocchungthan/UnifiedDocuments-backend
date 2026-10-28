import { parseThemePreference, type ThemePreference } from '../contracts/theme.js';

export function getTheme(root: HTMLElement): ThemePreference {
  return parseThemePreference(root.getAttribute('data-emfc-theme') ?? 'system');
}

export function setTheme(root: HTMLElement, preference: ThemePreference): void {
  root.setAttribute('data-emfc-theme', parseThemePreference(preference));
}
