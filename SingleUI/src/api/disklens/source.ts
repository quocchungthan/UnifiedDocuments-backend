import { Injectable, inject } from '@angular/core';
import { SOURCE_SELECTION, ServiceSource } from '../substitution/source';
import { DiskLensClient } from './client';
import { DiskLensSubstitute } from './substitute';

@Injectable({ providedIn: 'root' })
export class DiskLensSource extends ServiceSource<DiskLensClient> {
  constructor() {
    const selection = inject(SOURCE_SELECTION);
    super('disklens', inject(DiskLensClient), new DiskLensSubstitute(selection.scenario), selection);
  }
}
