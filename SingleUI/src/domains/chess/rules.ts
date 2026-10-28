export type Side = 'red' | 'black';
export type Piece = { readonly side: Side; readonly kind: 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p' };
export type Board = (Piece | null)[][];

export const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1';
const files = 'abcdefghi';
const pieceKind: Record<string, Piece['kind']> = { k: 'k', a: 'a', b: 'b', n: 'n', r: 'r', c: 'c', p: 'p' };

export function parseFen(fen: string): { board: Board; turn: Side; fields: string[] } {
  const fields = fen.trim().split(/\s+/);
  const rows = fields[0]?.split('/');
  if (rows?.length !== 10) throw new Error('Xiangqi FEN must contain ten ranks.');
  const board: Board = Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null));
  rows.forEach((row, index) => {
    let file = 0;
    for (const char of row) {
      if (/^[1-9]$/.test(char)) file += Number(char);
      else {
        const kind = pieceKind[char.toLowerCase()];
        if (!kind || file >= 9) throw new Error(`Invalid Xiangqi FEN rank: ${row}`);
        board[9 - index][file++] = { side: char === char.toUpperCase() ? 'red' : 'black', kind };
      }
    }
    if (file !== 9) throw new Error(`Invalid Xiangqi FEN rank width: ${row}`);
  });
  const turn = fields[1] === 'b' ? 'black' : fields[1] === 'r' || fields[1] === 'w' ? 'red' : null;
  if (!turn) throw new Error('Xiangqi FEN has an invalid active side.');
  return { board, turn, fields };
}

export function toFen(board: Board, turn: Side, fields: string[] = []): string {
  const ranks = Array.from({ length: 10 }, (_, index) => {
    let row = '', empty = 0;
    for (let file = 0; file < 9; file++) {
      const piece = board[9 - index][file];
      if (!piece) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        const letter = piece.kind;
        row += piece.side === 'red' ? letter.toUpperCase() : letter;
      }
    }
    return row + (empty || '');
  });
  const counters = fields.length >= 6 ? fields.slice(2, 6) : ['-', '-', '0', '1'];
  return `${ranks.join('/')} ${turn === 'red' ? 'r' : 'b'} ${counters.join(' ')}`;
}

export function pieceAt(fen: string, square: string): Piece | null {
  const { board } = parseFen(fen);
  const at = parseSquare(square);
  return at ? board[at.rank][at.file] : null;
}

function parseSquare(square: string) {
  if (!/^[a-i][0-9]$/.test(square)) return null;
  return { file: files.indexOf(square[0]), rank: Number(square[1]) };
}
function inside(file: number, rank: number) { return file >= 0 && file < 9 && rank >= 0 && rank < 10; }
function palace(side: Side, file: number, rank: number) {
  return file >= 3 && file <= 5 && (side === 'red' ? rank <= 2 : rank >= 7);
}
function riverCrossed(side: Side, rank: number) { return side === 'red' ? rank >= 5 : rank <= 4; }
function add(board: Board, fromFile: number, fromRank: number, toFile: number, toRank: number, out: string[]) {
  if (!inside(toFile, toRank)) return false;
  const piece = board[fromRank][fromFile], target = board[toRank][toFile];
  if (target?.side === piece?.side) return false;
  out.push(`${files[fromFile]}${fromRank}${files[toFile]}${toRank}`);
  return !target;
}

