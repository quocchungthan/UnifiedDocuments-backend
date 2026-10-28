import { Injectable, inject } from '@angular/core';
import { SOURCE_SELECTION, ServiceSource } from '../substitution/source';
import { MailClient, type MailApi } from './client';
import { MailSubstitute } from './substitute';

@Injectable({ providedIn: 'root' })
export class MailSource extends ServiceSource<MailApi> {
  constructor() {
    const selection = inject(SOURCE_SELECTION);
    super('mail', inject(MailClient), new MailSubstitute(selection.scenario), selection);
  }
}
