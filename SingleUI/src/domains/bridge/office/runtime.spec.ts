import { demoSnapshot } from '../demo';
import { deriveSharedOfficeModel } from './model';
import { createSharedOfficeRuntime, reduceSharedOffice } from './runtime';
import { OFFICE_LAYOUT } from './layout';
import { findRoute, isWalkable, sharedWorkerPath, pathDuration } from './routes';
import { samplePath, sampleCharacterPose } from './motion';

describe('Original office simulation', () => {
  const snapshot = (count: number) => {
    const base = demoSnapshot();
    return {
      ...base,
      roles: ['coder'],
      delegations: [],
      sessions: Array.from({ length: count }, (_, index) => ({
        ...base.sessions[0],
        sessionId: `worker-${index}`,
        agent: 'coder',
        state: 'working' as const,
      })),
    };
  };
  it('caps workers at ten, preserves seats and reveals overflow without evicting the selected worker', () => {
    const model = deriveSharedOfficeModel(snapshot(14));
    const state = createSharedOfficeRuntime(model, true, 0);
    expect(state.workers).toHaveLength(10);
    expect(new Set(state.workers.map((worker) => worker.seatId)).size).toBe(10);
    const selected = state.workers[0].sessionId;
    const unseen = model.sessionIds.find(
      (id) => !state.workers.some((worker) => worker.sessionId === id),
    )!;
    const next = reduceSharedOffice(
      reduceSharedOffice(state, {
        type: 'select',
        selection: { kind: 'session', sessionId: selected },
      }),
      { type: 'revealWorker', sessionId: unseen, nowMs: 100 },
    );
    expect(next.workers.some((worker) => worker.sessionId === selected)).toBe(true);
    expect(next.workers.some((worker) => worker.sessionId === unseen)).toBe(true);
    expect(next.workers).toHaveLength(10);
    expect(reduceSharedOffice(state, { type: 'snapshot', model, nowMs: 100 }).workers).toEqual(
      state.workers,
    );
  });
  it('bounds arrival transitions, settles completed paths and reconciles offline without replay', () => {
    const initial = createSharedOfficeRuntime(deriveSharedOfficeModel(snapshot(1)), true, 0);
    const next = reduceSharedOffice(initial, {
      type: 'snapshot',
      model: deriveSharedOfficeModel(snapshot(8)),
      nowMs: 100,
    });
    expect(next.workers.filter((worker) => worker.phase !== 'seated').length).toBeLessThanOrEqual(
      2,
    );
    expect(next.queue.filter((event) => event.startedAt !== undefined).length).toBeLessThanOrEqual(
      2,
    );
    const entering = next.workers.find((worker) => worker.phase === 'entering')!;
    const path = sharedWorkerPath(OFFICE_LAYOUT, entering, next.model, next.workers);
    const settled = reduceSharedOffice(next, { type: 'tick', nowMs: 101 + pathDuration(path) });
    expect(settled.workers.find((worker) => worker.sessionId === entering.sessionId)?.phase).toBe(
      'seated',
    );
    const offline = reduceSharedOffice(next, { type: 'connectivity', online: false, nowMs: 200 });
    const quiet = reduceSharedOffice(offline, {
      type: 'snapshot',
      model: deriveSharedOfficeModel(snapshot(10)),
      nowMs: 300,
    });
    expect(quiet.queue).toHaveLength(0);
    expect(quiet.workers.every((worker) => worker.phase === 'seated')).toBe(true);
  });
  it('routes through walkable circulation nodes and respects reduced motion', () => {
    const route = findRoute(OFFICE_LAYOUT, OFFICE_LAYOUT.entry, OFFICE_LAYOUT.seats[0].approach);
    expect(route.length).toBeGreaterThan(2);
    expect(route.slice(1, -1).every((point) => isWalkable(OFFICE_LAYOUT, point))).toBe(true);
    expect(samplePath(route, 0, 2.2, true).position).toEqual(route.at(-1));
    expect(
      sampleCharacterPose('coder', 1234, { activity: 'working', reducedMotion: true }).breath,
    ).toBe(0);
  });
});
