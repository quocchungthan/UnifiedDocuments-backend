import { applyMove, inCheck, legalMoves, pieceAt, START_FEN } from './rules';

describe('Xiangqi rules', () => {
  it('offers legal opening moves and preserves turn in ICCS/FEN', () => {
    const moves = legalMoves(START_FEN);
    expect(moves).toContain('a3a4');
    expect(moves).toContain('b0c2');
    expect(moves).toContain('e0e1');
    const next = applyMove(START_FEN, 'a3a4');
    expect(next).toContain(' b ');
    expect(pieceAt(next, 'a4')).toEqual({ side: 'red', kind: 'p' });
    expect(legalMoves(next)).toContain('a6a5');
  });

  it('blocks horse legs, elephant eyes, and cannons without a screen', () => {
    const horseBlocked = '4k4/9/9/9/9/9/9/4P4/4N4/4K4 r - - 0 1';
    expect(legalMoves(horseBlocked)).not.toContain('e1f3');
    const elephantBlocked = '4k4/9/9/9/9/9/9/4P4/3B5/4K4 r - - 0 1';
    expect(legalMoves(elephantBlocked)).not.toContain('d1f3');
    const cannonNoScreen = '4k4/9/9/9/9/9/9/9/4C4/4K4 r - - 0 1';
    expect(legalMoves(cannonNoScreen)).not.toContain('e1e9');
  });

  it('requires exactly one screen for a cannon capture and enforces pawn direction', () => {
    const cannon = '4k4/4p4/9/9/9/9/9/4P4/4C4/4K4 r - - 0 1';
    expect(legalMoves(cannon)).toContain('e1e8');
    expect(legalMoves(cannon)).not.toContain('e1e9');
    const crossedPawn = '3k5/9/9/9/4P4/9/9/9/9/4K4 r - - 0 1';
    expect(legalMoves(crossedPawn)).toEqual(expect.arrayContaining(['e5e6', 'e5d5', 'e5f5']));
    expect(legalMoves(crossedPawn)).not.toContain('e5e4');
  });

  it('keeps generals in palace and rejects exposed-facing generals', () => {
    const facing = '4k4/9/9/9/9/9/9/9/9/4K4 r - - 0 1';
    expect(inCheck(facing)).toBe(true);
    expect(legalMoves(facing)).not.toContain('e0e1');
    expect(legalMoves(START_FEN)).not.toContain('e0e3');
  });

  it('rejects self-check and malformed moves', () => {
    const pinned = '4k4/9/9/9/9/9/9/4R4/9/4K4 r - - 0 1';
    expect(legalMoves(pinned)).not.toContain('e1d1');
    expect(() => applyMove(START_FEN, 'a3a5')).toThrow(/Illegal/);
    expect(() => applyMove(START_FEN, 'bad')).toThrow(/Invalid/);
  });
});
