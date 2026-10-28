import type { SupportedLocale } from '../contracts/locale';

export const entryMessages = {
  en: {
    preview: 'Entry preview',
    scopeHeading: 'Designed for',
  },
  vi: {
    preview: 'Xem trước giao diện',
    scopeHeading: 'Dành cho',
  },
} satisfies Record<SupportedLocale, Record<string, string>>;
