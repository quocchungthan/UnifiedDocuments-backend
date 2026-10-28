import type { Upload } from '../../contracts/lingobridge';

export type VisibilityFilter = 'all' | 'private' | 'public';

export function formatPluralCount(count: number, locale: string, singular: string, plural: string) {
  const category = new Intl.PluralRules(locale).select(count);
  const unit = category === 'one' ? singular : plural;
  return `${new Intl.NumberFormat(locale).format(count)} ${unit}`;
}

export function filterUploads(uploads: readonly Upload[], query: string, visibility: VisibilityFilter = 'all') {
  const needle = query.trim().toLocaleLowerCase();
  return uploads.filter((upload) => {
    const matchesName = !needle || upload.fileName.toLocaleLowerCase().includes(needle);
    const matchesVisibility = visibility === 'all' || upload.isPublic === (visibility === 'public');
    return matchesName && matchesVisibility;
  });
}

export function uploadCounts(uploads: readonly Upload[]) {
  const publicCount = uploads.filter((upload) => upload.isPublic).length;
  return { total: uploads.length, public: publicCount, private: uploads.length - publicCount };
}

export function jobProgress(completed: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(1, completed / total)) : 0;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit++;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
