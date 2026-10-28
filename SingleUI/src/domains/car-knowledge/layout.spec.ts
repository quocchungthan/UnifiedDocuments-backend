import type { CarKnowledge, KnowledgeRelation } from '../../contracts/car-knowledge';
import { defaultFocus, layoutFocus, neighbours } from './layout';

const term = (id: string) => ({ id, label: id.toUpperCase(), category: 'concept', summary: '', detail: '', sources: [] });
const relation = (from: string, to: string, closeness: number): KnowledgeRelation => ({
  id: `${from}--related-to--${to}`,
  from,
  to,
  kind: 'related-to',
  closeness,
  support: 0,
  summary: '',
  sources: [],
});
const graph: CarKnowledge = {
  version: 1,
  updatedAt: '',
  terms: ['hub', 'near', 'far', 'other', 'lonely'].map(term),
  relations: [relation('hub', 'far', 0.2), relation('near', 'hub', 0.9), relation('hub', 'near', 0.4), relation('far', 'other', 1)],
};
const radius = ({ x, y }: { x: number; y: number }) => Math.hypot(x, y);

it('starts at car when present, otherwise the most connected term', () => {
  expect(defaultFocus(graph)).toBe('hub');
  expect(defaultFocus({ ...graph, terms: [...graph.terms, term('car')] })).toBe('car');
  expect(defaultFocus({ ...graph, terms: [], relations: [] })).toBeNull();
});

it('collects both directions once per term, keeping the closest relation first', () => {
  const found = neighbours(graph, 'hub');
  expect(found.map((n) => [n.term.id, n.direction, n.relation.closeness])).toEqual([
    ['near', 'in', 0.9],
    ['far', 'out', 0.2],
  ]);
});

it('places every term, nearer and larger the stronger its path to the focus', () => {
  const placed = layoutFocus(graph, 'hub');
  const by = (id: string) => placed.find((item) => item.term.id === id)!;
  expect(placed[0]).toMatchObject({ term: { id: 'hub' }, x: 0, y: 0, proximity: 1, neighbour: null });
  expect(placed.map((item) => item.term.id).sort()).toEqual(['far', 'hub', 'lonely', 'near', 'other']);
  expect(by('near')).toMatchObject({ proximity: 0.9, via: [] });
  expect(by('near').neighbour?.relation.closeness).toBe(0.9);
  expect(by('other')).toMatchObject({ proximity: 0.2, neighbour: null, via: [{ id: 'far' }] });
  expect(by('lonely')).toMatchObject({ proximity: 0, neighbour: null, via: [] });
  expect(radius(by('near'))).toBeLessThan(radius(by('far')));
  expect(radius(by('far'))).toBeLessThan(radius(by('lonely')));
  expect(by('near').scale).toBeGreaterThan(by('far').scale);
  expect(layoutFocus(graph, 'missing')).toEqual([]);
  expect(layoutFocus(graph, 'hub', { limit: 1 })).toHaveLength(2);
});

it('prefers the strongest multi-hop path over a weak direct one', () => {
  const chain: CarKnowledge = {
    ...graph,
    relations: [relation('a', 'b', 0.9), relation('b', 'c', 0.9), relation('a', 'c', 0.3)],
    terms: ['a', 'b', 'c'].map(term),
  };
  const c = layoutFocus(chain, 'a').find((item) => item.term.id === 'c')!;
  expect(c.proximity).toBe(0.81);
});

it('never lets measured labels overlap, pushing crowded terms outwards without a bound', () => {
  const many: CarKnowledge = {
    ...graph,
    terms: Array.from({ length: 120 }, (_, index) => term(`a-rather-long-term-${index}`)),
    relations: Array.from({ length: 119 }, (_, index) => relation('a-rather-long-term-0', `a-rather-long-term-${index + 1}`, 0.9)),
  };
  const measure = (label: string, scale: number) => label.length * 0.6 * scale * 16;
  const placed = layoutFocus(many, 'a-rather-long-term-0', { measure });
  const extent = (item: (typeof placed)[number]) => ({
    w: measure(item.term.label.toUpperCase(), item.scale) / 2,
    h: (item.scale * 16 * 1.25) / 2,
  });
  for (const [index, a] of placed.entries())
    for (const b of placed.slice(index + 1)) {
      const [ea, eb] = [extent(a), extent(b)];
      const apart = Math.abs(a.x - b.x) >= ea.w + eb.w + 9 || Math.abs(a.y - b.y) >= ea.h + eb.h + 9;
      expect(apart, `${a.term.id} overlaps ${b.term.id}`).toBe(true);
    }
  expect(Math.max(...placed.map(radius))).toBeGreaterThan(600);
});
