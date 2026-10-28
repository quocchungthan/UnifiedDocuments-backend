import { z } from 'zod';
import { poseSchema as partPoseSchema, vehicleModelSchema } from './car-assemblies';

const poseSchema = z.object({
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  z: z.number().finite().default(0),
  qx: z.number().finite().default(0),
  qy: z.number().finite().default(0),
  qz: z.number().finite().default(0),
  qw: z.number().finite().default(1),
}).strict();

export const carPartDesignSchema = z.object({
  id: z.string().min(1),
  definitionId: z.string().min(1),
  label: z.string().min(1),
  revision: z.string().min(1),
  assetId: z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null),
  provenance: z.string().min(1),
}).strict();

export const carCatalogSchema = z.object({
  version: z.literal(1),
  vehicles: vehicleModelSchema.extend({ provenance: z.string().min(1) }).strict().array().default([]),
  designs: carPartDesignSchema.array().default([]),
  attachments: z.object({
    designId: z.string().min(1),
    name: z.string().min(1),
    pose: poseSchema.default({ x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 }),
  }).strict().array().default([]),
  children: z.object({
    parentDesignId: z.string().min(1),
    key: z.string().min(1),
    childDesignId: z.string().min(1),
    parentAttachment: z.string().min(1).nullable().default(null),
    childAttachment: z.string().min(1).nullable().default(null),
    pose: poseSchema.default({ x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 }),
  }).strict().array().default([]),
  vehicleParts: z.object({
    vehicleId: z.string().min(1),
    key: z.string().min(1),
    designId: z.string().min(1),
    pose: poseSchema.default({ x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 }),
  }).strict().array().default([]),
}).strict();

export const carCatalogImportResultSchema = z.object({
  vehicles: vehicleModelSchema.array(),
  designs: carPartDesignSchema.array(),
});

export const carDrawingImportResultSchema = z.object({
  asset: z.object({
    id: z.string().regex(/^[a-f0-9]{64}$/),
    sourceFormat: z.string(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    provenance: z.string(),
    fidelity: z.string(),
    createdAt: z.string(),
  }),
  design: z.object({ id: z.string(), label: z.string(), definitionId: z.string() }),
  vehicle: vehicleModelSchema,
  affectedVehicles: vehicleModelSchema.array(),
  occurrenceIds: z.string().array().default([]),
});

/** Car identity typed into the import form; blank market/variant are stored as "unknown". */
export const newVehicleSchema = z.object({
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year: z.number().int().min(1886).max(2200),
  market: z.string().trim().max(100),
  variant: z.string().trim().max(100),
  provenance: z.string().trim().max(1000),
}).strict();

/** 409 body when the identical car already exists. */
export const existingVehicleSchema = z.object({ error: z.string(), vehicleId: z.string().min(1) });

/** Error body every import route returns on 4xx. */
export const importErrorSchema = z.object({ error: z.string().min(1) });

export const placementResultSchema = z.object({
  id: z.string(), designId: z.string(), label: z.string(), pose: partPoseSchema,
  customPlacement: z.boolean(),
}).passthrough();

export type CarCatalog = z.output<typeof carCatalogSchema>;
export type NewVehicle = z.output<typeof newVehicleSchema>;
