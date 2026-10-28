import type { ServiceTarget } from '../../contracts/productioncore';
import type { SourceScenario } from '../../contracts/service-source';
import { scenarioResult } from '../substitution/source';
import type { ProductionCoreApi } from './client';

const checkedAt = () => new Date().toISOString();

function sampleTargets(): ServiceTarget[] {
  const time = checkedAt();
  return [
    {
      id: 'sample-api',
      name: 'Application API',
      group: 'Application',
      kind: 'http',
      up: true,
      latencyMs: 38,
      error: null,
      checkedAt: time,
    },
    {
      id: 'sample-worker',
      name: 'Background worker',
      group: 'Application',
      kind: 'http',
      up: true,
      latencyMs: 61,
      error: null,
      checkedAt: time,
    },
    {
      id: 'sample-database',
      name: 'Relational database',
      group: 'Data',
      kind: 'tcp',
      up: true,
      latencyMs: 4,
      error: null,
      checkedAt: time,
    },
    {
      id: 'sample-queue',
      name: 'Message queue',
      group: 'Messaging',
      kind: 'tcp',
      up: false,
      latencyMs: 3001,
      error: 'Connection timed out',
      checkedAt: time,
    },
  ];
}

/** Browser-local examples only; no health checks or commands are sent by this source. */
export class ProductionCoreSubstitute implements ProductionCoreApi {
  constructor(private readonly scenario: SourceScenario) {}

  targets() {
    return scenarioResult('productioncore', this.scenario, {
      default: sampleTargets,
      empty: () => [],
    });
  }
}
