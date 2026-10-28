import { Injectable, inject } from '@angular/core';
import { SOURCE_SELECTION, ServiceSource } from '../substitution/source';
import { BridgeClient, type BridgeApi } from './client';
import { BridgeSubstitute } from './substitute';

@Injectable({ providedIn: 'root' })
export class BridgeSource extends ServiceSource<BridgeApi> {
  constructor() {
    const selection = inject(SOURCE_SELECTION);
    super('bridge', inject(BridgeClient), new BridgeSubstitute(selection.scenario), selection);
  }
}
