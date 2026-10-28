import { z } from 'zod';

export const scanSchema = z.object({
  id: z.string(), root: z.string(), started: z.number(), completed: z.number().nullable(),
  state: z.string(), files: z.number(), bytes: z.number(), issues: z.number(),
  skippedLinks: z.number(), message: z.string().nullable(),
});
export type Scan = z.infer<typeof scanSchema>;

export const progressSchema = z.object({
  id: z.string().nullable(), state: z.string(), root: z.string(), files: z.number(),
  bytes: z.number(), issues: z.number(), skippedLinks: z.number(),
  currentPath: z.string().nullable(), message: z.string().nullable(),
});
export type Progress = z.infer<typeof progressSchema>;

export const monitorSchema = z.object({
  enabled: z.boolean(), root: z.string(), intervalMinutes: z.number(), nextScan: z.number().nullable(),
});
export type Monitor = z.infer<typeof monitorSchema>;

export const configSchema = z.object({
  defaultRoot: z.string(), dataDirectory: z.string(), explorerSupported: z.boolean(),
  drives: z.array(z.object({ root: z.string(), total: z.number(), free: z.number() })),
  monitor: monitorSchema,
});
export type Config = z.infer<typeof configSchema>;

export const entrySchema = z.object({
  id: z.number(), path: z.string(), name: z.string(), folder: z.string(), extension: z.string(),
  category: z.string(), bytes: z.number(), modified: z.number(), buildArtifact: z.boolean(),
});
export type Entry = z.infer<typeof entrySchema>;

export const sliceSchema = z.object({ label: z.string(), bytes: z.number(), files: z.number() });
export const dashboardSchema = z.object({
  scan: scanSchema, previous: scanSchema.nullable(), delta: z.number().nullable(),
  reviewBytes: z.number(), staleBytes: z.number(), buildBytes: z.number(), largeBytes: z.number(),
  types: z.array(sliceSchema), folders: z.array(sliceSchema),
  growth: z.array(z.object({ folder: z.string(), bytes: z.number(), delta: z.number() })),
  issues: z.array(z.object({ path: z.string(), message: z.string() })),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export const entryPageSchema = z.object({
  items: z.array(entrySchema), total: z.number(), bytes: z.number(), page: z.number(), pageSize: z.number(),
});
export type EntryPage = z.infer<typeof entryPageSchema>;

export const statusSchema = z.object({ scan: progressSchema, monitor: monitorSchema });
export const monitorRequestSchema = z.object({ enabled: z.boolean(), root: z.string(), intervalMinutes: z.number() });
export type MonitorRequest = z.infer<typeof monitorRequestSchema>;
export const scanRequestSchema = z.object({ root: z.string() });
export const revealRequestSchema = z.object({ scanId: z.string(), entryId: z.number() });
