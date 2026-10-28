import { z } from 'zod';

const webUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Expected HTTP(S) URL');
export const identityAppSchema = z.object({
  key: z.string(),
  name: z.string(),
  url: webUrl,
  description: z.string(),
});
export const identitySessionSchema = z.discriminatedUnion('isAuthenticated', [
  z.object({
    isAuthenticated: z.literal(false),
    brandName: z.string().trim().min(1).optional(),
    loginUrl: z.string(),
    apps: identityAppSchema.array(),
  }),
  z.object({
    isAuthenticated: z.literal(true),
    brandName: z.string().trim().min(1).optional(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    githubLogin: z.string().nullable(),
    avatarUrl: webUrl.nullable(),
    hasGithubToken: z.boolean(),
    apps: identityAppSchema.array(),
  }),
]);
export const audienceRangeSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);
export const identityAudienceSchema = z.object({
  source: z.literal('fences'),
  clientId: z.string(),
  from: z.string().date(),
  through: z.string().date(),
  totalUsers: z.number().int().nonnegative(),
  newUsers: z.number().int().nonnegative(),
  returningUsers: z.number().int().nonnegative(),
  growth: z.array(z.object({ date: z.string().date(), users: z.number().int().nonnegative() })),
  users: z.array(
    z.object({
      subject: z.string(),
      username: z.string(),
      firstSeen: z.string().date(),
      lastSeen: z.string().date(),
      observedDays: z.number().int().nonnegative(),
      seenInPeriod: z.boolean(),
    }),
  ),
  coverage: z.string(),
});
export const identityRepositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  fullName: z.string(),
  isPrivate: z.boolean(),
  defaultBranch: z.string().nullable(),
  htmlUrl: webUrl.nullable(),
  cloneUrl: webUrl.nullable(),
  pushedAt: z.string().nullable(),
});
export const identityRepositoriesSchema = z.object({
  count: z.number().int().nonnegative(),
  repos: identityRepositorySchema.array(),
});
export type IdentityApp = z.infer<typeof identityAppSchema>;
export type IdentitySession = z.infer<typeof identitySessionSchema>;
export type IdentityAudience = z.infer<typeof identityAudienceSchema>;
export type IdentityRepositories = z.infer<typeof identityRepositoriesSchema>;
export type AudienceRange = z.infer<typeof audienceRangeSchema>;
