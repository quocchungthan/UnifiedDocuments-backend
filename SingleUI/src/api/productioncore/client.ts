import { Injectable } from '@angular/core';
import { serviceTargetSchema, type ServiceTarget } from '../../contracts/productioncore';
import { requestJson } from '../http/request';

export interface ProductionCoreApi {
  targets(): Promise<ServiceTarget[]>;
}

@Injectable({ providedIn: 'root' })
export class ProductionCoreClient implements ProductionCoreApi {
  targets() {
    return requestJson('productioncore', '/api/targets', serviceTargetSchema.array(), {
      timeout: 10000,
    });
  }
}
