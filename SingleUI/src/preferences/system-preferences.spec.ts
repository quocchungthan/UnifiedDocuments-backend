import { TestBed } from '@angular/core/testing';
import { resolveLocale } from '../contracts/locale';
import { SystemPreferences } from './system-preferences';

describe('system preferences', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    document.documentElement.lang = 'en';
    document.documentElement.removeAttribute('data-emfc-theme');
  });

  it('matches regional languages in preference order with an explicit English fallback', () => {
    expect(resolveLocale(['vi-VN', 'en-US'])).toBe('vi');
    expect(resolveLocale(['en-GB', 'vi'])).toBe('en');
    expect(resolveLocale(['fr-FR', 'VI-vn'])).toBe('vi');
    expect(resolveLocale(['de-DE'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });

  it('initializes the system theme and updates document language on languagechange', () => {
    const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['vi-VN']);
    document.documentElement.setAttribute('data-emfc-theme', 'dark');
    const preferences = TestBed.inject(SystemPreferences);
    expect(document.documentElement.getAttribute('data-emfc-theme')).toBe('system');
    expect(preferences.locale()).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
    languages.mockReturnValue(['en-US']);
    window.dispatchEvent(new Event('languagechange'));
    expect(preferences.locale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    TestBed.resetTestingModule();
    languages.mockReturnValue(['vi']);
    window.dispatchEvent(new Event('languagechange'));
    expect(preferences.locale()).toBe('en');
  });

  it('uses navigator.language when the preferred-language list is empty', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('vi-VN');
    expect(TestBed.inject(SystemPreferences).locale()).toBe('vi');
  });
});
