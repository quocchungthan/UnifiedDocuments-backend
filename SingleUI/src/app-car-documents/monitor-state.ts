import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { VehicleDocumentsClient } from '../api/cars/vehicle-documents';
import type { UnlinkedDocumentsPage, VehicleDocument } from '../contracts/car-documents';

@Injectable()
export class VehicleDocumentsState {
  private readonly client = inject(VehicleDocumentsClient);
  private readonly document = inject(DOCUMENT);
  readonly vin = signal('');
  readonly identifiers = signal<string[]>([]);
  readonly identifiersOpen = signal(false);
  readonly identifiersLoading = signal(false);
  readonly identifiersError = signal('');
  readonly activeIdentifier = signal(-1);
  readonly documents = signal<VehicleDocument[]>([]);
  readonly busy = signal(false);
  readonly searched = signal(false);
  readonly invalidVin = signal(false);
  readonly error = signal('');
  readonly unlinked = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly loadingMore = signal(false);
  readonly moreError = signal('');
  readonly loading = computed(() => this.busy() || this.loadingMore());
  private identifierRequest?: AbortController;

  constructor() {
    const params = new URLSearchParams(this.document.location?.search ?? '');
    const vin = params.get('vin');
    if (params.get('view') === 'unlinked') {
      void this.loadUnlinked();
    } else if (vin) {
      this.vin.set(vin.toUpperCase());
      void this.search();
    }
  }

  setVin(value: string) {
    if (this.loading()) return;
    this.unlinked.set(false);
    this.vin.set(value.toUpperCase());
    this.invalidVin.set(false);
    this.error.set('');
    this.searched.set(false);
    this.documents.set([]);
    this.nextCursor.set(null);
    this.moreError.set('');
    if (this.identifiersOpen()) void this.loadIdentifiers(this.vin());
  }

  focusVin() {
    this.identifiersOpen.set(true);
    void this.loadIdentifiers(this.vin());
  }

  blurVin() {
    this.closeIdentifiers();
  }

  selectIdentifier(vin: string) {
    this.closeIdentifiers();
    this.identifiers.set([]);
    this.vin.set(vin);
    this.invalidVin.set(false);
    this.error.set('');
    this.searched.set(false);
  }

  moveIdentifierSelection(direction: -1 | 1) {
    if (!this.identifiersOpen() || this.identifiers().length === 0) return;
    const current = this.activeIdentifier();
    const count = this.identifiers().length;
    this.activeIdentifier.set(current < 0 ? (direction > 0 ? 0 : count - 1) : (current + direction + count) % count);
  }

  selectActiveIdentifier() {
    const vin = this.identifiers()[this.activeIdentifier()];
    if (vin) this.selectIdentifier(vin);
  }

  closeIdentifiers() {
    this.identifiersOpen.set(false);
    this.activeIdentifier.set(-1);
    this.cancelIdentifierRequest();
  }

  private async loadIdentifiers(query: string) {
    this.cancelIdentifierRequest();
    this.identifiers.set([]);
    this.activeIdentifier.set(-1);
    this.identifiersError.set('');
    this.identifiersLoading.set(false);

    const normalized = query.replace(/\s/g, '').toUpperCase();

    const controller = new AbortController();
    this.identifierRequest = controller;
    this.identifiersLoading.set(true);
    try {
      const identifiers = await this.client.identifiers(normalized, controller.signal);
      if (this.identifierRequest === controller && !controller.signal.aborted)
        this.identifiers.set(identifiers);
    } catch (error) {
      if (this.identifierRequest === controller && !controller.signal.aborted)
        this.identifiersError.set(error instanceof Error ? error.message : String(error));
    } finally {
      if (this.identifierRequest === controller) {
        this.identifierRequest = undefined;
        this.identifiersLoading.set(false);
      }
    }
  }

  private cancelIdentifierRequest() {
    this.identifierRequest?.abort();
    this.identifierRequest = undefined;
    this.identifiersLoading.set(false);
  }

  async search() {
    if (this.loading()) return;
    this.closeIdentifiers();
    const vin = this.vin().replace(/\s/g, '').toUpperCase();
    this.unlinked.set(false);
    this.updateUrl(vin);
    const valid = /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) && /[A-Z]/.test(vin) && /\d/.test(vin);
    this.invalidVin.set(!valid);
    this.error.set('');
    this.documents.set([]);
    this.searched.set(false);
    if (!valid) return;

    this.vin.set(vin);
    await this.load(async () => ({ items: await this.client.byVin(vin), nextCursor: null }));
  }

  async loadUnlinked() {
    if (this.loading()) return;
    this.closeIdentifiers();
    this.unlinked.set(true);
    this.invalidVin.set(false);
    this.updateUrl('');
    await this.load(() => this.client.unlinked());
  }

  retry() {
    return this.unlinked() ? this.loadUnlinked() : this.search();
  }

  async loadMore() {
    const cursor = this.nextCursor();
    if (!this.unlinked() || this.loading() || !cursor) return;
    this.loadingMore.set(true);
    this.moreError.set('');
    try {
      const page = await this.client.unlinked(cursor);
      const key = (document: VehicleDocument) => JSON.stringify([document.sourceName, document.sourceDocumentId]);
      const existing = new Set(this.documents().map(key));
      this.documents.update(documents => [
        ...documents, ...page.items.filter(document => !existing.has(key(document))),
      ]);
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      this.moreError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async load(request: () => Promise<UnlinkedDocumentsPage>) {
    this.error.set('');
    this.moreError.set('');
    this.nextCursor.set(null);
    this.documents.set([]);
    this.searched.set(true);
    this.busy.set(true);
    try {
      const page = await request();
      this.documents.set(page.items);
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy.set(false);
    }
  }

  private updateUrl(vin: string) {
    const view = this.document.defaultView;
    if (!view) return;

    const params = new URLSearchParams(view.location.search);
    if (vin) params.set('vin', vin);
    else params.delete('vin');
    if (this.unlinked()) params.set('view', 'unlinked');
    else params.delete('view');
    const query = params.toString();
    const url = `${view.location.pathname}${query ? `?${query}` : ''}${view.location.hash}`;
    view.history.replaceState(view.history.state, '', url);
  }
}
