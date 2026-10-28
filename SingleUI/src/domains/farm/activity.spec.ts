import { activityDays, activitySummary } from './activity';

it('retains yesterday streak until today ends, without mixing source visits', () => {
  const days = activityDays(
    [
      { platform: 'GitHub', day: '2026-10-20', count: 2 },
      { platform: 'GitHub', day: '2026-10-21', count: 1 },
      { platform: 'Other', day: '2026-10-22', count: 4 },
    ],
    new Date('2026-10-22T15:00:00Z'),
    4,
    'GitHub',
  );
  expect(days.map((day) => day.count)).toEqual([0, 2, 1, 0]);
  expect(activitySummary(days)).toEqual({ current: 2, best: 2, active: 2 });
});