function pseudoMoves(board: Board, file: number, rank: number): string[] {
  const piece = board[rank][file];
  if (!piece) return [];
  const out: string[] = [];
  const { side, kind } = piece;
  if (kind === 'k') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = file + dx, y = rank + dy;
      if (palace(side, x, y)) add(board, file, rank, x, y, out);
    }
    for (let y = rank + (side === 'red' ? 1 : -1); y >= 0 && y < 10; y += side === 'red' ? 1 : -1) {
      const target = board[y][file];
      if (!target) continue;
      if (target.kind === 'k' && target.side !== side) out.push(`${files[file]}${rank}${files[file]}${y}`);
      break;
    }
  } else if (kind === 'a') {
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = file + dx, y = rank + dy;
      if (palace(side, x, y)) add(board, file, rank, x, y, out);
    }
  } else if (kind === 'b') {
    for (const [dx, dy] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) {
      const x = file + dx, y = rank + dy, eyeX = file + dx / 2, eyeY = rank + dy / 2;
      const staysHome = side === 'red' ? y <= 4 : y >= 5;
      if (inside(x, y) && staysHome && !board[eyeY][eyeX]) add(board, file, rank, x, y, out);
    }
  } else if (kind === 'n') {
    for (const [dx, dy, legX, legY] of [
      [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1],
      [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0],
    ]) {
      const legFile = file + legX, legRank = rank + legY;
      if (inside(legFile, legRank) && !board[legRank][legFile]) add(board, file, rank, file + dx, rank + dy, out);
    }
  } else if (kind === 'r' || kind === 'c') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let x = file + dx, y = rank + dy, screened = false;
      while (inside(x, y)) {
        const target = board[y][x];
        if (kind === 'r') {
          if (!add(board, file, rank, x, y, out)) break;
        } else if (!screened) {
          if (!target) out.push(`${files[file]}${rank}${files[x]}${y}`);
          else screened = true;
        } else if (target) {
          if (target.side !== side) out.push(`${files[file]}${rank}${files[x]}${y}`);
          break;
        }
        x += dx; y += dy;
      }
    }
  } else {
    const forward = side === 'red' ? 1 : -1;
    add(board, file, rank, file, rank + forward, out);
    if (riverCrossed(side, rank)) {
      add(board, file, rank, file - 1, rank, out);
      add(board, file, rank, file + 1, rank, out);
    }
  }
  return out;
}

function isInCheck(board: Board, side: Side): boolean {
  let king: { file: number; rank: number } | null = null;
  for (let rank = 0; rank < 10; rank++) for (let file = 0; file < 9; file++) {
    const piece = board[rank][file];
    if (piece?.side === side && piece.kind === 'k') king = { file, rank };
  }
  if (!king) return true;
  const enemy: Side = side === 'red' ? 'black' : 'red';
  for (let rank = 0; rank < 10; rank++) for (let file = 0; file < 9; file++) {
    if (board[rank][file]?.side !== enemy) continue;
    if (pseudoMoves(board, file, rank).some(move => move.slice(2) === `${files[king!.file]}${king!.rank}`)) return true;
  }
  return false;
}

export function legalMoves(fen: string): string[] {
  const { board, turn } = parseFen(fen);
  const legal: string[] = [];
  for (let rank = 0; rank < 10; rank++) for (let file = 0; file < 9; file++) {
    if (board[rank][file]?.side !== turn) continue;
    for (const move of pseudoMoves(board, file, rank)) {
      const next = board.map(row => [...row]);
      const from = parseSquare(move.slice(0, 2))!, to = parseSquare(move.slice(2))!;
      const captured = next[to.rank][to.file];
      next[to.rank][to.file] = next[from.rank][from.file]; next[from.rank][from.file] = null;
      if (captured?.kind !== 'k' && !isInCheck(next, turn)) legal.push(move);
    }
  }
  return legal;
}

export function applyMove(fen: string, move: string): string {
  if (!/^[a-i][0-9][a-i][0-9]$/.test(move)) throw new Error(`Invalid Xiangqi move: ${move}`);
  const { board, turn, fields } = parseFen(fen);
  if (!legalMoves(fen).includes(move)) throw new Error(`Illegal Xiangqi move: ${move}`);
  const from = parseSquare(move.slice(0, 2))!, to = parseSquare(move.slice(2))!;
  board[to.rank][to.file] = board[from.rank][from.file]; board[from.rank][from.file] = null;
  const nextTurn: Side = turn === 'red' ? 'black' : 'red';
  const nextFields = [...fields];
  if (nextFields.length >= 6) nextFields[5] = String((Number(nextFields[5]) || 1) + (nextTurn === 'red' ? 1 : 0));
  return toFen(board, nextTurn, nextFields);
}

export function sideToMove(fen: string) { return parseFen(fen).turn; }
export function inCheck(fen: string) { const { board, turn } = parseFen(fen); return isInCheck(board, turn); }
