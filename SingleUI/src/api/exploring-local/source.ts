import { Injectable, inject } from '@angular/core';
import { SOURCE_SELECTION, ServiceSource } from '../substitution/source';
import { ExploringClient, type ExploringApi } from './client';
import { ExploringSubstitute } from './substitute';

@Injectable({ providedIn: 'root' })
export class ExploringSource extends ServiceSource<ExploringApi> {
  constructor() {
    const selection = inject(SOURCE_SELECTION);
    super(
      'exploring',
      inject(ExploringClient),
      new ExploringSubstitute(selection.scenario),
      selection,
    );
  }
}
