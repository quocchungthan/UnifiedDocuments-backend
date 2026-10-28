import { Injectable, inject } from '@angular/core';
import { SOURCE_SELECTION, ServiceSource } from '../substitution/source';
import { ProductionCoreClient, type ProductionCoreApi } from './client';
import { ProductionCoreSubstitute } from './substitute';

@Injectable({ providedIn: 'root' })
export class ProductionCoreSource extends ServiceSource<ProductionCoreApi> {
  constructor() {
    const selection = inject(SOURCE_SELECTION);
    super(
      'productioncore',
      inject(ProductionCoreClient),
      new ProductionCoreSubstitute(selection.scenario),
      selection,
    );
  }
}
