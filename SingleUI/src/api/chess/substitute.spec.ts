import { ChessSubstitute } from './substitute';
import { legalMoves } from '../../domains/chess/rules';

describe('chess substitute', () => {
  it('provides sample rooms and applies a legal move locally', async () => {
    const api = new ChessSubstitute('default');
    const rooms = await api.listRooms();
    expect(rooms).toHaveLength(3);
    expect(rooms.map(room => room.status)).toEqual(expect.arrayContaining(['live', 'open', 'finished']));
    const room = await api.getRoom('KH2A3B');
    const move = room.board.legalMoves[0];
    await api.playMove(room.code, move);
    const changed = await api.getRoom(room.code);
    expect(changed.board.ply).toBe(room.board.ply + 1);
    expect(changed.history.at(-1)?.move).toBe(move);
    expect(changed.board.legalMoves).toEqual(legalMoves(changed.board.fen));
  });

  it('keeps empty and failure scenarios explicit', async () => {
    expect(await new ChessSubstitute('empty').listRooms()).toEqual([]);
    await expect(new ChessSubstitute('failure').listRooms()).rejects.toThrow(/substitute failure/);
    const pending = await Promise.race([
      new ChessSubstitute('loading').listRooms(),
      new Promise(resolve => setTimeout(() => resolve('pending'), 20)),
    ]);
    expect(pending).toBe('pending');
  });
});
