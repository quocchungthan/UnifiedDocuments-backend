import { Injectable } from '@angular/core';
import { ServiceRequestError, requestJson } from '../http/request';
import {
  carCatalogImportResultSchema,
  carDrawingImportResultSchema,
  existingVehicleSchema,
  importErrorSchema,
  newVehicleSchema,
  placementResultSchema,
  type NewVehicle,
} from '../../contracts/car-imports';
import { vehicleModelSchema, type PartPose } from '../../contracts/car-assemblies';

const importHeaders = { 'X-Car-Import-Intent': 'car-knowledge-ui' };
const jsonHeaders = { ...importHeaders, 'Content-Type': 'application/json' };
/** Uploads may wait for Blender conversion (capped at two minutes by the API). */
const UPLOAD_TIMEOUT_MS = 180_000;

/** The API's own sentence for a rejected import, or the transport message. */
export function importErrorText(error: unknown) {
  if (error instanceof ServiceRequestError) {
    const parsed = importErrorSchema.safeParse(parseDetail(error.detail));
    if (parsed.success) return parsed.data.error;
  }
  return error instanceof Error ? error.message : String(error);
}

@Injectable({ providedIn: 'root' })
export class CarImportClient {
  async catalog(file: File, signal?: AbortSignal) {
    const body = await file.text();
    return requestJson('car', '/api/car-import/catalog', carCatalogImportResultSchema, {
      method: 'POST',
      headers: jsonHeaders,
      body,
      signal,
    });
  }

  /** Creates a car from form fields; an identical existing car is reported with `existing: true`. */
  async createVehicle(input: NewVehicle, signal?: AbortSignal) {
    const body = JSON.stringify(newVehicleSchema.parse(input));
    try {
      const vehicle = await requestJson('car', '/api/car-import/vehicles', vehicleModelSchema,
        { method: 'POST', headers: jsonHeaders, body, signal });
      return { vehicleId: vehicle.id, existing: false };
    } catch (error) {
      if (error instanceof ServiceRequestError && error.status === 409) {
        const existing = existingVehicleSchema.safeParse(parseDetail(error.detail));
        if (existing.success) return { vehicleId: existing.data.vehicleId, existing: true };
      }
      throw error;
    }
  }

  /** Attaches a drawing to the whole car (`definitionId: 'car'`) or to the part named by a knowledge word. */
  async drawingFor(input: {
    file: File;
    vehicleId: string;
    definitionId: string;
    provenance?: string;
    fidelity?: string;
  }, signal?: AbortSignal) {
    const body = new FormData();
    body.append('file', input.file, input.file.name);
    body.append('definitionId', input.definitionId);
    if (input.provenance?.trim()) body.append('provenance', input.provenance.trim());
    if (input.fidelity?.trim()) body.append('fidelity', input.fidelity.trim());
    return requestJson('car',
      `/api/car-import/vehicles/${encodeURIComponent(input.vehicleId)}/drawings`,
      carDrawingImportResultSchema,
      { method: 'POST', headers: importHeaders, body, signal, timeout: UPLOAD_TIMEOUT_MS },
    );
  }

  /** Saves this car's own placement of one part, or clears it (`pose: null`) to use the catalog pose. */
  place(input: { vehicleId: string; occurrenceId: string; designId: string; pose: PartPose | null }, signal?: AbortSignal) {
    const { vehicleId, ...body } = input;
    return requestJson('car',
      `/api/car-import/vehicles/${encodeURIComponent(vehicleId)}/placements`,
      placementResultSchema,
      { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body), signal },
    );
  }

  async drawing(input: {
    file: File;
    vehicleId: string;
    designId: string;
    provenance: string;
    fidelity: string;
  }, signal?: AbortSignal) {
    const body = new FormData();
    body.append('file', input.file, input.file.name);
    body.append('provenance', input.provenance);
    body.append('fidelity', input.fidelity);
    return requestJson('car',
      `/api/car-import/vehicles/${encodeURIComponent(input.vehicleId)}/designs/${encodeURIComponent(input.designId)}/drawing`,
      carDrawingImportResultSchema,
      { method: 'POST', headers: importHeaders, body, signal, timeout: UPLOAD_TIMEOUT_MS },
    );
  }
}

function parseDetail(detail: string): unknown {
  try { return JSON.parse(detail); } catch { return null; }
}
