import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { VehicleDocumentsClient } from '../api/cars/vehicle-documents';
import type { UnlinkedDocumentsPage, VehicleDocument } from '../contracts/car-documents';
import { VehicleDocumentsState } from './monitor-state';

const unlinkedDocument: VehicleDocument = {
  sourceName: 'Warranty',
  sourceDocumentId: 'claim-1',
  fileName: 'claim.pdf',
  contentType: 'application/pdf',
  businessKey: null,
  modifiedAt: null,
};

function setup(search = '') {
  const client = {
    identifiers: vi.fn<VehicleDocumentsClient['identifiers']>().mockResolvedValue([]),
    byVin: vi.fn<VehicleDocumentsClient['byVin']>().mockResolvedValue([]),
    unlinked: vi.fn<VehicleDocumentsClient['unlinked']>().mockResolvedValue({ items: [unlinkedDocument], nextCursor: null }),
  };
  const location = { pathname: '/', search, hash: '' };
  const history = { state: null, replaceState: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      VehicleDocumentsState,
      { provide: VehicleDocumentsClient, useValue: client },
      { provide: DOCUMENT, useValue: { location, defaultView: { location, history } } },
    ],
  });
  return { client, history, state: TestBed.inject(VehicleDocumentsState) };
}

describe('vehicle document queries', () => {
  it('loads typed VIN suggestions and aborts older requests without accepting stale results', async () => {
    const { state, client } = setup();
    const requests: { signal: AbortSignal; resolve: (identifiers: string[]) => void }[] = [];
    client.identifiers.mockImplementation((_query, signal) => new Promise(resolve => {
      requests.push({ signal: signal!, resolve });
    }));

    state.focusVin();
    state.setVin('1hg');

    expect(client.identifiers).toHaveBeenCalledTimes(2);
    expect(client.identifiers).toHaveBeenNthCalledWith(1, '', expect.any(AbortSignal));
    expect(client.identifiers).toHaveBeenNthCalledWith(2, '1HG', expect.any(AbortSignal));
    expect(requests[0].signal.aborted).toBe(true);
    expect(state.identifiersLoading()).toBe(true);

    requests[0].resolve(['1HGCM82633A004352']);
    requests[1].resolve(['1HGCM82633A004352']);
    await vi.waitFor(() => expect(state.identifiersLoading()).toBe(false));

    expect(state.identifiers()).toEqual(['1HGCM82633A004352']);
  });

  it('cancels VIN suggestions when the input loses focus', () => {
    const { state, client } = setup();
    let requestSignal!: AbortSignal;
    client.identifiers.mockImplementation((_query, signal) => {
      requestSignal = signal!;
      return new Promise(() => {});
    });
    state.setVin('1HG');
    state.focusVin();

    state.blurVin();

    expect(requestSignal.aborted).toBe(true);
    expect(state.identifiersOpen()).toBe(false);
    expect(state.identifiersLoading()).toBe(false);
  });

  it('selects a VIN suggestion without submitting the document search', async () => {
    const { state, client } = setup();
    client.identifiers.mockResolvedValue(['1HGCM82633A004352', '1HGCM82633A004360']);
    state.focusVin();
    await vi.waitFor(() => expect(state.identifiersLoading()).toBe(false));
    state.moveIdentifierSelection(-1);

    state.selectActiveIdentifier();

    expect(state.vin()).toBe('1HGCM82633A004360');
    expect(state.identifiersOpen()).toBe(false);
    expect(state.activeIdentifier()).toBe(-1);
    expect(state.searched()).toBe(false);
    expect(client.byVin).not.toHaveBeenCalled();
  });

  it('starts on a fresh home page without loading either list', () => {
    const { state, client } = setup();

    expect(state.searched()).toBe(false);
    expect(client.unlinked).not.toHaveBeenCalled();
    expect(client.byVin).not.toHaveBeenCalled();
  });

  it('loads unlinked documents without requiring a VIN and sets a shareable URL', async () => {
    const { state, client, history } = setup('?vin=old&lang=en');

    await state.loadUnlinked();

    expect(state.documents()).toEqual([unlinkedDocument]);
    expect(state.unlinked()).toBe(true);
    expect(state.invalidVin()).toBe(false);
    expect(state.busy()).toBe(false);
    expect(client.unlinked).toHaveBeenCalledOnce();
    expect(history.replaceState).toHaveBeenLastCalledWith(null, '', '/?lang=en&view=unlinked');
  });

  it('restores the unlinked view on a direct URL instead of searching a stale VIN', async () => {
    const { state, client } = setup('?view=unlinked&vin=1HGCM82633A004352');

    await vi.waitFor(() => expect(state.busy()).toBe(false));

    expect(state.documents()).toEqual([unlinkedDocument]);
    expect(client.unlinked).toHaveBeenCalledOnce();
    expect(client.byVin).not.toHaveBeenCalled();
  });

  it('reports an empty result without treating it as a failure', async () => {
    const { state, client } = setup();
    client.unlinked.mockResolvedValue({ items: [], nextCursor: null });

    await state.loadUnlinked();

    expect(state.documents()).toEqual([]);
    expect(state.searched()).toBe(true);
    expect(state.error()).toBe('');
  });

  it('reports source errors and retries the same unlinked query', async () => {
    const { state, client } = setup();
    client.unlinked.mockRejectedValueOnce(new Error('HTTP 503'));

    await state.loadUnlinked();

    expect(state.error()).toBe('HTTP 503');
    expect(state.busy()).toBe(false);
    expect(state.documents()).toEqual([]);

    await state.retry();

    expect(client.unlinked).toHaveBeenCalledTimes(2);
    expect(client.byVin).not.toHaveBeenCalled();
    expect(state.error()).toBe('');
    expect(state.documents()).toEqual([unlinkedDocument]);
  });

  it('blocks duplicate queries while loading', async () => {
    const { state, client } = setup();
    let finish!: (page: UnlinkedDocumentsPage) => void;
    client.unlinked.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const pending = state.loadUnlinked();

    await state.loadUnlinked();
    await state.search();

    expect(state.busy()).toBe(true);
    expect(client.unlinked).toHaveBeenCalledOnce();
    expect(client.byVin).not.toHaveBeenCalled();
    finish({ items: [], nextCursor: null });
    await pending;
    expect(state.busy()).toBe(false);
  });

  it('switches from unlinked review back to normalized VIN search', async () => {
    const { state, client, history } = setup('?view=unlinked');
    await vi.waitFor(() => expect(state.busy()).toBe(false));
    state.setVin('1hgcm82633a004352');

    await state.search();

    expect(state.unlinked()).toBe(false);
    expect(client.byVin).toHaveBeenCalledWith('1HGCM82633A004352');
    expect(history.replaceState).toHaveBeenLastCalledWith(null, '', '/?vin=1HGCM82633A004352');
  });

  it('appends subsequent pages, deduplicates changed rows and stops at the last page', async () => {
    const { state, client } = setup();
    client.unlinked.mockResolvedValueOnce({ items: [unlinkedDocument], nextCursor: 'page-2' });
    await state.loadUnlinked();
    const second = { ...unlinkedDocument, sourceDocumentId: 'claim-2' };
    client.unlinked.mockResolvedValueOnce({ items: [unlinkedDocument, second], nextCursor: null });

    await state.loadMore();
    await state.loadMore();

    expect(client.unlinked).toHaveBeenCalledTimes(2);
    expect(client.unlinked).toHaveBeenLastCalledWith('page-2');
    expect(state.documents()).toEqual([unlinkedDocument, second]);
    expect(state.nextCursor()).toBeNull();
    expect(state.loadingMore()).toBe(false);
  });

  it('keeps already-loaded rows and the cursor when a later page fails, then retries it', async () => {
    const { state, client } = setup();
    client.unlinked.mockResolvedValueOnce({ items: [unlinkedDocument], nextCursor: 'page-2' });
    await state.loadUnlinked();
    client.unlinked.mockRejectedValueOnce(new Error('HTTP 503'));

    await state.loadMore();

    expect(state.documents()).toEqual([unlinkedDocument]);
    expect(state.nextCursor()).toBe('page-2');
    expect(state.moreError()).toBe('HTTP 503');
    expect(state.error()).toBe('');
    expect(state.loadingMore()).toBe(false);

    await state.loadMore();

    expect(client.unlinked).toHaveBeenLastCalledWith('page-2');
    expect(state.moreError()).toBe('');
  });

  it('blocks duplicate page requests and mode switches until the append finishes', async () => {
    const { state, client } = setup();
    client.unlinked.mockResolvedValueOnce({ items: [unlinkedDocument], nextCursor: 'page-2' });
    await state.loadUnlinked();
    let finish!: (page: UnlinkedDocumentsPage) => void;
    client.unlinked.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const pending = state.loadMore();

    await state.loadMore();
    await state.search();
    await state.loadUnlinked();

    expect(state.loading()).toBe(true);
    expect(client.unlinked).toHaveBeenCalledTimes(2);
    expect(client.byVin).not.toHaveBeenCalled();
    finish({ items: [], nextCursor: null });
    await pending;
    expect(state.loading()).toBe(false);
  });
});
