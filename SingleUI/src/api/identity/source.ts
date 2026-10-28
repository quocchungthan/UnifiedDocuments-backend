import { Injectable, inject } from '@angular/core';
import { SOURCE_SELECTION, ServiceSource } from '../substitution/source';
import { IdentityClient, type IdentityApi } from './client';
import { IdentitySubstitute } from './substitute';

@Injectable({ providedIn: 'root' })
export class IdentitySource extends ServiceSource<IdentityApi> {
  constructor() {
    const selection = inject(SOURCE_SELECTION);
    super(
      'identity',
      inject(IdentityClient),
      new IdentitySubstitute(selection.scenario),
      selection,
    );
  }
}
