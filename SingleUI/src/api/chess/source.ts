import { Injectable, inject } from '@angular/core';
import { SOURCE_SELECTION, ServiceSource } from '../substitution/source';
import { ChessClient, type ChessApi } from './client';
import { ChessSubstitute } from './substitute';

@Injectable({ providedIn: 'root' })
export class ChessSource extends ServiceSource<ChessApi> {
  constructor() {
    const selection = inject(SOURCE_SELECTION);
    super('chess', inject(ChessClient), new ChessSubstitute(selection.scenario), selection);
  }
}
