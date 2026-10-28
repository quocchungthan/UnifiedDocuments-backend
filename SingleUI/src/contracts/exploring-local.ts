import { z } from 'zod';

const webUrl = z
  .string()
  .url()
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol));

export const cafeSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable(),
  rating: z.number().min(0).max(5),
  reviews: z.number().int().nonnegative(),
  sourceUrl: webUrl.nullable(),
  substituteContext: z.object({ district: z.string(), matched: z.boolean() }).optional(),
});

export const exploringHealthSchema = z.object({
  ok: z.boolean(),
  tool: z.string(),
  copilotReady: z.boolean(),
});

export const cafeSearchSchema = z.object({
  district: z.string().max(160),
  minRating: z.number().min(1).max(5),
  minReviews: z.number().int().min(0).max(100_000),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type Cafe = z.infer<typeof cafeSchema>;
export type ExploringHealth = z.infer<typeof exploringHealthSchema>;
export type CafeSearch = z.infer<typeof cafeSearchSchema>;
