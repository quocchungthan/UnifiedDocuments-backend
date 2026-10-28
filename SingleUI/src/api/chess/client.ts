import { Injectable } from '@angular/core';
import { agentPromptSchema, capabilitiesSchema, createRoomSchema, roomSchema, roomsResponseSchema, type Team, type CreateRoom, type Room, type RoomSummary } from '../../contracts/chess';
import { requestJson, requestOk } from '../http/request';

export interface ChessApi {
  listRooms(): Promise<RoomSummary[]>;
  getRoom(code: string): Promise<Room>;
  createRoom(input: CreateRoom): Promise<Room>;
  playMove(code: string, move: string): Promise<void>;
  getCapabilities(): Promise<{ deployment: 'local' | 'vercel'; houseAI: boolean; audience: boolean; realtime: 'poll' | 'websocket' }>;
  getAgentPrompt(code: string, side: Team): Promise<string>;
}

@Injectable({ providedIn: 'root' })
export class ChessClient implements ChessApi {
  getCapabilities() {
    return requestJson('chess', '/api/capabilities', capabilitiesSchema);
  }
  async getAgentPrompt(code: string, side: Team) {
    return (await requestJson('chess', `/api/rooms/${encodeURIComponent(code)}/agent-prompt?side=${side}`, agentPromptSchema)).prompt;
  }
  watchRoom(code: string, update: (room: Room) => void, failure: (error: unknown) => void) {
    let stopped = false;
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (stopped) return;
      const origin = new URL(globalThis.location.href);
      origin.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
      origin.pathname = `/ws/rooms/${encodeURIComponent(code)}`;
      origin.search = '';
      origin.hash = '';
      socket = new WebSocket(origin);
      socket.onmessage = event => {
        try {
          const payload: unknown = JSON.parse(String(event.data));
          if (!payload || typeof payload !== 'object' || !('type' in payload))
            throw new Error('Invalid Chess update.');
          if (payload.type === 'room' && 'room' in payload) update(roomSchema.parse(payload.room));
          else if (payload.type === 'error') throw new Error('Chess room update failed.');
        } catch (error) { failure(error); }
      };
      socket.onerror = () => failure(new Error('Chess live connection interrupted.'));
      socket.onclose = () => { if (!stopped) retry = setTimeout(connect, 2000); };
    };
    connect();
    return () => { stopped = true; clearTimeout(retry); socket?.close(); };
  }
  async listRooms() {
    return (await requestJson('chess', '/api/rooms?limit=50', roomsResponseSchema)).rooms;
  }
  getRoom(code: string) {
    return requestJson('chess', `/api/rooms/${encodeURIComponent(code)}`, roomSchema);
  }
  createRoom(input: CreateRoom) {
    const valid = createRoomSchema.parse(input);
    return requestJson('chess', '/api/rooms', roomSchema, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: valid.title, settings: valid.settings }),
    });
  }
  async playMove(code: string, move: string) {
    await requestOk('chess', `/admin/api/rooms/${encodeURIComponent(code)}/move`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ move }),
    });
  }
}
