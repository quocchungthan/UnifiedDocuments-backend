import { bandwidthDays, summarize } from './usage';
describe('Farm measured traffic and demo analytics', () => {
  it('fills missing UTC days without changing reported bytes across a month boundary', () => {
    expect(
      bandwidthDays(
        [{ date: '2026-03-01', readBytes: 10, writeBytes: 20 }],
        3,
        new Date('2026-03-02T00:30:00Z'),
      ),
    ).toEqual([
      { date: '2026-02-28', readBytes: 0, writeBytes: 0 },
      { date: '2026-03-01', readBytes: 10, writeBytes: 20 },
      { date: '2026-03-02', readBytes: 0, writeBytes: 0 },
    ]);
    expect(summarize([]).costPerTask).toBe(0);
    expect(
      summarize([
        {
          id: 'task',
          date: '2026-03-01',
          name: 'Demo',
          model: 'Demo',
          inputTokens: 2,
          outputTokens: 3,
          inputBytes: 10,
          outputBytes: 20,
          durationSeconds: 90,
          costUsd: 1,
          feeUsd: 0.2,
          baselineCostUsd: 3,
        },
      ]).savings,
    ).toBe(1.8);
  });
});
