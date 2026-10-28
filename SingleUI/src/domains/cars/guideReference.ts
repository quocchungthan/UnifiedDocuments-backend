import { z } from 'zod';
export const parseGuideReference = (input: unknown) =>
  z
    .object({
      guideId: z.string(),
      source: z.object({ title: z.string(), url: z.string().url() }),
      scope: z.string(),
      reviewed: z.string(),
      applicability: z.object({ status: z.literal('generic'), appliesTo: z.string() }),
    })
    .parse(input);
