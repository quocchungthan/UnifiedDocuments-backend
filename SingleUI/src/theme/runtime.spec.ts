import { parseThemePreference } from '../contracts/theme';
import { getTheme, setTheme } from './runtime';

describe('portable theme contract', () => {
  it('defaults to system without changing the host document', () => {
    const root = document.createElement('section');
    expect(getTheme(root)).toBe('system');
    expect(root.hasAttribute('data-emfc-theme')).toBe(false);
  });

  it('sets explicit overrides and returns to system on the supplied root only', () => {
    const root = document.createElement('section');
    const sibling = document.createElement('section');
    for (const preference of ['dark', 'light', 'system'] as const) {
      setTheme(root, preference);
      expect(getTheme(root)).toBe(preference);
      expect(root.getAttribute('data-emfc-theme')).toBe(preference);
    }
    expect(sibling.hasAttribute('data-emfc-theme')).toBe(false);
  });

  it('rejects invalid configuration instead of silently changing theme', () => {
    for (const value of ['', 'auto', null, undefined, 1]) {
      expect(() => parseThemePreference(value)).toThrow('Theme must be system, light, or dark.');
    }
    const root = document.createElement('section');
    root.setAttribute('data-emfc-theme', 'unknown');
    expect(() => getTheme(root)).toThrow(TypeError);
  });
});
