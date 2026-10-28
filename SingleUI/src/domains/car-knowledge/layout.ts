import type { CarKnowledge, KnowledgeRelation, KnowledgeTerm } from '../../contracts/car-knowledge';

/** Hierarchy root (`part-of`/`is-a` climb to it) and the map's starting focus. */
export const ROOT_TERM_ID = 'car';

export interface Neighbour {
  term: KnowledgeTerm;
  relation: KnowledgeRelation;
  /** `out` when the focused term is the relation's `from`. */
  direction: 'out' | 'in';
}

/** A term positioned around the focus; x/y are CSS pixels from the focus, unbounded (the view pans). */
export interface PlacedTerm {
  term: KnowledgeTerm;
  /** 1 for the focus; otherwise the product of closeness along the strongest path, 0 when unconnected. */
  proximity: number;
  /** The direct relation to the focus, or null for the focus and indirect terms. */
  neighbour: Neighbour | null;
  /** Intermediate terms on the strongest path from the focus (empty for direct neighbours). */
  via: KnowledgeTerm[];
  x: number;
  y: number;
  scale: number;
}

/** Rendered width in CSS pixels of a label at a font scale (rem), used to keep labels apart. */
export type MeasureLabel = (label: string, scale: number) => number;

export interface LayoutOptions {
  /** Most related terms to place besides the focus (default: all). */
  limit?: number;
  measure?: MeasureLabel;
}

const FOCUS_SCALE = 2;
const ROOT_PX = 16;
/** Ideal distance for a perfectly related term, plus how much further a weaker one goes. */
const NEAR_PX = 110;
const SPREAD_PX = 560;
/** Wider than tall, to suit landscape canvases. */
const X_STRETCH = 1.45;
const GAP_PX = 10;
const RADIUS_STEP_PX = 14;
const ANGLE_STEP = 0.09;

/** Width estimate when no measuring context is available (tests, SSR). */
export const estimateLabel: MeasureLabel = (label, scale) => label.length * 0.58 * scale * ROOT_PX;

/** `car` when present, otherwise the most connected term. */
export function defaultFocus(graph: CarKnowledge): string | null {
  if (graph.terms.some((term) => term.id === ROOT_TERM_ID)) return ROOT_TERM_ID;
  const degree = new Map<string, number>();
  for (const { from, to } of graph.relations)
    for (const id of [from, to]) degree.set(id, (degree.get(id) ?? 0) + 1);
  let best: KnowledgeTerm | null = null;
  for (const term of graph.terms)
    if (!best || (degree.get(term.id) ?? 0) > (degree.get(best.id) ?? 0)) best = term;
  return best?.id ?? null;
}

/** Terms directly related to `focusId`, strongest connection per term, closest first. */
export function neighbours(graph: CarKnowledge, focusId: string): Neighbour[] {
  const terms = new Map(graph.terms.map((term) => [term.id, term]));
  const best = new Map<string, Neighbour>();
  for (const relation of graph.relations) {
    const direction = relation.from === focusId ? 'out' : relation.to === focusId ? 'in' : null;
    if (!direction) continue;
    const term = terms.get(direction === 'out' ? relation.to : relation.from);
    if (!term || term.id === focusId) continue;
    const current = best.get(term.id);
    if (!current || relation.closeness > current.relation.closeness) best.set(term.id, { term, relation, direction });
  }
  return [...best.values()].sort(
    (a, b) => b.relation.closeness - a.relation.closeness || a.term.label.localeCompare(b.term.label),
  );
}

/**
 * Strongest path from the focus to every term, treating relations as undirected and
 * scoring a path by the product of its closeness values (Dijkstra on the maximum product).
 */
