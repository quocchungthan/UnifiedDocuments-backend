import { afterEach, describe, expect, it, vi } from 'vitest';
import { VehicleDocumentsClient } from './vehicle-documents';

describe('vehicle documents API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads indexed VIN suggestions with an encoded query and abort signal', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('["1HGCM82633A004352"]', {
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);
    const client = new VehicleDocumentsClient();
    const controller = new AbortController();

    const identifiers = await client.identifiers('1HG&', controller.signal);

    expect(identifiers).toEqual(['1HGCM82633A004352']);
    expect(fetch).toHaveBeenCalledWith('/vehicles/identifiers?query=1HG%26', expect.objectContaining({
      signal: controller.signal,
    }));
  });

  it('uses the backend unlinked endpoint and validates its response', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"items":[],"nextCursor":null}', {
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);
    const client = new VehicleDocumentsClient();

    const documents = await client.unlinked();

    expect(documents).toEqual({ items: [], nextCursor: null });
    expect(fetch).toHaveBeenCalledWith('/documents/unlinked', expect.any(Object));
  });

  it('passes the next cursor back to the backend without interpreting it', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"items":[],"nextCursor":null}', {
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);
    const client = new VehicleDocumentsClient();

    await client.unlinked('opaque+/=');

    expect(fetch).toHaveBeenCalledWith(
      '/documents/unlinked?cursor=opaque%2B%2F%3D', expect.any(Object),
    );
  });

  it('rejects invalid metadata rather than displaying a success-shaped empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[{"fileName":"broken"}]', {
      headers: { 'Content-Type': 'application/json' },
    })));
    const client = new VehicleDocumentsClient();

    await expect(client.unlinked()).rejects.toThrow();
  });

  it('keeps content links on the backend proxy with encoded identifiers', () => {
    const client = new VehicleDocumentsClient();
    const document = {
      sourceName: 'Warranty', sourceDocumentId: 'claim #1', fileName: 'claim.pdf',
      contentType: 'application/pdf', businessKey: null, modifiedAt: null,
    };

    expect(client.contentUrl(document)).toBe('/documents/Warranty/claim%20%231/content');
    expect(client.contentUrl(document, true)).toBe('/documents/Warranty/claim%20%231/content?download=true');
  });
});
