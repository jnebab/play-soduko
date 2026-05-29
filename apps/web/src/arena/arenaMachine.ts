import { assign, setup } from "xstate";
import type { Difficulty, MatchResult, PlayerPublic } from "@sudoku/engine";

export interface ArenaContext {
  matchId: string | null;
  difficulty: Difficulty | null;
  players: PlayerPublic[];
  secondsLeft: number;
  startTs: number | null;
  results: MatchResult[];
  error: string | null;
}

export type ArenaEvent =
  | { type: "CONNECTED" }
  | { type: "MATCH_FOUND"; matchId: string; players: PlayerPublic[]; difficulty: Difficulty }
  | { type: "COUNTDOWN"; secondsLeft: number }
  | { type: "MATCH_START"; startTs: number; players: PlayerPublic[] }
  | { type: "MATCH_OVER"; results: MatchResult[] }
  | { type: "SERVER_ERROR"; code: string; message: string };

/**
 * Match lifecycle, mirroring docs/ARCHITECTURE.md:
 *   connecting → queue → countdown → playing → finished
 * with a terminal `failed` state for protocol errors. Reconnection does not
 * change phase (the socket layer handles it); a stateSnapshot simply refreshes
 * board/opponent data held outside this machine.
 */
export const arenaMachine = setup({
  types: {
    context: {} as ArenaContext,
    events: {} as ArenaEvent,
  },
  actions: {
    setMatch: assign(({ event }) => {
      if (event.type !== "MATCH_FOUND") return {};
      return { matchId: event.matchId, players: event.players, difficulty: event.difficulty };
    }),
    setCountdown: assign(({ event }) =>
      event.type === "COUNTDOWN" ? { secondsLeft: event.secondsLeft } : {},
    ),
    setStart: assign(({ event }) =>
      event.type === "MATCH_START" ? { startTs: event.startTs, players: event.players } : {},
    ),
    setResults: assign(({ event }) =>
      event.type === "MATCH_OVER" ? { results: event.results } : {},
    ),
    setError: assign(({ event }) =>
      event.type === "SERVER_ERROR" ? { error: event.message } : {},
    ),
  },
}).createMachine({
  id: "arena",
  initial: "connecting",
  context: {
    matchId: null,
    difficulty: null,
    players: [],
    secondsLeft: 3,
    startTs: null,
    results: [],
    error: null,
  },
  on: {
    SERVER_ERROR: { target: ".failed", actions: "setError" },
  },
  states: {
    connecting: {
      on: { CONNECTED: "queue", MATCH_FOUND: { target: "countdown", actions: "setMatch" } },
    },
    queue: {
      on: { MATCH_FOUND: { target: "countdown", actions: "setMatch" } },
    },
    countdown: {
      on: {
        COUNTDOWN: { actions: "setCountdown" },
        MATCH_START: { target: "playing", actions: "setStart" },
      },
    },
    playing: {
      on: { MATCH_OVER: { target: "finished", actions: "setResults" } },
    },
    finished: { type: "final" },
    failed: {},
  },
});
