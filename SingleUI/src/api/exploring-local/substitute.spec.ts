import { describe, expect, it } from 'vitest';
import { ExploringSubstitute } from './substitute';

describe('Exploring Local substitute', () => {
  const substitute = new ExploringSubstitute('default');

  it('matches districts and applies rating and review thresholds', async () => {
    const districtOne = await substitute.search({
      district: 'District 1',
      minRating: 4.6,
      minReviews: 500,
    });
    expect(districtOne.map(({ name }) => name)).toEqual(['The Coffee House Signature']);
    expect(districtOne[0].address).toContain('District 1');

    const districtTwo = await substitute.search({
      district: 'Thảo Điền, District 2',
      minRating: 4.5,
      minReviews: 500,
    });
    expect(districtTwo.map(({ name }) => name)).toEqual(['The Workshop Coffee', 'La Viet Coffee']);
    expect(districtTwo.every(({ address }) => address?.includes('District 2'))).toBe(true);
  });

  it('returns clearly contextualized samples without claiming unverified addresses', async () => {
    const results = await substitute.search({
      district: 'Uptown',
      minRating: 4.3,
      minReviews: 20,
    });
    expect(results).toHaveLength(9);
    expect(results.every(({ address }) => address === null)).toBe(true);
    expect(
      results.every(
        ({ substituteContext }) =>
          substituteContext?.district === 'Uptown' && !substituteContext.matched,
      ),
    ).toBe(true);
  });
});
