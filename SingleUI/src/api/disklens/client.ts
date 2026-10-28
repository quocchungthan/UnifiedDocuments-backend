import { Injectable } from '@angular/core';
import type { Config, Dashboard, EntryPage, Monitor, MonitorRequest, Progress, Scan } from '../../contracts/disklens';
import {
  configSchema, dashboardSchema, entryPageSchema, monitorSchema, progressSchema, scanSchema, statusSchema,
} from '../../contracts/disklens';
import { request, requestJson, requestOk, ServiceRequestError } from '../http/request';

export interface EntryQuery {
  scanId: string; search: string; kind: string; category: string; sort: string; page: number; minBytes: number;
}
export interface DiskLensApi {
  config(): Promise<Config>;
  status(): Promise<{ scan: Progress; monitor: Monitor }>;
  history(): Promise<Scan[]>;
  dashboard(scanId: string): Promise<Dashboard>;
  entries(query: EntryQuery): Promise<EntryPage>;
  start(root: string): Promise<void>;
  cancel(): Promise<void>;
  setMonitor(settings: MonitorRequest): Promise<Monitor>;
  reveal(scanId: string, entryId: number): Promise<string>;
}

@Injectable({ providedIn: 'root' })
export class DiskLensClient implements DiskLensApi {
  config() { return requestJson('disklens', '/api/config', configSchema, { credentials: 'omit' }); }
  status() { return requestJson('disklens', '/api/status', statusSchema, { credentials: 'omit' }); }
  history() { return requestJson('disklens', '/api/scans', scanSchema.array(), { credentials: 'omit' }); }
  dashboard(scanId: string) {
    return requestJson('disklens', `/api/dashboard?scanId=${encodeURIComponent(scanId)}`, dashboardSchema, { credentials: 'omit' });
  }
  entries(query: EntryQuery) {
    const params = new URLSearchParams({
      scanId: query.scanId, search: query.search, kind: query.kind, category: query.category,
      sort: query.sort, page: String(query.page), minBytes: String(query.minBytes),
    });
    return requestJson('disklens', `/api/entries?${params}`, entryPageSchema, { credentials: 'omit' });
  }
  async start(root: string): Promise<void> {
    const response = await request('disklens', '/api/scans', {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-DiskLens': '1' },
      body: JSON.stringify({ root }),
    });
    if (response.ok) return;
    const text = await response.text();
    let detail = text;
    try {
      const body = JSON.parse(text) as { error?: string; detail?: string; title?: string };
      detail = body.error ?? body.detail ?? body.title ?? text;
    } catch { /* Preserve server diagnostics when the body is not JSON. */ }
    throw new ServiceRequestError('disklens', response.status, detail);
  }
  async cancel() { await requestOk('disklens', '/api/scans/cancel', { method: 'POST', credentials: 'omit', headers: { 'X-DiskLens': '1' } }); }
  async setMonitor(settings: MonitorRequest) {
    const response = await request('disklens', '/api/monitor', {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-DiskLens': '1' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new ServiceRequestError('disklens', response.status, body);
    }
    return monitorSchema.parse(await response.json());
  }
  async reveal(scanId: string, entryId: number) {
    const response = await request('disklens', '/api/explorer', {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-DiskLens': '1' },
      body: JSON.stringify({ scanId, entryId }),
    });
    const body = await response.json() as { message?: string; error?: string };
    if (!response.ok) throw new ServiceRequestError('disklens', response.status, body.error ?? '');
    return body.message ?? 'Reveal requested.';
  }
}
