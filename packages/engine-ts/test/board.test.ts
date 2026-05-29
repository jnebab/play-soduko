import { describe, expect, it } from "vitest";
import {
  boxOf,
  colOf,
  emptyBoard,
  findConflicts,
  formatTime,
  isFull,
  peersOf,
  remainingDigits,
  rowOf,
} from "../src/board.js";

describe("cell geometry", () => {
  it("computes row/col/box", () => {
    expect(rowOf(0)).toBe(0);
    expect(colOf(0)).toBe(0);
    expect(boxOf(0)).toBe(0);

    expect(rowOf(80)).toBe(8);
    expect(colOf(80)).toBe(8);
    expect(boxOf(80)).toBe(8);

    // cell (4,4) -> index 40, center box
    expect(rowOf(40)).toBe(4);
    expect(colOf(40)).toBe(4);
    expect(boxOf(40)).toBe(4);
  });

  it("gives each cell exactly 20 peers", () => {
    for (let i = 0; i < 81; i++) {
      expect(peersOf(i)).toHaveLength(20);
      expect(peersOf(i)).not.toContain(i);
    }
  });

  it("peer relationship is symmetric", () => {
    for (let i = 0; i < 81; i++) {
      for (const p of peersOf(i)) {
        expect(peersOf(p)).toContain(i);
      }
    }
  });

  it("throws on out-of-range index", () => {
    expect(() => peersOf(81)).toThrow(RangeError);
  });
});

describe("findConflicts", () => {
  it("returns empty set for an empty board", () => {
    expect(findConflicts(emptyBoard()).size).toBe(0);
  });

  it("flags both cells of a row duplicate", () => {
    const b = emptyBoard();
    b[0] = 5;
    b[1] = 5; // same row
    const c = findConflicts(b);
    expect(c.has(0)).toBe(true);
    expect(c.has(1)).toBe(true);
    expect(c.size).toBe(2);
  });

  it("flags a column duplicate", () => {
    const b = emptyBoard();
    b[0] = 7;
    b[9] = 7; // same column
    expect(findConflicts(b)).toEqual(new Set([0, 9]));
  });

  it("flags a box duplicate", () => {
    const b = emptyBoard();
    b[0] = 3;
    b[10] = 3; // same top-left box (0,0) & (1,1)
    expect(findConflicts(b)).toEqual(new Set([0, 10]));
  });

  it("does not flag distinct digits", () => {
    const b = emptyBoard();
    b[0] = 1;
    b[1] = 2;
    b[9] = 3;
    expect(findConflicts(b).size).toBe(0);
  });
});

describe("remainingDigits", () => {
  it("starts at 9 for each digit", () => {
    const r = remainingDigits(emptyBoard());
    for (let d = 1; d <= 9; d++) expect(r[d]).toBe(9);
  });

  it("decrements as digits are placed", () => {
    const b = emptyBoard();
    b[0] = 5;
    b[1] = 5;
    const r = remainingDigits(b);
    expect(r[5]).toBe(7);
    expect(r[1]).toBe(9);
  });
});

describe("isFull", () => {
  it("is false for empty, true when no zeros", () => {
    expect(isFull(emptyBoard())).toBe(false);
    expect(isFull(new Array<number>(81).fill(1))).toBe(true);
  });
});

describe("formatTime", () => {
  it("formats mm:ss", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(9)).toBe("00:09");
    expect(formatTime(72)).toBe("01:12");
    expect(formatTime(3599)).toBe("59:59");
  });
});
