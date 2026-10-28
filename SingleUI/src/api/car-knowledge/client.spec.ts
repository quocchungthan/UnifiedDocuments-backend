import { afterEach, describe, expect, it, vi } from 'vitest';
import { serviceUrl, ServiceRequestError, ServiceUnavailableError } from '../http/request';
import { CarAssemblyClient } from './assemblies';
import { CarKnowledgeClient } from './client';
import { CarTranscriptClient } from './transcripts';

describe('Standalone car API boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('routes graph, assembly, assets and transcript commands to car without changing Bridge', async () => {
    const vehicle = {
      id: 'fixture', make: 'Synthetic', model: 'Test', year: 2019,
      market: 'unknown', variant: 'unknown', provenance: 'Test fixture only.',
    };
    const saved = {
      videoId: 'abcdefghijk', path: 'transcripts/abcdefghijk/en.txt', language: 'en', status: 'saved',
    };
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      const body = path === '/api/car-knowledge'
        ? { version: 1, updatedAt: '2026-10-25T00:00:00Z', terms: [], relations: [] }
        : path === '/api/cars' ? [vehicle]
        : path.endsWith('/assembly') ? { vehicle, occurrences: [], assets: [] }
        : saved;
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    await new CarKnowledgeClient().graph();
    const assemblies = new CarAssemblyClient();
    await expect(assemblies.vehicles()).resolves.toEqual([vehicle]);
    await assemblies.assembly('fixture/variant');
    const input = { url: 'https://youtu.be/abcdefghijk', language: 'en', title: '', text: 'Synthetic transcript.' };
    await expect(new CarTranscriptClient().submit(input)).resolves.toEqual(saved);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:5311/api/car-knowledge',
      'http://localhost:5311/api/cars',
      'http://localhost:5311/api/cars/fixture%2Fvariant/assembly',
      'http://localhost:5311/api/car-transcripts',
    ]);
    expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: 'POST', body: JSON.stringify(input) });
    expect(assemblies.assetUrl('a'.repeat(64))).toBe(`http://localhost:5311/api/car-assets/${'a'.repeat(64)}`);
    expect(serviceUrl('bridge', '/api/snapshot')).toBe('http://localhost:5310/api/snapshot');
  });

  it('surfaces car unavailability and transcript conflicts without falling back to Bridge', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ error: 'Unavailable or already saved.' }), {
        status: String(url).endsWith('/api/car-transcripts') ? 409 : 503,
        headers: { 'content-type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new CarKnowledgeClient().graph()).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(new CarTranscriptClient().submit({
      url: 'https://youtu.be/abcdefghijk', language: 'en', title: '', text: 'Synthetic transcript.',
    })).rejects.toBeInstanceOf(ServiceRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('http://localhost:5311/'))).toBe(true);
  });
});
