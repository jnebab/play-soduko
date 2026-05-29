/**
 * SOLO-ONLY puzzle generator (ported from the validated seed prototype).
 *
 * ⚠️ Scope: this module is used ONLY by single-player solo mode, which is a
 * self-contained, offline experience. It is intentionally NOT part of the
 * shared `@sudoku/engine` package and is NEVER imported by arena code.
 *
 * For ARENA, generation and the solution live exclusively in the Python API
 * and the solution never reaches the client (see docs/ARCHITECTURE.md). The
 * anti-cheat guarantee only matters when there is an opponent — in solo there
 * isn't one, so keeping a locally-generated solution for instant error
 * feedback and hints is safe and never crosses any wire.
 */
import { CLUE_TARGETS, type Board, type Difficulty } from "@sudoku/engine";

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const ai = a[i] as T;
    a[i] = a[j] as T;
    a[j] = ai;
  }
  return a;
}

function canPlace(g: Board, idx: number, v: number): boolean {
  const r = Math.floor(idx / 9);
  const c = idx % 9;
  for (let k = 0; k < 9; k++) {
    if (g[r * 9 + k] === v) return false;
    if (g[k * 9 + c] === v) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) if (g[(br + i) * 9 + (bc + j)] === v) return false;
  return true;
}

function fill(g: Board): boolean {
  const idx = g.indexOf(0);
  if (idx === -1) return true;
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(g, idx, v)) {
      g[idx] = v;
      if (fill(g)) return true;
      g[idx] = 0;
    }
  }
  return false;
}

function genSolved(): Board {
  const g: Board = new Array<number>(81).fill(0);
  fill(g);
  return g;
}

/** Count solutions, short-circuiting at 2 (we only care whether it is unique). */
function countSolutions(g: Board): number {
  let n = 0;
  const solve = (): void => {
    const idx = g.indexOf(0);
    if (idx === -1) {
      n++;
      return;
    }
    for (let v = 1; v <= 9 && n < 2; v++) {
      if (canPlace(g, idx, v)) {
        g[idx] = v;
        solve();
        g[idx] = 0;
      }
    }
  };
  solve();
  return n;
}

export interface GeneratedPuzzle {
  /** The starting board (givens, with 0 for blanks). */
  puzzle: Board;
  /** The full solution — SOLO ONLY, never transmitted. */
  solution: Board;
}

/** Generate a unique-solution puzzle dug to the difficulty's clue target. */
export function makePuzzle(difficulty: Difficulty): GeneratedPuzzle {
  const target = CLUE_TARGETS[difficulty];
  const solution = genSolved();
  const puzzle = solution.slice();
  let givens = 81;
  for (const idx of shuffle([...Array(81).keys()])) {
    if (givens <= target) break;
    const saved = puzzle[idx];
    if (!saved) continue;
    puzzle[idx] = 0;
    if (countSolutions(puzzle.slice()) !== 1) puzzle[idx] = saved;
    else givens--;
  }
  return { puzzle, solution };
}
