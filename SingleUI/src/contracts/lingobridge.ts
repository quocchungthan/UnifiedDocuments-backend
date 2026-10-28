import { z } from 'zod';

export const uploadSchema = z.object({
  id: z.string(),
  hash: z.string(),
  fileName: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  isPublic: z.boolean(),
  createdAtUtc: z.string(),
});
export const jobStatusSchema = z.object({
  state: z.enum(['Queued', 'Running', 'Completed', 'Failed']),
  fileName: z.string(),
  sizeBytes: z.number().nonnegative(),
  queuePosition: z.number().nullable(),
  stage: z.string().nullable(),
  chunksCompleted: z.number().nonnegative(),
  chunksTotal: z.number().nonnegative(),
  message: z.string().nullable(),
  resultAvailable: z.boolean(),
  createdAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export const clientConfigSchema = z.object({
  maxSizeBytes: z.number().positive(),
  accept: z.array(z.string()),
  languagePairs: z.array(z.object({ source: z.string(), target: z.string() })),
});
export const sessionSchema = z.object({
  email: z.string().email(),
  roles: z.array(z.string()),
  displayName: z.string().nullable(),
});
export const engineInfoSchema = z.object({ queued: z.number().nonnegative(), running: z.number().nonnegative() });

export type Upload = z.infer<typeof uploadSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;
export type ClientConfig = z.infer<typeof clientConfigSchema>;
export type LanguagePair = ClientConfig['languagePairs'][number];
export type Session = z.infer<typeof sessionSchema>;
export type EngineInfo = z.infer<typeof engineInfoSchema>;
export type ResultKind = 'Pdf' | 'Markdown';
