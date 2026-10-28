import { carKnowledgeSchema } from './car-knowledge';

const term = (id: string, extra: object = {}) => ({ id, label: id, category: 'engine', summary: '', detail: '', sources: [], ...extra });
const relation = (from: string, to: string, extra: object = {}) => ({
  id: `${from}--is-a--${to}`, from, to, kind: 'is-a', closeness: 0.5, support: 0, summary: '', sources: [], ...extra,
});

it('drops only invalid terms, relations and sources instead of rejecting the graph', () => {
  const graph = carKnowledgeSchema.parse({
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
    terms: [
      term('car', { sources: [{ url: 'https://en.wikipedia.org/wiki/Car' }, { url: 'not a url' }, { title: 'none' }, { videoId: 'v', at: '00:01:00' }] }),
      term('engine', { summary: 5, aliases: 'x' }),
      { id: 7, label: 'bad' },
      'text',
    ],
    relations: [relation('engine', 'car'), relation('engine', 'ghost'), relation('car', 'engine', { closeness: 3 }), null],
  });
  expect(graph.terms.map((t) => t.id)).toEqual(['car', 'engine']);
  expect(graph.terms[0].sources).toEqual([{ url: 'https://en.wikipedia.org/wiki/Car' }, { videoId: 'v', at: '00:01:00' }]);
  expect(graph.terms[1]).toMatchObject({ summary: '', aliases: undefined });
  expect(graph.relations.map((r) => r.id)).toEqual(['engine--is-a--car']);
});

it('still rejects a response that is not a car knowledge graph', () => {
  expect(carKnowledgeSchema.safeParse({ error: 'nope' }).success).toBe(false);
  expect(carKnowledgeSchema.safeParse([]).success).toBe(false);
});
