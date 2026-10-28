import type { Entry } from '../../contracts/disklens';

export type ReviewKind = 'all' | 'review' | 'large' | 'stale' | 'build';
export type SortKind = 'size' | 'oldest' | 'name';
export const LARGE_FILE_BYTES = 100 * 1024 * 1024;
export const STALE_DAYS = 180;

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return '--';
  if (!bytes) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const exponent = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toLocaleString(undefined, { maximumFractionDigits: exponent ? 1 : 0 })} ${units[exponent]}`;
}

export function formatCount(value: number): string {
  return value.toLocaleString();
}

export function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString();
}

export function formatDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${formatSize(value)}`;
}

export function relativePath(path: string, root: string): string {
  if (path.toLowerCase() === root.toLowerCase()) return 'Scan root';
  const prefix = /[\\/]$/.test(root) ? root : `${root}\\`;
  return path.toLowerCase().startsWith(prefix.toLowerCase()) ? path.slice(prefix.length) : path;
}

export function reviewReason(entry: Entry, started: number): string {
  if (entry.buildArtifact) return 'Build / cache path';
  if (entry.modified < started - STALE_DAYS * 86400) return 'Unchanged 180+ days';
  if (entry.bytes >= LARGE_FILE_BYTES) return 'Large file';
  return 'Manual review';
}

export function filterEntries(entries: Entry[], kind: ReviewKind, search = '', category = '', minBytes = 0, sort: SortKind = 'size') {
  const query = search.toLowerCase();
  const filtered = entries.filter((entry) => {
    const stale = entry.modified < Date.now() / 1000 - STALE_DAYS * 86400;
    const review = entry.buildArtifact || stale || entry.bytes >= LARGE_FILE_BYTES;
    return entry.bytes >= minBytes && (!query || entry.path.toLowerCase().includes(query)) &&
      (!category || entry.category === category) &&
      (kind === 'all' || (kind === 'review' ? review : kind === 'large' ? entry.bytes >= LARGE_FILE_BYTES : kind === 'stale' ? stale : entry.buildArtifact));
  });
  return filtered.sort((a, b) => sort === 'oldest' ? a.modified - b.modified : sort === 'name' ? a.name.localeCompare(b.name) : b.bytes - a.bytes);
}
