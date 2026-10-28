import type { IdentityAudience } from '../../contracts/identity';

/** Fences returns sparse daily new-authorizations counts, not cumulative registrations. */
export function audienceGrowth(audience: IdentityAudience) {
  const counts = new Map(audience.growth.map((point) => [point.date, point.users]));
  const labels: string[] = [];
  const values: number[] = [];
  const date = new Date(`${audience.from}T00:00:00Z`);
  for (let index = 0; index < 90 && date.toISOString().slice(0, 10) <= audience.through; index++) {
    const label = date.toISOString().slice(0, 10);
    labels.push(label);
    values.push(counts.get(label) ?? 0);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return { labels, values };
}
