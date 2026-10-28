import { demoSnapshot } from './demo';
import { fitView, layoutNetwork, networkBounds } from './network';
import { agentGroups } from './workflow';

it('places the hub, every agent and at most four open sessions per agent', () => {
  const snapshot = demoSnapshot();
  const [first] = agentGroups(snapshot);
  const open = Array.from({ length: 6 }, (_, index) => ({ ...snapshot.sessions[0], sessionId: `s${index}`, state: 'working' }));
  const { nodes, edges } = layoutNetwork([{ ...first, open, running: 6 }], open);
  expect(nodes.filter((node) => node.kind === 'session')).toHaveLength(4);
  expect(nodes[0]).toMatchObject({ kind: 'hub', running: 6 });
  expect(edges.every((edge) => edge.tone === 'hot')).toBe(true);
});

it('fits content into the viewport within the zoom limits', () => {
  const bounds = networkBounds([{ kind: 'hub', x: 0, y: 0 }]);
  expect(fitView(bounds, 4000, 4000).scale).toBe(1.6);
  const wide = networkBounds([{ kind: 'hub', x: -20000, y: 0 }, { kind: 'hub', x: 20000, y: 0 }]);
  const view = fitView(wide, 800, 600);
  expect(view.scale).toBe(0.2);
  expect(view.x).toBe(400);
});
