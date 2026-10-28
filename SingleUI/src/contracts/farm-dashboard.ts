import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const amount = z.number().nonnegative();
export const taskUsageSchema = z.object({
  id: z.string(),
  date,
  name: z.string(),
  model: z.string(),
  inputTokens: amount,
  outputTokens: amount,
  durationSeconds: amount,
  inputBytes: amount,
  outputBytes: amount,
  costUsd: amount,
  feeUsd: amount,
  baselineCostUsd: amount,
});
export const dashboardSchema = z.object({
  source: z.literal('demo'),
  currency: z.literal('USD'),
  days: z.number().int().min(1).max(90),
  from: date,
  through: date,
  isOwner: z.boolean(),
  tasks: taskUsageSchema.array(),
  audience: z.object({ source: z.literal('fences'), url: z.string().url().nullable() }).nullable(),
});
export const audienceSchema = z.object({
  source: z.literal('fences'),
  totalUsers: amount,
  newUsers: amount,
  returningUsers: amount,
  growth: z.object({ date, users: amount }).array(),
  users: z
    .object({
      subject: z.string(),
      username: z.string(),
      firstSeen: z.string(),
      lastSeen: z.string(),
      observedDays: amount,
    })
    .array(),
  coverage: z.string(),
});
export type TaskUsage = z.infer<typeof taskUsageSchema>;
export type DashboardData = z.infer<typeof dashboardSchema>;
export type AudienceData = z.infer<typeof audienceSchema>;
