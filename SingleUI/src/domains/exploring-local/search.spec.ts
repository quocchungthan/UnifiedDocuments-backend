import { describe, expect, it } from 'vitest';
import { normalizeSearch, searchLabel, searchParams } from './search';

const district = { district: 'Thảo Điền, District 2', minRating: 4.3, minReviews: 20 };

describe('Exploring Local search rules', () => {
  it('normalizes district input and sends the original rating thresholds', () => {
    const params = searchParams({ ...district, district: '  Thảo Điền\nDistrict 2  ' });
    expect(params.get('district')).toBe('Thảo Điền District 2');
    expect(params.get('minRating')).toBe('4.3');
    expect(params.get('minReviews')).toBe('20');
  });

  it('uses coordinates when searching nearby and retains a readable history label', () => {
    const near = {
      district: '',
      latitude: 10.801,
      longitude: 106.731,
      minRating: 4.5,
      minReviews: 15,
    };
    const params = searchParams(near);
    expect(params.get('lat')).toBe('10.801');
    expect(params.get('lng')).toBe('106.731');
    expect(searchLabel(near)).toBe('10.801, 106.731');
  });

  it('rejects unsafe, overlong and incomplete location input', () => {
    expect(() => normalizeSearch({ ...district, district: 'x'.repeat(81) })).toThrow(
      'district-too-long',
    );
    expect(() => normalizeSearch({ ...district, district: '' })).toThrow('location-required');
    expect(() =>
      normalizeSearch({ ...district, district: '', latitude: 10, longitude: undefined }),
    ).toThrow('coordinates-incomplete');
    expect(normalizeSearch({ ...district, district: '<prompt>' }).district).toBe('prompt');
  });
});
