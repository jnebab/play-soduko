import { describe, expect, it } from "vitest";
import { CLUE_TARGETS, findConflicts } from "@sudoku/engine";
import { makePuzzle } from "./generator.js";

describe("makePuzzle (solo)", () => {
  it("digs to the difficulty's clue target with a conflict-free solution", () => {
    for (const diff of ["easy", "medium"] as const) {
      const { puzzle, solution } = makePuzzle(diff);
      expect(puzzle).toHaveLength(81);
      expect(solution).toHaveLength(81);

      // clue count equals the target
      const clues = puzzle.filter((v) => v !== 0).length;
      expect(clues).toBe(CLUE_TARGETS[diff]);

      // every given matches the solution
      puzzle.forEach((v, i) => {
        if (v !== 0) expect(v).toBe(solution[i]);
      });

      // the full solution is a valid (conflict-free) grid
      expect(solution.every((v) => v >= 1 && v <= 9)).toBe(true);
      expect(findConflicts(solution).size).toBe(0);
    }
  });
});
