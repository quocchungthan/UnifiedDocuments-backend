export type HunterPose =
  | 'walk'
  | 'run'
  | 'climb'
  | 'jump'
  | 'investigate'
  | 'look'
  | 'idle'
  | 'talk';

export type SurfaceEdge = 'flat' | 'top' | 'bottom' | 'left' | 'right';

export interface HunterCharacterSpec {
  readonly id: string;
  readonly name: string;
  readonly sheetUrl: string;
  readonly initialXRatio?: number;
  readonly speedPxPerSec?: number;
  readonly quotes: {
    readonly en: readonly string[];
    readonly vi: readonly string[];
  };
}

export interface StandableSurface {
  readonly id: string;
  readonly left: number;
  readonly right: number;
  readonly y: number;
  readonly bottom: number;
  readonly climbable: boolean;
  readonly element?: Element;
}

export interface ResolvedStandPoint {
  readonly x: number;
  readonly y: number;
  readonly surfaceId: string;
  readonly u: number;
  readonly v: number;
}

export interface GazeTransform {
  readonly facing: 1 | -1;
  readonly tiltDeg: number;
  readonly lookX: number;
  readonly lookY: number;
}

const EDGE_MARGIN_PX = 48;

/**
 * Finds a reasonable standable position on or within a UI component flat near the actor's document coordinates.
 * Always prefers real UI component surfaces and keeps actors padded inside the component's flat bounds.
 */
export function resolveNearestStandablePoint(
  surfaces: readonly StandableSurface[],
  x: number,
  y: number,
  docWidth: number,
  docHeight: number,
  allowInterior = false,
): ResolvedStandPoint {
  const minX = Math.min(EDGE_MARGIN_PX, Math.max(16, docWidth / 2));
  const maxX = Math.max(minX, docWidth - EDGE_MARGIN_PX);
  const floorY = Math.max(96, docHeight - 24);

  const componentSurfaces = surfaces.filter((s) => s.id !== 'viewport-floor');
  const pool = componentSurfaces.length ? componentSurfaces : surfaces;

  let best: ResolvedStandPoint = {
    x: Math.min(maxX, Math.max(minX, x)),
    y: floorY,
    surfaceId: pool[0]?.id ?? 'viewport-floor',
    u: 0.5,
    v: 0,
  };
  let bestScore = Number.POSITIVE_INFINITY;

  for (const surface of pool) {
    const padX = Math.min(34, Math.max(16, Math.round((surface.right - surface.left) * 0.1)));
    const sMinX = Math.max(minX, surface.left + padX);
    const sMaxX = Math.min(maxX, surface.right - padX);
    if (sMaxX < sMinX) continue;
    const clampedX = Math.min(sMaxX, Math.max(sMinX, x));
    const sMinY = surface.y;
    const sMaxY = allowInterior ? Math.max(surface.y, surface.bottom - 8) : surface.y;
    const clampedY = Math.min(sMaxY, Math.max(sMinY, y));
    const dx = Math.abs(x - clampedX);
    const dy = Math.abs(y - clampedY);
    const score = dx + dy * 1.15;
    if (score < bestScore) {
      bestScore = score;
      const spanX = Math.max(1, surface.right - surface.left);
      const spanY = Math.max(1, surface.bottom - surface.y);
      const u = Math.max(0.08, Math.min(0.92, (clampedX - surface.left) / spanX));
      const v = allowInterior
        ? Math.max(0, Math.min(0.92, (clampedY - surface.y) / spanY))
        : 0;
      best = { x: clampedX, y: clampedY, surfaceId: surface.id, u, v };
    }
  }

  return best;
}

/**
 * Computes the character's facing direction and subtle head/body tilt toward the mouse or touch coordinate.
 */
export function computeGazeTransform(
  actorX: number,
  actorY: number,
  cursorX: number,
  cursorY: number,
): GazeTransform {
  const dx = cursorX - actorX;
  const dy = cursorY - (actorY - 46);
  const facing: 1 | -1 = dx < -4 ? -1 : 1;
  const distance = Math.hypot(dx, dy) || 1;
  const lookX = Math.max(-1, Math.min(1, dx / Math.max(120, distance)));
  const lookY = Math.max(-1, Math.min(1, dy / Math.max(120, distance)));
  const rawTilt = (dy / Math.max(140, Math.abs(dx) + 90)) * 7;
  const tiltDeg = Math.max(-6, Math.min(6, Number.isFinite(rawTilt) ? rawTilt : 0));
  return { facing, tiltDeg, lookX, lookY };
}

/**
 * Selects a random in-character hunter line, avoiding immediate repetition when multiple lines exist.
 */
export function pickRandomQuote(
  quotes: readonly string[],
  previousQuote: string | null,
  random: () => number = Math.random,
): string {
  if (!quotes.length) return '';
  if (quotes.length === 1) return quotes[0];
  const pool = previousQuote ? quotes.filter((item) => item !== previousQuote) : quotes;
  const list = pool.length ? pool : quotes;
  const index = Math.min(list.length - 1, Math.max(0, Math.floor(random() * list.length)));
  return list[index];
}

/**
 * Picks the next varied hunter behavior while preventing repetitive stationary acts.
 */
export function pickNextHunterPose(
  previousPose: HunterPose,
  canClimb: boolean,
  canJump: boolean,
  random: () => number = Math.random,
): HunterPose {
  const candidates: HunterPose[] = ['walk', 'run'];
  if (canClimb) candidates.push('climb', 'climb');
  if (canJump) candidates.push('jump', 'jump');
  if (previousPose !== 'investigate') candidates.push('investigate');
  if (previousPose !== 'look') candidates.push('look');
  if (previousPose !== 'idle' && previousPose !== 'look' && previousPose !== 'investigate') {
    candidates.push('idle');
  }
  const filtered = candidates.filter((pose) => pose !== previousPose);
  const list = filtered.length ? filtered : candidates;
  const index = Math.min(list.length - 1, Math.max(0, Math.floor(random() * list.length)));
  return list[index];
}
