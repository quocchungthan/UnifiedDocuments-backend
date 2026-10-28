import { z } from 'zod';

export const teamSchema = z.enum(['red', 'black']);
export const roomStatusSchema = z.enum(['open', 'live', 'finished']);
export const roomModeSchema = z.enum(['ai-vs-ai', 'ai-vs-audience']);
export const arenaMoveSchema = z.object({
  ply: z.number().int(), side: teamSchema, move: z.string().regex(/^[a-i][0-9][a-i][0-9]$/),
  captured: z.string().nullable(), check: z.boolean(), thinkMs: z.number().nonnegative(), thought: z.string().nullable(),
  at: z.number(), fen: z.string(), source: z.string().nullable(),
});
export const publicSeatSchema = z.object({
  side: teamSchema, controller: z.enum(['mcp', 'house', 'copilot', 'audience']), label: z.string(),
  agentName: z.string().nullable(), model: z.string().nullable(),
  status: z.enum(['pairing', 'connected', 'waiting', 'thinking', 'voting', 'unresponsive', 'disconnected', 'finished']),
  lastSeenAt: z.number().nullable(), turnSeenAt: z.number().nullable(), illegalMoves: z.number().int(),
  moves: z.number().int(), avgThinkMs: z.number().nonnegative(), thought: z.string().nullable(),
});
export const boardSchema = z.object({
  fen: z.string(), ascii: z.string(), inCheck: z.boolean(), activeSide: teamSchema,
  ply: z.number().int().nonnegative(), legalMoves: z.array(z.string().regex(/^[a-i][0-9][a-i][0-9]$/)),
});
export const capabilitiesSchema = z.object({
  deployment: z.enum(['local', 'vercel']), houseAI: z.boolean(), audience: z.boolean(),
  realtime: z.enum(['poll', 'websocket']),
});
export const agentPromptSchema = z.object({ prompt: z.string().min(1) });
export const liveSettingsSchema = z.object({
  tiktokUsername: z.string().nullable(), audienceSeconds: z.number(), debounceMs: z.number(),
  aiThinkSeconds: z.number(), maxExtensions: z.number(), earlyCloseVoters: z.number(),
  earlyCloseShare: z.number(),
});
export const aiInsightSchema = z.object({
  status: z.enum(['idle', 'thinking', 'pondering', 'offline']), engine: z.string(),
  plan: z.object({ name: z.string(), next: z.string().nullable(), remaining: z.number() }).nullable(),
  candidates: z.array(z.object({ name: z.string(), move: z.string(), confidence: z.number(), patternIds: z.array(z.string()) })),
  ready: z.array(z.object({ reply: z.string(), answer: z.string(), source: z.string() })),
  lastDecision: z.string().nullable(), crowdNote: z.string().nullable(),
});
export const audienceInsightSchema = z.object({
  connected: z.boolean(), source: z.string(), phase: z.enum(['idle', 'collecting', 'paused']),
  windowEndsAt: z.number().nullable(), extensions: z.number(), audienceSeconds: z.number(),
  tally: z.array(z.object({ move: z.string(), votes: z.number(), label: z.string(), ready: z.boolean() })),
  voters: z.number(), hints: z.array(z.object({ id: z.string(), label: z.string(), votes: z.number() })),
  recentComments: z.array(z.object({ user: z.string(), text: z.string(), kind: z.string(), at: z.number() })),
  commentsPerMinute: z.number(), lastResolution: z.string().nullable(),
});
export const roomSchema = z.object({
  pairingApproval: z.enum(['operator', 'automatic']), code: z.string(), title: z.string(), mode: roomModeSchema,
  game: z.number().int().positive(), createdAt: z.number(), status: roomStatusSchema,
  settings: z.object({ turnSeconds: z.number(), maxIllegalMoves: z.number(), maxPlies: z.number() }),
  live: liveSettingsSchema.nullable(), seats: z.object({ red: publicSeatSchema, black: publicSeatSchema }),
  serverNow: z.number(), spectators: z.number().int().nonnegative(), board: boardSchema,
  startedAt: z.number().nullable(), turnStartedAt: z.number().nullable(), deadline: z.number().nullable(),
  history: z.array(arenaMoveSchema), events: z.array(z.object({ at: z.number(), kind: z.string(), side: teamSchema.optional(), text: z.string() })),
  outcome: z.object({ winner: teamSchema.nullable(), reason: z.string() }).nullable(),
  insight: z.object({
    ai: z.object({ red: aiInsightSchema.optional(), black: aiInsightSchema.optional() }).optional(),
    audience: audienceInsightSchema.optional(),
    patterns: z.object({ phase: z.string(), openings: z.array(z.object({ id: z.string(), name: z.string(), side: teamSchema })) }).optional(),
  }).passthrough(),
  drawOffer: z.object({ id: z.string(), side: teamSchema, ply: z.number(), reason: z.string() }).nullable(),
}).passthrough();
export const roomSummarySchema = z.object({
  code: z.string(), title: z.string(), mode: roomModeSchema, game: z.number().int(), createdAt: z.number(),
  status: roomStatusSchema, seats: z.object({ red: publicSeatSchema, black: publicSeatSchema }),
  pairingApproval: z.enum(['operator', 'automatic']), spectators: z.number().int().nonnegative(),
  ply: z.number().int().nonnegative(), activeSide: teamSchema,
}).passthrough();
export const roomsResponseSchema = z.object({ rooms: z.array(roomSummarySchema) }).passthrough();
export const createRoomSchema = z.object({
  title: z.string().trim().min(1).max(60), mode: z.literal('ai-vs-ai').default('ai-vs-ai'),
  seats: z.object({ red: z.object({ controller: z.enum(['mcp', 'house', 'copilot']) }), black: z.object({ controller: z.enum(['mcp', 'house', 'copilot']) }) }),
  settings: z.object({ turnSeconds: z.number().int().min(10).max(3600) }),
});

export type Team = z.infer<typeof teamSchema>;
export type ArenaMove = z.infer<typeof arenaMoveSchema>;
export type PublicSeat = z.infer<typeof publicSeatSchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomSummary = z.infer<typeof roomSummarySchema>;
export type CreateRoom = z.infer<typeof createRoomSchema>;
