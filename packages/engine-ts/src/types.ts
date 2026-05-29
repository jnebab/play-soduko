/**
 * Core board types. A cell index is 0..80 (`row * 9 + col`).
 * A digit is 1..9. `0` means empty.
 *
 * NOTE: This package deliberately contains NO puzzle generator and NO solver.
 * Generation and the solution live ONLY in the Python API (see docs/ARCHITECTURE.md).
 */

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard", "expert"];

/** Clue counts per difficulty — mirrors the Python generator targets. */
export const CLUE_TARGETS: Record<Difficulty, number> = {
  easy: 43,
  medium: 34,
  hard: 30,
  expert: 27,
};

/** A flat 9x9 grid of digits; 0 = empty. Always length 81. */
export type Board = number[];

/** Pencil-mark candidates per cell. Always length 81; each entry sorted asc. */
export type Notes = number[][];

/**
 * Shadow-grid cell states broadcast to opponents/spectators — STATES ONLY,
 * never digits. Mirrors docs/PROTOCOL.md.
 */
export type CellState = "given" | "filled" | "wrong" | "empty";

export const BOARD_SIZE = 81;
export const GRID = 9;
export const BOX = 3;
