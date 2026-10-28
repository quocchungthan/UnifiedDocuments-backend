import { z } from 'zod';

export const vehicleModelSchema = z.object({
  id: z.string(), make: z.string(), model: z.string(), year: z.number().int(),
  market: z.string(), variant: z.string(), provenance: z.string(),
});
export const poseSchema = z.object({
  x: z.number().finite(), y: z.number().finite(), z: z.number().finite(),
  qx: z.number().finite(), qy: z.number().finite(), qz: z.number().finite(), qw: z.number().finite(),
});
export const vehicleAssemblySchema = z.object({
  vehicle: vehicleModelSchema,
  occurrences: z.array(z.object({
    id: z.string(), parentId: z.string().nullable(), designId: z.string(), definitionId: z.string(),
    label: z.string(), assetId: z.string().regex(/^[a-f0-9]{64}$/).nullable(), pose: poseSchema,
    coverage: z.enum(['drawable', 'assembly', 'missing']), provenance: z.string(),
    customPlacement: z.boolean().default(false),
  })).max(10000),
  assets: z.array(z.object({
    id: z.string().regex(/^[a-f0-9]{64}$/), sourceFormat: z.string(), sourceHash: z.string(),
    provenance: z.string(), fidelity: z.string(), createdAt: z.string(),
  })),
});
export type VehicleModel = z.infer<typeof vehicleModelSchema>;
export type VehicleAssembly = z.output<typeof vehicleAssemblySchema>;
export type PartPose = z.infer<typeof poseSchema>;
