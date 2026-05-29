import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  emptyNotes,
  findConflicts,
  peersOf,
  remainingDigits,
  type Board,
  type Difficulty,
  type Notes,
} from "@sudoku/engine";
import { makePuzzle } from "./generator.js";

const HINTS = 3;

interface Snapshot {
  board: Board;
  notes: Notes;
  mistakes: number;
  hintSet: number[];
}

export interface SoloState {
  difficulty: Difficulty;
  solution: Board; // solo-only
  board: Board;
  given: boolean[];
  hintSet: Set<number>;
  notes: Notes;
  sel: number | null;
  notesMode: boolean;
  mistakes: number;
  hintsLeft: number;
  history: Snapshot[];
  status: "playing" | "solved";
}

type Action =
  | { type: "start"; difficulty: Difficulty }
  | { type: "select"; idx: number }
  | { type: "place"; digit: number }
  | { type: "erase" }
  | { type: "undo" }
  | { type: "hint" }
  | { type: "toggleNotes" };

function init(difficulty: Difficulty): SoloState {
  const { puzzle, solution } = makePuzzle(difficulty);
  return {
    difficulty,
    solution,
    board: puzzle.slice(),
    given: puzzle.map((v) => v !== 0),
    hintSet: new Set<number>(),
    notes: emptyNotes(),
    sel: null,
    notesMode: false,
    mistakes: 0,
    hintsLeft: HINTS,
    history: [],
    status: "playing",
  };
}

const isLocked = (s: SoloState, i: number): boolean => s.given[i] === true || s.hintSet.has(i);
const snap = (s: SoloState): Snapshot => ({
  board: s.board.slice(),
  notes: s.notes.map((n) => n.slice()),
  mistakes: s.mistakes,
  hintSet: [...s.hintSet],
});
const hasWon = (board: Board, solution: Board): boolean =>
  board.every((v, i) => v === solution[i]);

function reducer(s: SoloState, a: Action): SoloState {
  switch (a.type) {
    case "start":
      return init(a.difficulty);

    case "select":
      return { ...s, sel: a.idx };

    case "toggleNotes":
      return { ...s, notesMode: !s.notesMode };

    case "place": {
      const { sel } = s;
      if (sel == null || isLocked(s, sel) || s.status !== "playing") return s;
      const history = [...s.history, snap(s)];
      const board = s.board.slice();
      const notes = s.notes.map((n) => n.slice());
      let mistakes = s.mistakes;

      if (s.notesMode && board[sel] === 0) {
        const arr = notes[sel] ?? [];
        const k = arr.indexOf(a.digit);
        if (k >= 0) arr.splice(k, 1);
        else {
          arr.push(a.digit);
          arr.sort((x, y) => x - y);
        }
        notes[sel] = arr;
        return { ...s, board, notes, history };
      }

      if (board[sel] === a.digit) {
        board[sel] = 0;
      } else {
        board[sel] = a.digit;
        notes[sel] = [];
        for (const p of peersOf(sel)) {
          const pn = notes[p] ?? [];
          const k = pn.indexOf(a.digit);
          if (k >= 0) pn.splice(k, 1);
        }
        if (a.digit !== s.solution[sel]) mistakes += 1;
      }
      const status = hasWon(board, s.solution) ? "solved" : "playing";
      return { ...s, board, notes, mistakes, history, status };
    }

    case "erase": {
      const { sel } = s;
      if (sel == null || isLocked(s, sel)) return s;
      if (s.board[sel] === 0 && (s.notes[sel]?.length ?? 0) === 0) return s;
      const history = [...s.history, snap(s)];
      const board = s.board.slice();
      const notes = s.notes.map((n) => n.slice());
      board[sel] = 0;
      notes[sel] = [];
      return { ...s, board, notes, history };
    }

    case "undo": {
      const last = s.history[s.history.length - 1];
      if (!last) return s;
      return {
        ...s,
        board: last.board,
        notes: last.notes,
        mistakes: last.mistakes,
        hintSet: new Set(last.hintSet),
        history: s.history.slice(0, -1),
      };
    }

    case "hint": {
      if (s.hintsLeft <= 0 || s.status !== "playing") return s;
      let t = s.sel;
      if (t == null || s.board[t] !== 0 || isLocked(s, t)) t = s.board.findIndex((v) => v === 0);
      if (t == null || t === -1) return s;
      const history = [...s.history, snap(s)];
      const board = s.board.slice();
      const notes = s.notes.map((n) => n.slice());
      const value = s.solution[t] ?? 0;
      board[t] = value;
      notes[t] = [];
      for (const p of peersOf(t)) {
        const pn = notes[p] ?? [];
        const k = pn.indexOf(value);
        if (k >= 0) pn.splice(k, 1);
      }
      const hintSet = new Set(s.hintSet).add(t);
      const status = hasWon(board, s.solution) ? "solved" : "playing";
      return { ...s, board, notes, hintSet, history, hintsLeft: s.hintsLeft - 1, sel: t, status };
    }

    default:
      return s;
  }
}

export interface SoloGame {
  state: SoloState;
  time: number;
  paused: boolean;
  conflicts: Set<number>;
  remaining: number[];
  select: (idx: number) => void;
  place: (digit: number) => void;
  erase: () => void;
  undo: () => void;
  hint: () => void;
  toggleNotes: () => void;
  setPaused: (p: boolean) => void;
}

export function useSoloGame(difficulty: Difficulty): SoloGame {
  const [state, dispatch] = useReducer(reducer, difficulty, init);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const solvedAt = useRef<number | null>(null);

  // tick once per second while playing and not paused
  useEffect(() => {
    if (state.status !== "playing" || paused) return;
    const id = window.setInterval(() => setTime((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [state.status, paused]);

  // freeze the solve time exactly once
  if (state.status === "solved" && solvedAt.current === null) {
    solvedAt.current = time;
  }

  const conflicts = useMemo(() => findConflicts(state.board), [state.board]);
  const remaining = useMemo(() => remainingDigits(state.board), [state.board]);

  return {
    state,
    time: state.status === "solved" ? (solvedAt.current ?? time) : time,
    paused,
    conflicts,
    remaining,
    select: useCallback((idx) => dispatch({ type: "select", idx }), []),
    place: useCallback((digit) => dispatch({ type: "place", digit }), []),
    erase: useCallback(() => dispatch({ type: "erase" }), []),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    hint: useCallback(() => dispatch({ type: "hint" }), []),
    toggleNotes: useCallback(() => dispatch({ type: "toggleNotes" }), []),
    setPaused,
  };
}
