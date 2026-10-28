import { z } from 'zod';

export const vehicleDocumentSchema = z.object({
  sourceName: z.string().min(1),
  sourceDocumentId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  businessKey: z.string().nullable(),
  modifiedAt: z.string().datetime({ offset: true }).nullable(),
});

export const vehicleDocumentsSchema = vehicleDocumentSchema.array();
export const vehicleIdentifiersSchema = z.array(z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/));
export const unlinkedDocumentsPageSchema = z.object({
  items: vehicleDocumentsSchema,
  nextCursor: z.string().min(1).nullable(),
});
export type UnlinkedDocumentsPage = z.infer<typeof unlinkedDocumentsPageSchema>;
export type VehicleDocument = z.infer<typeof vehicleDocumentSchema>;