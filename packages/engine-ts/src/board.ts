import { BOARD_SIZE, BOX, GRID, type Board, type Notes } from "./types.js";

/** Row index (0..8) of a cell. */
export const rowOf = (idx: number): number => Math.floor(idx / GRID);
/** Column index (0..8) of a cell. */
export const colOf = (idx: number): number => idx % GRID;
/** Box index (0..8), row-major over the 3x3 boxes. */
export const boxOf = (idx: number): number =>
  Math.floor(rowOf(idx) / BOX) * BOX + Math.floor(colOf(idx) / BOX);

/** An empty board (all zeros). */
export const emptyBoard = (): Board => new Array<number>(BOARD_SIZE).fill(0);

/** Empty notes (81 empty arrays). */
export const emptyNotes = (): Notes =>
  Array.from({ length: BOARD_SIZE }, () => [] as number[]);

const PEERS: ReadonlyArray<readonly number[]> = buildPeers();

function buildPeers(): number[][] {
  const all: number[][] = [];
  for (let idx = 0; idx < BOARD_SIZE; idx++) {
    const r = rowOf(idx);
    const c = colOf(idx);
    const set = new Set<number>();
    for (let k = 0; k < GRID; k++) {
      set.add(r * GRID + k);
      set.add(k * GRID + c);
    }
    const br = Math.floor(r / BOX) * BOX;
    const bc = Math.floor(c / BOX) * BOX;
    for (let i = 0; i < BOX; i++) {
      for (let j = 0; j < BOX; j++) {
        set.add((br + i) * GRID + (bc + j));
      }
    }
    set.delete(idx);
    all.push([...set]);
  }
  return all;
}

/** The 20 peers (same row, column, or box) of a cell. */
export function peersOf(idx: number): readonly number[] {
  const peers = PEERS[idx];
  if (peers === undefined) throw new RangeError(`cell index out of range: ${idx}`);
  return peers;
}

/**
 * Duplicate-conflict detection. Returns the set of cell indices whose digit
 * collides with at least one peer holding the same digit. This is the ONLY
 * error signal available on the client (no solution here) — it powers the
 * instant red highlight in solo and the local "for feel" highlight in arena.
 */
export function findConflicts(board: Board): Set<number> {
  const conflicts = new Set<number>();
  for (let idx = 0; idx < BOARD_SIZE; idx++) {
    const v = board[idx];
    if (!v) continue;
    for (const p of peersOf(idx)) {
      if (board[p] === v) {
        conflicts.add(idx);
        break;
      }
    }
  }
  return conflicts;
}

/** True when every cell is filled (does not assert correctness). */
export const isFull = (board: Board): boolean => board.every((v) => v !== 0);

/** Count of how many of each digit (1..9) remain to be placed (9 each). */
export function remainingDigits(board: Board): number[] {
  const counts = new Array<number>(10).fill(0);
  for (const v of board) if (v) counts[v] = (counts[v] ?? 0) + 1;
  return counts.map((c) => GRID - c);
}

/** mm:ss formatting for a whole-second count. */
export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
