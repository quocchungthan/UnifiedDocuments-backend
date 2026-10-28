import { Injectable, inject } from '@angular/core';
import { SOURCE_SELECTION, ServiceSource } from '../substitution/source';
import { FarmAccountClient, type FarmAccountApi } from './account-client';
import { FarmClient, type FarmPortfolioApi } from './client';
import { FarmSubstitute } from './substitute';

export type FarmApi = FarmPortfolioApi & FarmAccountApi;

function combine(portfolio: FarmPortfolioApi, account: FarmAccountApi): FarmApi {
  return {
    load: () => portfolio.load(),
    probe: (endpoint) => portfolio.probe(endpoint),
    visit: (platform) => portfolio.visit(platform),
    check: (tool) => portfolio.check(tool),
    session: () => account.session(),
    dashboard: (days) => account.dashboard(days),
    audience: (url) => account.audience(url),
    keys: () => account.keys(),
    usage: (days) => account.usage(days),
    createKey: (name) => account.createKey(name),
    revokeKey: (id) => account.revokeKey(id),
  };
}

/** One source for the whole Farm backend, so portfolio and account never disagree. */
@Injectable({ providedIn: 'root' })
export class FarmSource extends ServiceSource<FarmApi> {
  constructor() {
    const selection = inject(SOURCE_SELECTION);
    super(
      'farm',
      combine(inject(FarmClient), inject(FarmAccountClient)),
      new FarmSubstitute(selection.scenario),
      selection,
    );
  }
}
