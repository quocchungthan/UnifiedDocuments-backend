import { Injectable } from '@angular/core';
import {
  unlinkedDocumentsPageSchema, vehicleDocumentsSchema, vehicleIdentifiersSchema,
  type UnlinkedDocumentsPage, type VehicleDocument,
} from '../../contracts/car-documents';
import { requestJson, serviceUrl } from '../http/request';

@Injectable({ providedIn: 'root' })
export class VehicleDocumentsClient {
  identifiers(query: string, signal?: AbortSignal): Promise<string[]> {
    return requestJson(
      'unifiedDocuments',
      `/vehicles/identifiers?query=${encodeURIComponent(query)}`,
      vehicleIdentifiersSchema,
      { signal },
    );
  }

  unlinked(cursor?: string): Promise<UnlinkedDocumentsPage> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return requestJson('unifiedDocuments', `/documents/unlinked${query}`, unlinkedDocumentsPageSchema);
  }

  byVin(vin: string): Promise<VehicleDocument[]> {
    return requestJson(
      'unifiedDocuments',
      `/vehicles/${encodeURIComponent(vin)}/documents`,
      vehicleDocumentsSchema,
    );
  }

  contentUrl(document: VehicleDocument, download = false): string {
    const path = `/documents/${encodeURIComponent(document.sourceName)}/${encodeURIComponent(document.sourceDocumentId)}/content`;
    return serviceUrl('unifiedDocuments', `${path}${download ? '?download=true' : ''}`);
  }
}