import { z } from 'zod';

const link = (protocols: readonly string[]) =>
  z
    .string()
    .url()
    .pipe(
      z
        .string()
        .refine(
          (value) => protocols.includes(new URL(value).protocol),
          'Unsupported link protocol',
        ),
    );
const url = link(['http:', 'https:']);
const optionalUrl = z.union([url, z.literal('').transform(() => null)]).nullish();
export const metadataSchema = z.object({
  developerName: z.string(),
  title: z.string(),
  description: z.string(),
  repositoryUrl: optionalUrl,
  specifiedIssueUrl: optionalUrl,
});
export const profileSchema = z.object({
  id: z.number(),
  displayName: z.string(),
  headline: z.string(),
  bio: z.string().nullish(),
  location: z.string().nullish(),
  profileImageUrl: optionalUrl,
  avatarSvg: z.string().nullish(),
  resumeUrl: optionalUrl,
});
export const socialLinkSchema = z.object({
  id: z.number(),
  profileId: z.number(),
  label: z.string(),
  url: link(['http:', 'https:', 'mailto:']),
  displayOrder: z.number(),
});
export const profileSkillSchema = z.object({
  profileId: z.number(),
  skillId: z.number(),
  displayOrder: z.number(),
});
export const projectSkillSchema = z.object({ projectId: z.number(), skillId: z.number() });
export const projectSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  summary: z.string(),
  description: z.string().nullish(),
  demoUrl: optionalUrl,
  sourceUrl: optionalUrl,
});
export const associationSchema = z.object({
  profileId: z.number(),
  projectId: z.number(),
  role: z.string().nullish(),
  organization: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  isFeatured: z.boolean(),
  displayOrder: z.number(),
});
export const skillSchema = z.object({ id: z.number(), name: z.string(), category: z.string() });
export const gigStepSchema = z.object({
  id: z.number(),
  stepNumber: z.number(),
  title: z.string(),
  description: z.string().nullish(),
});
export const gigSkillSchema = z.object({ id: z.number(), name: z.string() });
export const gigSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  category: z.string(),
  summary: z.string(),
  problem: z.string().nullish(),
  outcome: z.string().nullish(),
  solvedOn: z.string().nullish(),
  displayOrder: z.number(),
  steps: gigStepSchema.array(),
  skills: gigSkillSchema.array(),
});
export const experienceSchema = z.object({
  id: z.number(),
  company: z.string(),
  jobTitle: z.string(),
  description: z.string().nullish(),
  startDate: z.string(),
  endDate: z.string().nullish(),
  isCurrent: z.boolean(),
  displayOrder: z.number(),
});
export const platformSchema = z.object({
  id: z.number(),
  platform: z.string(),
  url: link(['http:', 'https:', 'mailto:']),
  platformId: z.string(),
  description: z.string(),
  color: z.string(),
  displayOrder: z.number(),
});
export const toolSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  directUrl: url,
  repositoryUrl: optionalUrl,
  issueUrl: optionalUrl,
  displayOrder: z.number(),
});
export const clickSchema = z.object({
  platform: z.string(),
  day: z.string(),
  count: z.number().nonnegative(),
});
export type Project = z.infer<typeof projectSchema>;
export type Gig = z.infer<typeof gigSchema>;
export type ProfileProject = z.infer<typeof associationSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Platform = z.infer<typeof platformSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Click = z.infer<typeof clickSchema>;
export interface Portfolio {
  metadata: z.infer<typeof metadataSchema> | null;
  profiles: Profile[];
  socialLinks: z.infer<typeof socialLinkSchema>[];
  profileSkills: z.infer<typeof profileSkillSchema>[];
  projectSkills: z.infer<typeof projectSkillSchema>[];
  projects: Project[];
  gigs: Gig[];
  associations: ProfileProject[];
  skills: Skill[];
  experiences: Experience[];
  platforms: Platform[];
  tools: Tool[];
  clicks: Click[];
}
export interface ProbeResult {
  data: unknown;
  status: number;
  statusText: string;
  at: string;
  requests: string | null;
  clients: string | null;
  limit: string | null;
  remaining: string | null;
  reset: string | null;
}
