import type { SupportedLocale } from './locale';

export interface EntryMessages {
  title: string;
  heading: string;
  introduction: string;
  emptyHeading: string;
  emptyDescription: string;
  areas: readonly [string, string];
}

export type EntryCatalog = Readonly<Record<SupportedLocale, Readonly<EntryMessages>>>;
