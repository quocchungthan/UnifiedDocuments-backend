import { z } from 'zod';

/**
 * Car knowledge graph served by the PARA Bridge at `/api/car-knowledge`.
 * Mirrors PARA-AI-solution `car-transcripts/model.ts`; change both together.
 */
/** A transcript statement (`videoId`, optional `at`) or a web reference (`url`, optional `title`). */
export const sourceRefSchema = z
  .object({
    videoId: z.string().optional(),
    at: z.string().optional(),
    quote: z.string().optional(),
    url: z.string().url().optional(),
    title: z.string().optional(),
  })
  .refine((source) => source.videoId || source.url, 'A source needs a videoId or a url');

/** Parses an array item by item, dropping invalid entries so one bad record cannot hide the rest. */
const tolerantArray = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((value) => {
        const parsed = item.safeParse(value);
        return parsed.success ? [parsed.data as z.output<T>] : [];
      }),
    );

export const knowledgeTermSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  aliases: z.array(z.string()).optional().catch(undefined),
  category: z.string().catch('other'),
  summary: z.string().catch(''),
  detail: z.string().catch(''),
  sources: tolerantArray(sourceRefSchema),
});

export const knowledgeRelationSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: z.string(),
  closeness: z.number().min(0).max(1),
  support: z.number().min(-1).max(1),
  summary: z.string().catch(''),
  sources: tolerantArray(sourceRefSchema),
});

export const carKnowledgeSchema = z
  .object({
    version: z.literal(1),
    updatedAt: z.string().catch(''),
    terms: tolerantArray(knowledgeTermSchema),
    relations: tolerantArray(knowledgeRelationSchema),
  })
  .transform((graph) => {
    const ids = new Set(graph.terms.map((term) => term.id));
    return { ...graph, relations: graph.relations.filter((r) => ids.has(r.from) && ids.has(r.to) && r.from !== r.to) };
  });

export type SourceRef = z.infer<typeof sourceRefSchema>;
export type KnowledgeTerm = z.infer<typeof knowledgeTermSchema>;
export type KnowledgeRelation = z.infer<typeof knowledgeRelationSchema>;
export type CarKnowledge = z.output<typeof carKnowledgeSchema>;
