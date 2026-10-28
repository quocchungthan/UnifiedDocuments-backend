import { describe, expect, it } from 'vitest';
import type { Entry } from '../../contracts/disklens';
import { filterEntries, formatDelta, formatSize, relativePath, reviewReason } from './analysis';

const now = Math.floor(Date.now() / 1000);
const file = (id: number, props: Partial<Entry> = {}): Entry => ({
  id, path: `C:\\Users\\Alex\\Documents\\file-${id}.bin`, name: `file-${id}.bin`,
  folder: 'C:\\Users\\Alex\\Documents', extension: '.bin', category: 'Other',
  bytes: 2_000, modified: now - 10 * 86400, buildArtifact: false, ...props,
});

describe('DiskLens analysis', () => {
  it('formats logical byte sizes and signed changes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(1024)).toBe('1 KiB');
    expect(formatDelta(1024)).toBe('+1 KiB');
    expect(formatDelta(-1024)).toBe('-1 KiB');
  });

  it('shortens paths only when they are inside the scan root', () => {
    expect(relativePath('C:\\Users\\Alex\\Documents\\reports', 'C:\\Users\\Alex\\Documents')).toBe('reports');
    expect(relativePath('C:\\Users\\Alex\\Documents', 'C:\\Users\\Alex\\Documents')).toBe('Scan root');
    expect(relativePath('D:\\external\\file.txt', 'C:\\Users\\Alex\\Documents')).toBe('D:\\external\\file.txt');
  });

  it('prioritizes review reasons in the same order as the scan service', () => {
    const started = now;
    expect(reviewReason(file(1, { buildArtifact: true, bytes: 200_000_000 }), started)).toBe('Build / cache path');
    expect(reviewReason(file(2, { modified: now - 181 * 86400 }), started)).toBe('Unchanged 180+ days');
    expect(reviewReason(file(3, { bytes: 100 * 1024 * 1024 }), started)).toBe('Large file');
    expect(reviewReason(file(4), started)).toBe('Manual review');
  });

  it('filters by review signals and sorts without mutating the input', () => {
    const entries = [file(1, { bytes: 300_000_000 }), file(2, { name: 'older.bin', modified: now - 220 * 86400 }), file(3, { category: 'Images' }), file(4, { buildArtifact: true })];
    const before = [...entries];
    expect(filterEntries(entries, 'large').map((item) => item.id)).toEqual([1]);
    expect(filterEntries(entries, 'stale').map((item) => item.id)).toEqual([2]);
    expect(filterEntries(entries, 'build').map((item) => item.id)).toEqual([4]);
    expect(filterEntries(entries, 'all', '', 'Images').map((item) => item.id)).toEqual([3]);
    expect(filterEntries(entries, 'all', '', '', 100_000).map((item) => item.id)).toEqual([1]);
    expect(filterEntries(entries, 'all', '', '', 0, 'name').map((item) => item.name)).toEqual(['file-1.bin', 'file-3.bin', 'file-4.bin', 'older.bin']);
    expect(entries).toEqual(before);
  });
});
