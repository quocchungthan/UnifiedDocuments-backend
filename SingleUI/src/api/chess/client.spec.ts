import { ChessClient } from './client';
import { ChessSubstitute } from './substitute';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('loads the advertised transport and the actual side-specific server prompt', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ deployment: 'vercel', houseAI: false, audience: false, realtime: 'poll' }))
    .mockResolvedValueOnce(Response.json({ prompt: 'Server pairing and reconnect instructions' }));
  vi.stubGlobal('fetch', fetch);
  const client = new ChessClient();
  expect((await client.getCapabilities()).realtime).toBe('poll');
  expect(await client.getAgentPrompt('KH2A3B', 'black')).toBe('Server pairing and reconnect instructions');
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    '/api/capabilities', '/api/rooms/KH2A3B/agent-prompt?side=black',
  ]);
});

it('validates room updates, reconnects, and stops reconnecting after the view is destroyed', async () => {
  const room = await new ChessSubstitute('default').getRoom('KH2A3B');
  vi.useFakeTimers();
  class Socket {
    static instances: Socket[] = [];
    onmessage?: (event: MessageEvent) => void;
    onerror?: () => void;
    onclose?: () => void;
    readonly close = vi.fn(() => this.onclose?.());
    constructor(readonly url: URL) { Socket.instances.push(this); }
  }
  vi.stubGlobal('location', { href: 'https://example.invalid/room/KH2A3B?view=obs' });
  vi.stubGlobal('WebSocket', Socket);
  const update = vi.fn(), failure = vi.fn();
  const stop = new ChessClient().watchRoom(room.code, update, failure);
  const first = Socket.instances[0];
  expect(first.url.href).toBe('wss://example.invalid/ws/rooms/KH2A3B');
  first.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'room', room }) }));
  expect(update).toHaveBeenCalledWith(room);
  first.onmessage?.(new MessageEvent('message', { data: '{"type":"room","room":{}}' }));
  expect(failure).toHaveBeenCalledTimes(1);
  first.onclose?.();
  vi.advanceTimersByTime(2000);
  expect(Socket.instances).toHaveLength(2);
  stop();
  vi.advanceTimersByTime(6000);
  expect(Socket.instances[1].close).toHaveBeenCalledOnce();
  expect(Socket.instances).toHaveLength(2);
});
