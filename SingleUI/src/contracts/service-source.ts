/**
 * Service-source contract (issue #1): every API capability has a live client and a
 * substitute with the same interface. Selection comes from the page URL:
 *   ?api=auto|live|substitute  (default auto: live first, substitute when unreachable)
 *   &scenario=default|signed-out|empty|failure|loading  (substitute data shape)
 * Scenarios exist so visual tests can render every authentication and data state.
 */
export const sourcePolicies = ['auto', 'live', 'substitute'] as const;
export type SourcePolicy = (typeof sourcePolicies)[number];

export const sourceScenarios = ['default', 'signed-out', 'empty', 'failure', 'loading'] as const;
export type SourceScenario = (typeof sourceScenarios)[number];

export type SourceMode = 'live' | 'substitute';
/** Why the substitute is active: requested by policy/user, or live was unreachable. */
export type SubstituteReason = 'selected' | 'unavailable';

export interface SourceSelection {
  readonly policy: SourcePolicy;
  readonly scenario: SourceScenario;
}

export const defaultSelection: SourceSelection = { policy: 'auto', scenario: 'default' };

export function parseSourceSelection(search: string): SourceSelection {
  const query = new URLSearchParams(search);
  const policy = query.get('api') ?? defaultSelection.policy;
  const scenario = query.get('scenario') ?? defaultSelection.scenario;
  if (!sourcePolicies.includes(policy as SourcePolicy))
    throw new Error(`Unknown api policy "${policy}". Use ${sourcePolicies.join(', ')}.`);
  if (!sourceScenarios.includes(scenario as SourceScenario))
    throw new Error(`Unknown scenario "${scenario}". Use ${sourceScenarios.join(', ')}.`);
  if (scenario !== 'default' && policy !== 'substitute')
    throw new Error('Scenarios apply only with api=substitute.');
  return { policy: policy as SourcePolicy, scenario: scenario as SourceScenario };
}
