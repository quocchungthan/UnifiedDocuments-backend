import type { Assignment } from '../../contracts/bridge';
import { demoSnapshot } from './demo';
import {
  actionOf,
  assignmentColumn,
  linkedSessionTitle,
  logMatches,
  parseLog,
  tasksInPhase,
  throughput,
} from './workflow';

const base = () => demoSnapshot().sessions[0];

it('chooses the human action from the session question and hides it for active work', () => {
  expect(actionOf({ ...base(), state: 'needs_human', question: 'Please approve the plan' })).toBe('approve');
  expect(actionOf({ ...base(), state: 'needs_human', question: 'Which font?' })).toBe('answer');
  expect(actionOf({ ...base(), state: 'blocked', question: undefined })).toBe('review');
  expect(actionOf({ ...base(), state: 'working' })).toBeNull();
});

it('maps assignment work states to the four board columns', () => {
  const column = (workState: string) => assignmentColumn({ workState } as Assignment);
  expect(['queued', 'running', 'needs_human', 'cancelled'].map(column)).toEqual(['queued', 'running', 'waiting', 'finished']);
});

it('replaces placeholder titles with the active linked assignment title', () => {
  const session = { ...base(), title: 'Bridge message 12' };
  const assignments = [
    { protocol: 2, targetId: session.sessionId, workState: 'done', title: 'Old' },
    { protocol: 2, targetId: session.sessionId, workState: 'running', title: 'Current' },
  ] as Assignment[];
  expect(linkedSessionTitle(session, assignments)).toBe('Current');
});

it('lists delivered work only once it is done with a result', () => {
  const delivered = { ...base(), phase: 'delivered', state: 'working', result: 'ok' };
  expect(tasksInPhase([delivered], 'delivered')).toEqual([]);
  expect(tasksInPhase([{ ...delivered, state: 'done' }], 'delivered')).toHaveLength(1);
});

it('buckets started and completed sessions by hour inside the window only', () => {
  const now = Date.UTC(2026, 0, 1, 12, 30);
  const at = (hour: number) => new Date(Date.UTC(2026, 0, 1, hour, 5)).toISOString();
  const session = (start: string, state: string, updatedAt: string) => ({
    ...base(), state, updatedAt, progress: [{ ts: start, note: 'start' }],
  });
  const result = throughput([session(at(10), 'done', at(12)), session(at(-2), 'working', at(11))], now, 3);
  expect(result.started).toEqual([1, 0, 0]);
  expect(result.done).toEqual([0, 0, 1]);
});

it('parses log levels, marks successful INFO lines OK and keeps continuation lines on the previous level', () => {
  const rows = parseLog([
    '2026-01-01T10:00:00Z INFO [Scan] pass #4',
    '2026-01-01T10:00:01Z INFO [Queue] task done',
    '2026-01-01T10:00:02Z WARN [Queue] slow',
    '   at stack frame',
    '2026-01-01T10:00:03Z DEBUG noise',
  ]);
  expect(rows.map((row) => row.level)).toEqual(['INFO', 'OK', 'WARN', 'WARN', 'DEBUG']);
  expect(rows[0]).toMatchObject({ time: '10:00:00', component: 'Scan', message: 'pass #4', continued: false });
  expect(rows[3].continued).toBe(true);
  expect(logMatches('DEBUG', 'ALL')).toBe(false);
  expect(logMatches('DEBUG', 'DEBUG')).toBe(true);
});
