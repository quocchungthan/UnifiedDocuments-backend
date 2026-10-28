import type { Session } from '../../contracts/bridge';
import { columnOf } from './sessions';
import type { AgentGroup } from './workflow';

export const NETWORK_SIZES = {
  hub: { width: 150, height: 150 },
  agent: { width: 216, height: 92 },
  session: { width: 184, height: 48 },
} as const;
const MAX_SESSIONS = 4;

export type NetworkNode =
  | { id: 'hub'; kind: 'hub'; x: number; y: number; running: number }
  | { id: string; kind: 'agent'; x: number; y: number; group: AgentGroup }
  | { id: string; kind: 'session'; x: number; y: number; agent: string; session: Session };
export interface NetworkEdge {
  id: string;
  from: string;
  to: string;
  tone: 'hot' | 'warn' | 'calm';
}

/**
 * Radial layout: Bridge hub, agents on a ring, up to four newest open sessions beyond each agent.
 * The ring is stretched along the longer side of the viewport (aspect = width / height) so it fills it.
 */
export function layoutNetwork(groups: readonly AgentGroup[], sessions: readonly Session[], aspect = 1) {
  const nodes: NetworkNode[] = [
    { id: 'hub', kind: 'hub', x: 0, y: 0, running: sessions.filter((session) => session.state === 'working').length },
  ];
  const edges: NetworkEdge[] = [];
  const count = Math.max(1, groups.length);
  const radius = Math.max(180, count * 44);
  const outer = radius + 190;
  const stretch = Math.min(2.4, Math.max(0.5, aspect));
  const sx = Math.max(1, stretch);
  const sy = Math.max(1, 1 / stretch);
  groups.forEach((group, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const id = `agent:${group.name}`;
    nodes.push({ id, kind: 'agent', x: Math.cos(angle) * radius * sx, y: Math.sin(angle) * radius * sy, group });
    edges.push({ id: `edge:${group.name}`, from: 'hub', to: id, tone: group.running ? 'hot' : 'calm' });
    const shown = group.open.slice(0, MAX_SESSIONS);
    shown.forEach((session, slot) => {
      const spread = angle + (slot - (shown.length - 1) / 2) * (0.5 / Math.max(1, count / 5));
      const sessionId = `session:${session.sessionId}`;
      nodes.push({
        id: sessionId,
        kind: 'session',
        x: Math.cos(spread) * outer * sx,
        y: Math.sin(spread) * outer * sy,
        agent: group.name,
        session,
      });
      edges.push({
        id: `edge:${session.sessionId}`,
        from: id,
        to: sessionId,
        tone: session.state === 'working' ? 'hot' : columnOf(session) === 'attention' ? 'warn' : 'calm',
      });
    });
  });
  return { nodes, edges };
}

export function networkBounds(nodes: readonly Pick<NetworkNode, 'kind' | 'x' | 'y'>[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const size = NETWORK_SIZES[node.kind];
    minX = Math.min(minX, node.x - size.width / 2);
    maxX = Math.max(maxX, node.x + size.width / 2);
    minY = Math.min(minY, node.y - size.height / 2);
    maxY = Math.max(maxY, node.y + size.height / 2);
  }
  return nodes.length ? { minX, minY, maxX, maxY } : { minX: -100, minY: -100, maxX: 100, maxY: 100 };
}

/** Scale and offset that fit the bounds into a viewport with proportional padding. */
export function fitView(
  bounds: ReturnType<typeof networkBounds>,
  width: number,
  height: number,
  padding = 0.12,
  limits = { min: 0.2, max: 1.6 },
) {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const scale = Math.min(
    limits.max,
    Math.max(limits.min, Math.min((width * (1 - padding)) / contentWidth, (height * (1 - padding)) / contentHeight)),
  );
  return {
    scale,
    x: width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    y: height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
  };
}