export function proximities(graph: CarKnowledge, focusId: string) {
  const edges = new Map<string, { id: string; closeness: number }[]>();
  for (const { from, to, closeness } of graph.relations) {
    if (from === to) continue;
    (edges.get(from) ?? edges.set(from, []).get(from)!).push({ id: to, closeness });
    (edges.get(to) ?? edges.set(to, []).get(to)!).push({ id: from, closeness });
  }
  const score = new Map<string, number>([[focusId, 1]]);
  const previous = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let current: string | null = null;
    for (const [id, value] of score) if (!done.has(id) && (current === null || value > score.get(current)!)) current = id;
    if (current === null) break;
    done.add(current);
    for (const { id, closeness } of edges.get(current) ?? []) {
      const value = score.get(current)! * closeness;
      if (!done.has(id) && value > (score.get(id) ?? 0)) {
        score.set(id, value);
        previous.set(id, current);
      }
    }
  }
  const path = (id: string) => {
    const ids: string[] = [];
    for (let step = previous.get(id); step && step !== focusId; step = previous.get(step)) ids.unshift(step);
    return ids;
  };
  return { score, path };
}

/**
 * Focus in the centre, every other term around it: the stronger its path to the focus, the
 * nearer and larger it is. Each term keeps a stable direction; when its label would collide it
 * slides sideways, then outwards, with no outer bound, so weak terms may sit off-screen.
 */
export function layoutFocus(graph: CarKnowledge, focusId: string, options: LayoutOptions = {}): PlacedTerm[] {
  const { limit = Infinity, measure = estimateLabel } = options;
  const focus = graph.terms.find((term) => term.id === focusId);
  if (!focus) return [];
  const terms = new Map(graph.terms.map((term) => [term.id, term]));
  const direct = new Map(neighbours(graph, focusId).map((neighbour) => [neighbour.term.id, neighbour]));
  const { score, path } = proximities(graph, focusId);
  const others = graph.terms
    .filter((term) => term.id !== focusId)
    .map((term) => ({ term, proximity: score.get(term.id) ?? 0 }))
    .sort((a, b) => b.proximity - a.proximity || a.term.label.localeCompare(b.term.label))
    .slice(0, limit);

  const placed: PlacedTerm[] = [{ term: focus, proximity: 1, neighbour: null, via: [], x: 0, y: 0, scale: FOCUS_SCALE }];
  const boxes = [box(measure(focus.label, FOCUS_SCALE), FOCUS_SCALE, 0, 0)];
  const turns = Math.ceil((2 * Math.PI) / ANGLE_STEP);
  for (const { term, proximity } of others) {
    const neighbour = direct.get(term.id) ?? null;
    const scale = round(0.72 + proximity * 0.6);
    const width = measure(term.label, scale);
    const start = angleOf(term.id);
    let spot: Box | null = null;
    for (let radius = NEAR_PX + (1 - proximity) * SPREAD_PX; !spot; radius += RADIUS_STEP_PX) {
      for (let attempt = 0; attempt < turns && !spot; attempt++) {
        const angle = start + Math.ceil(attempt / 2) * ANGLE_STEP * (attempt % 2 ? 1 : -1);
        const candidate = box(width, scale, Math.cos(angle) * radius * X_STRETCH, Math.sin(angle) * radius);
        if (!boxes.some((other) => overlaps(candidate, other))) spot = candidate;
      }
    }
    boxes.push(spot);
    placed.push({
      term,
      proximity: round(proximity),
      neighbour,
      via: neighbour ? [] : path(term.id).flatMap((id) => terms.get(id) ?? []),
      x: Math.round(spot.x),
      y: Math.round(spot.y),
      scale,
    });
  }
  return placed;
}

/** Labels are centred on their point; w/h are half-extents in pixels. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const box = (width: number, scale: number, x: number, y: number): Box => ({
  x,
  y,
  w: width / 2,
  h: (scale * ROOT_PX * 1.25) / 2,
});

const overlaps = (a: Box, b: Box) =>
  Math.abs(a.x - b.x) < a.w + b.w + GAP_PX && Math.abs(a.y - b.y) < a.h + b.h + GAP_PX;

/** Stable pseudo-random angle per term id, so terms keep their direction between renders. */
function angleOf(id: string) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return ((hash >>> 0) / 2 ** 32) * 2 * Math.PI;
}

const round = (value: number) => Math.round(value * 1000) / 1000;
