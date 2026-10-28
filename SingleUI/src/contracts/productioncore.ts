import { z } from 'zod';

export const serviceTargetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  group: z.string().min(1),
  kind: z.enum(['http', 'tcp']),
  up: z.boolean(),
  latencyMs: z.number().finite().nonnegative(),
  error: z.string().nullable(),
  checkedAt: z.string().datetime({ offset: true }),
});

export type ServiceTarget = z.infer<typeof serviceTargetSchema>;
