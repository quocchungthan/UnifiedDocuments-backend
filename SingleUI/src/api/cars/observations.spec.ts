import { afterEach, describe, expect, it, vi } from 'vitest';
import { Observations } from './observations';

describe('local observation persistence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('reports malformed stored records instead of accepting them', () => {
    localStorage.setItem(
      'emfc.30s.observations',
      JSON.stringify([{ id: 'broken', text: 'Missing car and date' }]),
    );
    const observations = new Observations();
    expect(observations.error()).toContain('Could not load observations');
    expect(observations.records()).toEqual([]);
  });

  it('preserves the last persisted records when a write fails', () => {
    const observations = new Observations();
    observations.add('raize', 'First observation');
    const stored = localStorage.getItem('emfc.30s.observations');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    observations.add('raize', 'Must not be reported as saved');
    expect(observations.records().map((record) => record.text)).toEqual(['First observation']);
    expect(localStorage.getItem('emfc.30s.observations')).toBe(stored);
    expect(observations.error()).toContain('quota exceeded');
  });
});
