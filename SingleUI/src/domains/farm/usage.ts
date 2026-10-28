import type { BandwidthDay } from '../../contracts/farm-account';
import type { DashboardData, TaskUsage } from '../../contracts/farm-dashboard';

export function summarize(tasks: readonly TaskUsage[]) {
  const sum = (
    field: keyof Pick<
      TaskUsage,
      | 'costUsd'
      | 'feeUsd'
      | 'baselineCostUsd'
      | 'inputTokens'
      | 'outputTokens'
      | 'durationSeconds'
      | 'inputBytes'
      | 'outputBytes'
    >,
  ) => tasks.reduce((total, task) => total + task[field], 0);
  const cost = sum('costUsd'),
    fees = sum('feeUsd'),
    baseline = sum('baselineCostUsd'),
    seconds = sum('durationSeconds');
  return {
    cost,
    fees,
    baseline,
    savings: baseline - cost - fees,
    inputTokens: sum('inputTokens'),
    outputTokens: sum('outputTokens'),
    inputBytes: sum('inputBytes'),
    outputBytes: sum('outputBytes'),
    seconds,
    averageSeconds: tasks.length ? seconds / tasks.length : 0,
    costPerTask: tasks.length ? (cost + fees) / tasks.length : 0,
  };
}
export function dailyUsage(data: DashboardData) {
  return Array.from({ length: data.days }, (_, index) => {
    const date = new Date(`${data.from}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, ...summarize(data.tasks.filter((task) => task.date === key)) };
  });
}
export function bandwidthDays(
  usage: readonly BandwidthDay[],
  days: number,
  now = new Date(),
): BandwidthDay[] {
  const byDate = new Map(usage.map((day) => [day.date, day]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1 + index),
    )
      .toISOString()
      .slice(0, 10);
    return byDate.get(date) ?? { date, readBytes: 0, writeBytes: 0 };
  });
}

export function formatBytes(value: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}
