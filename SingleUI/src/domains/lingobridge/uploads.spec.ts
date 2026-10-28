import { describe, expect, it } from 'vitest';
import type { Upload } from '../../contracts/lingobridge';
import { filterUploads, formatBytes, formatPluralCount, jobProgress, uploadCounts } from './uploads';

const records: Upload[] = [
  { id: '1', hash: 'a', fileName: 'Guide.pdf', sourceLanguage: 'en', targetLanguage: 'vi', isPublic: true, createdAtUtc: '2026-10-01T00:00:00Z' },
  { id: '2', hash: 'b', fileName: 'Notes.pdf', sourceLanguage: 'en', targetLanguage: 'vi', isPublic: false, createdAtUtc: '2026-10-02T00:00:00Z' },
];

describe('LingoBridge upload domain', () => {
  it('filters by trimmed case-insensitive name and visibility together', () => {
    expect(filterUploads(records, ' guide ', 'public').map((item) => item.id)).toEqual(['1']);
    expect(filterUploads(records, 'guide', 'private')).toEqual([]);
  });
  it('summarizes visibility and clamps incomplete progress safely', () => {
    expect(uploadCounts(records)).toEqual({ total: 2, public: 1, private: 1 });
    expect(jobProgress(8, 4)).toBe(1);
    expect(jobProgress(1, 0)).toBe(0);
  });
  it('formats document counts with the locale plural category', () => {
    expect(formatPluralCount(1, 'en', 'document', 'documents')).toBe('1 document');
    expect(formatPluralCount(2, 'en', 'document', 'documents')).toBe('2 documents');
    expect(formatPluralCount(2, 'vi', 'tài liệu', 'tài liệu')).toBe('2 tài liệu');
  });
  it('formats byte sizes without non-finite output', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});
