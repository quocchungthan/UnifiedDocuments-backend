import type { Click } from '../../contracts/farm';

export function activityDays(clicks: Click[], today = new Date(), count = 98, platform?: string) {
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end - (count - index - 1) * 86400000).toISOString().slice(0, 10);
    return {
      date,
      count: clicks
        .filter((click) => click.day === date && (!platform || click.platform === platform))
        .reduce((sum, click) => sum + click.count, 0),
    };
  });
}
export function activitySummary(days: { count: number }[]) {
  let best = 0,
    run = 0,
    current = 0;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let index = days.length - 1;
  if (days[index]?.count === 0) index--;
  while (index >= 0 && days[index--].count > 0) current++;
  return { current, best, active: days.filter((day) => day.count > 0).length };
}
