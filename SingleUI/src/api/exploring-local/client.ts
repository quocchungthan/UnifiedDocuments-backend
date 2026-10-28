import { Injectable } from '@angular/core';
import {
  cafeSchema,
  exploringHealthSchema,
  type Cafe,
  type CafeSearch,
  type ExploringHealth,
} from '../../contracts/exploring-local';
import { searchParams } from '../../domains/exploring-local/search';
import { requestJson } from '../http/request';

export interface ExploringApi {
  health(): Promise<ExploringHealth>;
  search(input: CafeSearch): Promise<Cafe[]>;
}

@Injectable({ providedIn: 'root' })
export class ExploringClient implements ExploringApi {
  health() {
    return requestJson('exploring', '/api/health', exploringHealthSchema, { timeout: 10_000 });
  }

  search(input: CafeSearch) {
    const query = searchParams(input);
    return requestJson('exploring', `/api/cafes?${query}`, cafeSchema.array(), {
      timeout: 240_000,
    });
  }
}
