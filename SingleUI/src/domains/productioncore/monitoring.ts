import type { ServiceTarget } from '../../contracts/productioncore';

export interface TargetGroup {
  name: string;
  targets: ServiceTarget[];
}

export interface HealthSummary {
  total: number;
  healthy: number;
  attention: number;
  availability: number;
}

export function groupTargets(targets: readonly ServiceTarget[]): TargetGroup[] {
  const groups = new Map<string, ServiceTarget[]>();
  for (const target of targets)
    groups.set(target.group, [...(groups.get(target.group) ?? []), target]);
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, items]) => ({
      name,
      targets: [...items].sort((left, right) => left.name.localeCompare(right.name)),
    }));
}

export function summarizeHealth(targets: readonly ServiceTarget[]): HealthSummary {
  const healthy = targets.filter((target) => target.up).length;
  const total = targets.length;
  return {
    total,
    healthy,
    attention: total - healthy,
    availability: total ? Math.round((healthy / total) * 100) : 0,
  };
}

export function isCheckStale(target: ServiceTarget, now = Date.now(), maxAgeMs = 15000) {
  return now - Date.parse(target.checkedAt) > maxAgeMs;
}

export function hasStaleChecks(
  targets: readonly ServiceTarget[],
  now = Date.now(),
  maxAgeMs = 15000,
) {
  return targets.some((target) => isCheckStale(target, now, maxAgeMs));
}
