import { Injectable } from '@angular/core';
import {
  operatorConfigSchema, operatorCreateSchema, operatorModelsSchema,
  pairingSchema, pairingsSchema, type OperatorCreate,
} from '../../contracts/chess-operator';
import { liveSettingsSchema, roomSchema } from '../../contracts/chess';
import { requestJson, requestOk } from '../http/request';
import type { z } from 'zod';

@Injectable({ providedIn: 'root' })
export class ChessOperatorClient {
  config() { return requestJson('chess', '/admin/api/config', operatorConfigSchema); }
  models() { return requestJson('chess', '/admin/api/models', operatorModelsSchema); }
  create(input: OperatorCreate) {
    return requestJson('chess', '/admin/api/rooms', roomSchema, this.post(operatorCreateSchema.parse(input)));
  }
  pairings(code: string) {
    return requestJson('chess', `${this.room(code)}/pairings`, pairingsSchema);
  }
  pairing(id: string) {
    return requestJson('chess', `/admin/api/pairings/${encodeURIComponent(id)}`, pairingSchema);
  }
  decide(id: string, approve: boolean) {
    return requestJson('chess', `/admin/api/pairings/${encodeURIComponent(id)}`, pairingSchema, this.post({ approve }));
  }
  setLive(code: string, input: Partial<z.infer<typeof liveSettingsSchema>>) {
    return requestOk('chess', `${this.room(code)}/live`, this.post(liveSettingsSchema.partial().parse(input)));
  }
  pause(code: string, paused: boolean) { return this.command(code, 'pause', { paused }); }
  autopilot(code: string) { return this.command(code, 'autopilot'); }
  end(code: string) { return this.command(code, 'end'); }
  rematch(code: string) { return this.command(code, 'rematch'); }
  respondDraw(code: string, offerId: string, accept: boolean) {
    return this.command(code, 'draw-response', { offerId, accept });
  }
  comment(code: string, text: string) { return this.command(code, 'comments', { user: 'operator', text }); }
  move(code: string, move: string) { return this.command(code, 'move', { move }); }
  private command(code: string, action: string, body: object = {}) {
    return requestOk('chess', `${this.room(code)}/${action}`, this.post(body));
  }
  private room(code: string) { return `/admin/api/rooms/${encodeURIComponent(code)}`; }
  private post(body: object) {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }
}
