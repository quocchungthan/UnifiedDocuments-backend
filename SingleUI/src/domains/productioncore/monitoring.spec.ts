import { groupTargets, hasStaleChecks, isCheckStale, summarizeHealth } from './monitoring';
import type { ServiceTarget } from '../../contracts/productioncore';

const target = (id: string, name: string, group: string, up = true): ServiceTarget => ({
  id,
  name,
  group,
  kind: 'http',
  up,
  latencyMs: 12,
  error: null,
  checkedAt: '2026-10-22T10:00:00Z',
});

describe('ProductionCore monitoring domain', () => {
  it('groups and sorts targets without changing their status', () => {
    const result = groupTargets([
      target('b', 'Worker', 'Runtime'),
      target('a', 'Database', 'Data', false),
      target('c', 'API', 'Runtime'),
    ]);
    expect(result.map(({ name, targets }) => [name, targets.map(({ name }) => name)])).toEqual([
      ['Data', ['Database']],
      ['Runtime', ['API', 'Worker']],
    ]);
    expect(result[0].targets[0].up).toBe(false);
  });

  it('detects stale checks without treating an empty list as stale', () => {
    const now = Date.parse('2026-10-22T10:00:20Z');
    expect(hasStaleChecks([], now)).toBe(false);
    const fresh = { ...target('fresh', 'API', 'Runtime'), checkedAt: '2026-10-22T10:00:10Z' };
    expect(hasStaleChecks([fresh], now)).toBe(false);
    expect(isCheckStale(fresh, now)).toBe(false);
    expect(
      hasStaleChecks(
        [{ ...target('old', 'API', 'Runtime'), checkedAt: '2026-10-22T10:00:00Z' }],
        now,
      ),
    ).toBe(true);
  });

  it('summarizes empty and mixed target sets without division errors', () => {
    expect(summarizeHealth([])).toEqual({ total: 0, healthy: 0, attention: 0, availability: 0 });
    expect(
      summarizeHealth([target('a', 'API', 'Runtime'), target('b', 'DB', 'Data', false)]),
    ).toEqual({
      total: 2,
      healthy: 1,
      attention: 1,
      availability: 50,
    });
  });
});
