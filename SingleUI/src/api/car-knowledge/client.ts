import { Injectable } from '@angular/core';
import { carKnowledgeSchema, type CarKnowledge } from '../../contracts/car-knowledge';
import { requestJson } from '../http/request';

/** Read-only graph published by the standalone car backend. */
@Injectable({ providedIn: 'root' })
export class CarKnowledgeClient {
  graph(signal?: AbortSignal): Promise<CarKnowledge> {
    return requestJson('car', '/api/car-knowledge', carKnowledgeSchema, { signal });
  }
}
