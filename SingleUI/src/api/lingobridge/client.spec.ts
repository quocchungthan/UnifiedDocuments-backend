import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceRequestError } from '../http/request';
import { LingoBridgeClient } from './client';
import { LingoBridgeSubstitute } from './substitute';

const config = { maxSizeBytes: 20_000_000, accept: ['.pdf', 'application/pdf'], languagePairs: [{ source: 'en', target: 'vi' }] };
afterEach(() => vi.unstubAllGlobals());

describe('LingoBridge API contract', () => {
  it('uses the original same-origin API endpoints and validates responses', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(config), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    expect(await new LingoBridgeClient().config()).toEqual(config);
    expect(fetch.mock.calls[0][0]).toBe('/api/config');
    expect(fetch.mock.calls[0][1].headers.Accept).toBe('application/json');
  });

  it('keeps an unauthenticated session explicit but surfaces malformed success bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'Sign in required' }), { status: 401, headers: { 'content-type': 'application/problem+json' } })));
    expect(await new LingoBridgeClient().session()).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ email: 'not-an-email' }), { headers: { 'content-type': 'application/json' } })));
    await expect(new LingoBridgeClient().session()).rejects.toThrow();
  });
});

describe('LingoBridge substitute scenarios', () => {
  it('provides realistic public and private records, while empty and signed-out states stay distinct', async () => {
    const sample = new LingoBridgeSubstitute('default');
    expect((await sample.publicUploads()).length).toBeGreaterThan(0);
    expect((await sample.myUploads()).length).toBeGreaterThan((await sample.publicUploads()).length);
    expect(await new LingoBridgeSubstitute('empty').publicUploads()).toEqual([]);
    expect(await new LingoBridgeSubstitute('signed-out').session()).toBeNull();
    const created = await sample.create(new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }), { source: 'en', target: 'vi' });
    expect(created.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('exposes failure/loading as intentional scenarios and never labels rejected commands as server work', async () => {
    await expect(new LingoBridgeSubstitute('failure').config()).rejects.toBeInstanceOf(ServiceRequestError);
    const pending = new LingoBridgeSubstitute('loading').config();
    expect(await Promise.race([pending.then(() => false), Promise.resolve(true)])).toBe(true);
  });
});
