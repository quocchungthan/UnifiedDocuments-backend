import { z } from 'zod';

export const farmSessionSchema = z.object({
  isAuthenticated: z.boolean(),
  signInAvailable: z.boolean(),
  subject: z.string().nullable(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  picture: z.string().url().nullable(),
  email: z.string().nullable(),
});
export const accessKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  preview: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
export const createdKeySchema = z.object({ secret: z.string().min(1) });
export const bandwidthDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  readBytes: z.number().nonnegative(),
  writeBytes: z.number().nonnegative(),
});
export type FarmSession = z.infer<typeof farmSessionSchema>;
export type AccessKey = z.infer<typeof accessKeySchema>;
export type BandwidthDay = z.infer<typeof bandwidthDaySchema>;
