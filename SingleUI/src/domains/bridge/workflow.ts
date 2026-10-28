import type { Assignment, Session, Snapshot } from '../../contracts/bridge';
import { agentOf, columnOf } from './sessions';

export const needsHumanInput = (session: Session) =>
  session.state === 'needs_human' ||
  (session.state !== 'done' && session.needs.some((need) => need.resolver === 'human'));

export const titleOf = (session: Session) =>
  session.title && !session.title.startsWith('(')
    ? session.title
    : (session.task?.slice(0, 70) ?? session.sessionId);

const finished = (state?: string) => ['done', 'failed', 'cancelled'].includes(state ?? '');

export function linkedSessionTitle(session: Session, assignments: readonly Assignment[] = []) {
  if (session.title && !session.title.startsWith('(') && !session.title.startsWith('Bridge message '))
    return session.title;
  const linked = assignments.filter((item) => item.protocol === 2 && item.targetId === session.sessionId);
  return (
    linked.find((item) => !finished(item.workState))?.title || linked.at(-1)?.title || titleOf(session)
  );
}

export type ExecutionKey = 'needsInput' | 'workingStale' | 'working' | 'pendingIdle' | 'waitingIdle' | 'other';
export function executionKey(session: Session): ExecutionKey {
  if (needsHumanInput(session)) return 'needsInput';
  if (session.state === 'working') return session.stale || session.silent ? 'workingStale' : 'working';
  if (session.state === 'pending') return 'pendingIdle';
  if (session.state === 'waiting_input') return 'waitingIdle';
  return 'other';
}

export const TASK_PHASES = ['analysis', 'approval', 'implementation', 'review', 'delivered'] as const;
export type TaskPhase = (typeof TASK_PHASES)[number];
const byNewest = (a: Session, b: Session) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');

export const tasksInPhase = (sessions: readonly Session[], phase: TaskPhase) =>
  sessions
    .filter(
      (session) =>
        session.phase === phase &&
        session.registered !== false &&
        (phase !== 'delivered' || (session.state === 'done' && !!session.result?.trim())),
    )
    .sort(byNewest);

export const newestFirst = (sessions: readonly Session[]) => [...sessions].sort(byNewest);

export type ActionKey = 'approve' | 'answer' | 'review';
export function actionOf(session: Session): ActionKey | null {
  if (['done', 'working', 'pending'].includes(session.state)) return null;
  if (/\bapprov/i.test(session.question ?? '')) return 'approve';
  return session.question ? 'answer' : 'review';
}

export type AssignmentColumn = 'queued' | 'running' | 'waiting' | 'finished';
export function assignmentColumn(assignment: Assignment): AssignmentColumn {
  if (assignment.workState === 'queued') return 'queued';
  if (assignment.workState === 'running') return 'running';
  return finished(assignment.workState) ? 'finished' : 'waiting';
}
const KNOWN_WORK_STATES = ['queued', 'running', 'waiting', 'blocked', 'needs_human', 'recovery_required', 'done', 'failed', 'cancelled'];
export const unknownWorkState = (assignment: Assignment) => !KNOWN_WORK_STATES.includes(assignment.workState ?? '');

export interface AgentGroup {
  name: string;
  sessions: Session[];
  done: number;
  running: number;
  attention: number;
  open: Session[];
  latest?: string;
}
/** Every observed agent plus defined roles without sessions, busiest first. */
export function agentGroups(snapshot: Snapshot): AgentGroup[] {
  const map = new Map<string, Session[]>();
  for (const session of snapshot.sessions) map.set(agentOf(session), [...(map.get(agentOf(session)) ?? []), session]);
  for (const role of snapshot.roles ?? []) if (!map.has(role)) map.set(role, []);
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, sessions]) => ({
      name,
      sessions,
      done: sessions.filter((session) => session.state === 'done').length,
      running: sessions.filter((session) => session.state === 'working').length,
      attention: sessions.filter((session) => columnOf(session) === 'attention').length,
      open: newestFirst(sessions.filter((session) => session.state !== 'done')),
      latest: sessions
        .flatMap((session) => session.progress)
        .sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''))[0]?.note,
    }));
}

const HOUR = 3_600_000;
/** Sessions started (first progress) and completed per hour, oldest bucket first. */
export function throughput(sessions: readonly Session[], nowMs: number, hours = 12) {
  const start = Math.floor(nowMs / HOUR) * HOUR - (hours - 1) * HOUR;
  const started = Array<number>(hours).fill(0);
  const done = Array<number>(hours).fill(0);
  const bucket = (iso?: string | null) => (iso ? Math.floor((new Date(iso).getTime() - start) / HOUR) : -1);
  for (const session of sessions) {
    const first = session.progress.map((entry) => entry.ts).filter(Boolean).sort()[0] ?? session.updatedAt;
    const begun = bucket(first);
    if (begun >= 0 && begun < hours) started[begun]++;
    const completed = session.state === 'done' ? bucket(session.updatedAt) : -1;
    if (completed >= 0 && completed < hours) done[completed]++;
  }
  return { start, started, done, hours: Array.from({ length: hours }, (_, index) => start + index * HOUR) };
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
export function health(snapshot: Snapshot) {
  const groups = agentGroups(snapshot);
  const delegations = snapshot.delegations;
  return {
    completion: percent(snapshot.sessions.filter((session) => session.state === 'done').length, snapshot.sessions.length),
    utilization: percent(groups.filter((group) => group.running > 0).length, groups.length),
    delegations: percent(delegations.filter((item) => item.status === 'result_fed').length, delegations.length),
  };
}

export const LOG_LEVELS = ['ALL', 'INFO', 'OK', 'WARN', 'ERROR', 'DEBUG'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export interface LogRow {
  key: string;
  time: string;
  level: string;
  component: string;
  message: string;
  continued: boolean;
}
// Bridge writes DEBUG/INFO/WARN/ERROR; INFO lines reporting success are shown as OK.
const OK_PATTERN = /\b(done|delivered|result_fed|started)\b|assigned ->/;
const LINE_PATTERN = /^\S+T(\d\d:\d\d:\d\d)\S*\s+(\w+)\s+(?:\[([^\]]+)\]\s+)?(.*)$/;
export function parseLog(lines: readonly string[]): LogRow[] {
  const seen = new Map<string, number>();
  let previous = 'INFO';
  return lines.slice(-200).map((line) => {
    const count = (seen.get(line) ?? 0) + 1;
    seen.set(line, count);
    const key = `${line}#${count}`;
    const match = line.match(LINE_PATTERN);
    if (!match) return { key, time: '', level: previous, component: '', message: line, continued: true };
    previous = match[2] === 'INFO' && OK_PATTERN.test(match[4]) ? 'OK' : match[2];
    return { key, time: match[1], level: previous, component: match[3] ?? '', message: match[4], continued: false };
  });
}
/** "ALL" hides DEBUG chatter; the DEBUG filter shows it on demand. */
export const logMatches = (level: string, wanted: LogLevel) =>
  wanted === 'ALL' ? level !== 'DEBUG' : level === wanted;
export const lastScanPass = (lines: readonly string[]) =>
  [...lines].reverse().find((line) => line.includes('pass #'))?.match(/pass #\d+/)?.[0];
