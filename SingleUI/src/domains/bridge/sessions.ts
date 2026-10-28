import type { Session } from '../../contracts/bridge';

export function columnOf(session: Session): 'queue' | 'running' | 'attention' | 'done' {
  if (session.stale || session.silent || session.issues?.length) return 'attention';
  if (session.state === 'working') return 'running';
  if (session.state === 'done') return 'done';
  if (
    session.state === 'needs_human' ||
    (session.state === 'blocked' && session.needs.some((need) => need.resolver === 'human'))
  )
    return 'attention';
  return 'queue';
}
export const agentOf = (session: Session) => session.agent || 'Unassigned';
