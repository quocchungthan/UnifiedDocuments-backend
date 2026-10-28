import { Injectable, inject } from '@angular/core';
import { SOURCE_SELECTION, ServiceSource } from '../substitution/source';
import { LingoBridgeClient, type LingoBridgeApi } from './client';
import { LingoBridgeSubstitute } from './substitute';

@Injectable({ providedIn: 'root' })
export class LingoBridgeSource extends ServiceSource<LingoBridgeApi> {
  constructor() {
    const selection = inject(SOURCE_SELECTION);
    super('lingobridge', inject(LingoBridgeClient), new LingoBridgeSubstitute(selection.scenario), selection);
  }
}
