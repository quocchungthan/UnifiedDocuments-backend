import { Injectable } from '@angular/core';
import { inspectionSchema, snapshotSchema, type Inspection, type Snapshot } from '../../contracts/bridge';
import { requestJson, requestOk } from '../http/request';

export const BRIDGE_API = 'http://localhost:5310';
export const START_BRIDGE =
  'git clone https://github.com/quocchungthan/PARA-AI-solution\ncd PARA-AI-solution\ndotnet run --project src/Bridge';

export interface BridgeApi {
  snapshot(signal?: AbortSignal): Promise<Snapshot>;
  inspect(id: string): Promise<Inspection>;
  reply(id: string, message: string): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class BridgeClient implements BridgeApi {
  snapshot(signal?: AbortSignal) {
    return requestJson('bridge', '/api/snapshot', snapshotSchema, { signal });
  }
  inspect(id: string) {
    return requestJson(
      'bridge',
      `/api/sessions/${encodeURIComponent(id)}/inspect`,
      inspectionSchema,
    );
  }
  async reply(id: string, message: string) {
    if (!message.trim()) throw new Error('Enter a response before sending.');
    await requestOk('bridge', `/api/sessions/${encodeURIComponent(id)}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  }
}
