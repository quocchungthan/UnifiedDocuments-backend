import { z } from 'zod';

export const sessionSchema = z.object({
  sessionId: z.string(),
  agent: z.string().optional(),
  title: z.string().optional(),
  taskType: z.string().optional(),
  task: z.string().optional(),
  state: z.string(),
  needs: z.array(z.object({ text: z.string(), resolver: z.string() })),
  question: z.string().optional(),
  phase: z.string().optional(),
  attempts: z.number(),
  progress: z.array(z.object({ ts: z.string().optional(), note: z.string().optional() })),
  result: z.string().optional(),
  updatedAt: z.string().optional(),
  stale: z.boolean().optional(),
  registered: z.boolean().optional(),
  silent: z.boolean().optional(),
  lastActivityAt: z.string().nullish(),
  issues: z.array(z.string()).optional(),
  handoff: z
    .object({
      id: z.string(),
      target: z.string(),
      agent: z.string().optional(),
      prompt: z.string(),
    })
    .nullish(),
});
export const assignmentSchema = z.object({
  key: z.string(),
  protocol: z.number().optional(),
  originId: z.string(),
  targetId: z.string(),
  title: z.string().optional(),
  mode: z.string().optional(),
  rootKey: z.string().optional(),
  parentKey: z.string().optional(),
  points: z.number().optional(),
  accessMode: z.string().optional(),
  reads: z.array(z.string()).optional(),
  scheduling: z
    .object({
      code: z.string(),
      summary: z.string(),
      blockingAssignmentIds: z.array(z.string()),
    })
    .nullish(),
  status: z.string(),
  workState: z.string().optional(),
  acceptance: z.array(z.string()),
  dependsOn: z.array(z.string()),
  writes: z.array(z.string()),
  reports: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      summary: z.string(),
      evidence: z.array(z.string()),
      verification: z.string().optional(),
      question: z.string().optional(),
      createdAt: z.string().optional(),
    }),
  ),
  lastError: z.string().optional(),
});
export const outboxReceiptSchema = z.object({
  sessionId: z.string(),
  commandId: z.string(),
  status: z.string(),
  assignmentId: z.string().optional(),
  error: z.string().optional(),
});
export const deliverySchema = z.object({
  sessionId: z.string(),
  messageId: z.string(),
  from: z.string().optional(),
  status: z.string(),
  attempts: z.number().optional(),
  nextAttemptAt: z.string().nullish(),
  lastError: z.string().nullish(),
});
export const snapshotSchema = z.object({
  now: z.string(),
  roles: z.array(z.string()).optional(),
  sessions: z.array(sessionSchema),
  delegations: z.array(
    z.object({
      key: z.string(),
      originId: z.string(),
      targetId: z.string(),
      status: z.string(),
      createdAt: z.string().optional(),
      attempts: z.number().optional(),
      nextAttemptAt: z.string().nullish(),
      lastError: z.string().nullish(),
    }),
  ),
  humanQueue: z.unknown(),
  log: z.array(z.string()),
  assignments: z.array(assignmentSchema).optional(),
  outboxReceipts: z.array(outboxReceiptSchema).optional(),
  deliveries: z.array(deliverySchema).optional(),
  assignmentError: z.string().optional(),
});
export const inspectionSchema = z.object({
  sessionId: z.string(),
  available: z.boolean(),
  diagnosis: z.string(),
  lastEventAt: z.string().nullish(),
  lastEventType: z.string().nullish(),
  silentSeconds: z.number().nullish(),
  silent: z.boolean().optional(),
  failedToolCalls: z.number().optional(),
  failedPermissionPrompts: z.number().optional(),
  pendingPermissions: z.number().optional(),
  recent: z.array(z.object({ at: z.string(), type: z.string(), detail: z.string() })).optional(),
});
export type Session = z.infer<typeof sessionSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Delegation = Snapshot['delegations'][number];
export type Assignment = z.infer<typeof assignmentSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type Inspection = z.infer<typeof inspectionSchema>;
export type BridgePage = 'overview' | 'tasks' | 'sessions' | 'agents';
