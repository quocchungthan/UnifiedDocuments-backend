import type { CreateRoom, Room, RoomSummary } from '../../contracts/chess';
import type { SourceScenario } from '../../contracts/service-source';
import { applyMove, inCheck, legalMoves, START_FEN } from '../../domains/chess/rules';
import { scenarioResult } from '../substitution/source';
import type { ChessApi } from './client';

const timestamp = Date.now();
const seat = (side: 'red' | 'black', status: 'connected' | 'pairing' | 'finished' = 'connected') => ({
  side, controller: 'mcp' as const, label: side === 'red' ? 'Agent đỏ' : 'Agent đen',
  agentName: side === 'red' ? 'Bình Minh' : 'Hắc Mã', model: 'Kỳ thủ ngoài', status,
  lastSeenAt: timestamp, turnSeenAt: timestamp, illegalMoves: 0, moves: 0, avgThinkMs: 0, thought: null,
});

function newRoom(code: string, title: string, status: Room['status'], moves: string[] = []): Room {
  let fen = START_FEN;
  const history: Room['history'] = [];
  for (const move of moves) {
    const activeSide = fen.split(' ')[1] === 'r' ? 'red' : 'black';
    fen = applyMove(fen, move);
    history.push({ ply: history.length + 1, side: activeSide, move, captured: null, check: inCheck(fen), thinkMs: 2400, thought: null, at: timestamp - (moves.length - history.length) * 45000, fen, source: 'mcp' });
  }
  const activeSide = fen.split(' ')[1] === 'r' ? 'red' : 'black';
  const red = seat('red', status === 'finished' ? 'finished' : 'connected');
  const black = seat('black', status === 'finished' ? 'finished' : status === 'open' ? 'pairing' : 'connected');
  red.moves = history.filter(item => item.side === 'red').length;
  black.moves = history.filter(item => item.side === 'black').length;
  return {
    pairingApproval: 'automatic', code, title, mode: 'ai-vs-ai', game: 1, createdAt: timestamp - 3600000,
    status, settings: { turnSeconds: 300, maxIllegalMoves: 3, maxPlies: 300 }, live: null,
    seats: { red, black }, serverNow: Date.now(), spectators: status === 'live' ? 18 : 0,
    board: { fen, ascii: '', inCheck: inCheck(fen), activeSide, ply: history.length, legalMoves: status === 'live' ? legalMoves(fen) : [] },
    startedAt: timestamp - 3500000, turnStartedAt: timestamp - 8000, deadline: status === 'live' ? timestamp + 292000 : null,
    history, events: [], outcome: status === 'finished' ? { winner: 'red', reason: 'Checkmate' } : null,
    insight: { patterns: { phase: 'middlegame', openings: [] } }, drawOffer: null,
  };
}

const summarize = (room: Room): RoomSummary => ({
  code: room.code, title: room.title, mode: room.mode, game: room.game, createdAt: room.createdAt,
  status: room.status, seats: room.seats, pairingApproval: room.pairingApproval, spectators: room.spectators,
  ply: room.board.ply, activeSide: room.board.activeSide,
});

/** Realistic but explicitly browser-local sample rooms; no network requests are made. */
export class ChessSubstitute implements ChessApi {
  getCapabilities() {
    return this.result(() => ({ deployment: 'local' as const, houseAI: false, audience: false, realtime: 'poll' as const }));
  }
  getAgentPrompt(): Promise<string> {
    return Promise.reject(new Error('Agent pairing requires the live Chess service; sample rooms cannot connect an agent.'));
  }
  private rooms = new Map<string, Room>([
    ['KH2A3B', newRoom('KH2A3B', 'Khai cuộc pháo đầu', 'live', ['c3c4', 'g6g5', 'b0c2', 'h9g7', 'b2b9', 'a6a5'])],
    ['MA3C5D', newRoom('MA3C5D', 'Bình phong mã', 'open')],
    ['XE4F6G', newRoom('XE4F6G', 'Tàn cuộc bên hồ sen', 'finished', ['a3a4', 'a6a5', 'b0c2', 'b9c7'])],
  ]);
  private nextRoom = 1;
  constructor(private readonly scenario: SourceScenario) {}
  private result<R>(value: () => R, empty?: () => R) {
    return scenarioResult('chess', this.scenario, { default: value, ...(empty ? { empty } : {}) });
  }
  listRooms(): Promise<RoomSummary[]> {
    return this.result(() => [...this.rooms.values()].map(summarize).sort((a, b) => b.createdAt - a.createdAt), () => []);
  }
  getRoom(code: string): Promise<Room> {
    return this.result(() => {
      const room = this.rooms.get(code);
      if (!room) throw new Error(`Room ${code} was not found.`);
      return structuredClone(room);
    });
  }
  playMove(code: string, move: string): Promise<void> {
    return this.result(() => {
      const room = this.rooms.get(code);
      if (!room || room.status !== 'live') throw new Error('This local room is not accepting moves.');
      if (!room.board.legalMoves.includes(move)) throw new Error(`Illegal move: ${move}`);
      const side = room.board.activeSide;
      const captured = room.board.fen;
      const nextFen = applyMove(captured, move);
      room.history.push({ ply: room.history.length + 1, side, move, captured: null, check: inCheck(nextFen), thinkMs: 0, thought: null, at: Date.now(), fen: nextFen, source: 'local' });
      room.board = { ...room.board, fen: nextFen, inCheck: inCheck(nextFen), activeSide: side === 'red' ? 'black' : 'red', ply: room.history.length, legalMoves: legalMoves(nextFen) };
      room.serverNow = Date.now();
      if (!room.board.legalMoves.length) { room.status = 'finished'; room.outcome = { winner: side, reason: room.board.inCheck ? 'Checkmate' : 'No legal moves (stalemate loses)' }; }
    });
  }
  createRoom(input: CreateRoom): Promise<Room> {
    return this.result(() => {
      const code = `DEMOA${String.fromCharCode(65 + this.nextRoom++)}`;
      const room = newRoom(code, input.title, 'open');
      this.rooms.set(code, room);
      return structuredClone(room);
    });
  }
}
