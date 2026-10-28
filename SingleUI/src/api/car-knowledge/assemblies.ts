import { Injectable } from '@angular/core';
import { z } from 'zod';
import { vehicleAssemblySchema, vehicleModelSchema } from '../../contracts/car-assemblies';
import { requestJson, serviceUrl } from '../http/request';

@Injectable({ providedIn: 'root' })
export class CarAssemblyClient {
  vehicles(signal?: AbortSignal) { return requestJson('car', '/api/cars', z.array(vehicleModelSchema), { signal }); }
  assembly(id: string, signal?: AbortSignal) {
    return requestJson('car', `/api/cars/${encodeURIComponent(id)}/assembly`, vehicleAssemblySchema, { signal });
  }
  assetUrl(id: string) { return serviceUrl('car', `/api/car-assets/${encodeURIComponent(id)}`); }
}
