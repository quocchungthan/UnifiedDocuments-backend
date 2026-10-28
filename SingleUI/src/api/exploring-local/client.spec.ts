import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExploringClient } from './client';

const cafe = {
  name: 'Sample café',
  address: 'Thảo Điền',
  rating: 4.6,
  reviews: 120,
  sourceUrl: 'https://example.com/guide',
};

describe('Exploring Local API contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('queries the local service with validated district filters', async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify([cafe]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new ExploringClient();
    await expect(
      client.search({ district: 'Thảo Điền', minRating: 4.4, minReviews: 50 }),
    ).resolves.toEqual([cafe]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:5312/api/cafes?minRating=4.4&minReviews=50&district=Th%E1%BA%A3o+%C4%90i%E1%BB%81n',
    );
  });

  it('validates health responses and rejects malformed result data', async () => {
    const fetchMock = vi.fn(
      async (url: string | URL | Request) =>
        new Response(
          JSON.stringify(
            String(url).endsWith('/api/health')
              ? { ok: true, tool: 'Exploring Local', copilotReady: true }
              : [{ ...cafe, rating: 8 }],
          ),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new ExploringClient();
    await expect(client.health()).resolves.toMatchObject({ copilotReady: true });
    await expect(
      client.search({ district: 'District 2', minRating: 4, minReviews: 0 }),
    ).rejects.toThrow();
  });
});
