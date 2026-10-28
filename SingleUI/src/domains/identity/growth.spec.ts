import { audienceGrowth } from './growth';
import type { IdentityAudience } from '../../contracts/identity';

it('fills sparse daily observations with zeros without inventing cumulative users', () => {
  const data = {
    from: '2026-10-01',
    through: '2026-10-04',
    growth: [
      { date: '2026-10-02', users: 3 },
      { date: '2026-10-04', users: 1 },
    ],
  } as IdentityAudience;
  expect(audienceGrowth(data)).toEqual({
    labels: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
    values: [0, 3, 0, 1],
  });
});
it('handles an empty range across a UTC month boundary', () => {
  expect(
    audienceGrowth({
      from: '2026-09-30',
      through: '2026-10-01',
      growth: [],
    } as unknown as IdentityAudience).values,
  ).toEqual([0, 0]);
});
