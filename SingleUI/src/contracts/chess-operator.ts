import { z } from 'zod';
import { capabilitiesSchema, liveSettingsSchema, roomModeSchema, teamSchema } from './chess';

export const operatorConfigSchema = z.object({
  brain: z.string(), defaultModel: z.string().nullable(), commentSource: z.string(),
  tiktokReady: z.boolean(), defaultTikTokUsername: z.string().nullable(),
  capabilities: capabilitiesSchema,
  defaults: z.object({ turnSeconds: z.number(), aiThinkSeconds: z.number() }),
});
export const operatorModelsSchema = z.object({
  models: z.array(z.object({ id: z.string(), name: z.string() })), error: z.string().optional(),
});
const seat = z.object({
  controller: z.enum(['mcp', 'house', 'copilot', 'audience']),
  model: z.string().max(80).optional(),
});
export const operatorCreateSchema = z.object({
  title: z.string().trim().min(1).max(60), mode: roomModeSchema,
  seats: z.object({ red: seat, black: seat }),
  settings: z.object({ turnSeconds: z.number().int().min(10).max(3600) }),
  live: liveSettingsSchema.partial().optional(),
});
export const pairingSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/), code: z.string(), side: teamSchema,
  agentName: z.string(), model: z.string().nullable(), userCode: z.string(),
  createdAt: z.number(), expiresAt: z.number(),
  status: z.enum(['pending', 'approved', 'rejected', 'consumed']),
});
export const pairingsSchema = z.object({ pairings: pairingSchema.array() });
export type OperatorConfig = z.infer<typeof operatorConfigSchema>;
export type OperatorModels = z.infer<typeof operatorModelsSchema>;
export type OperatorCreate = z.infer<typeof operatorCreateSchema>;
export type Pairing = z.infer<typeof pairingSchema>;
