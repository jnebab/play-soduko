/**
 * Wire protocol — the single source of truth is docs/PROTOCOL.md.
 * These discriminated unions MUST mirror it (and the Pydantic models in
 * apps/api). If they disagree, the doc wins.
 */
import type { CellState, Difficulty } from "./types.js";

export interface PlayerPublic {
  id: string;
  handle: string;
  rating: number;
}

/** What spectators/opponents see of a player — STATES ONLY, no values. */
export interface ShadowProgress {
  playerId: string;
  cells: CellState[]; // length 81, no digits
  filled: number; // 0..81
  mistakes: number;
  elapsedMs: number;
}

export interface MatchResult {
  playerId: string;
  placement: number;
  finishMs: number | null;
  mistakes: number;
  ratingDelta: number;
}

/* ----------------------------- Client → Server ---------------------------- */

export type ClientMsg =
  | { t: "joinQueue"; difficulty: Difficulty }
  | { t: "joinRoom"; code: string }
  | { t: "ready" }
  | { t: "placeMove"; cell: number; value: number }
  | { t: "eraseMove"; cell: number }
  | { t: "noteMove"; cell: number; value: number }
  | { t: "ping" };

/* ----------------------------- Server → Client ---------------------------- */

export type ServerMsg =
  | { t: "matchFound"; matchId: string; players: PlayerPublic[]; difficulty: Difficulty }
  | { t: "countdown"; secondsLeft: number }
  | { t: "matchStart"; givens: number[]; startTs: number; players: PlayerPublic[] }
  | { t: "moveAck"; cell: number; ok: boolean }
  | { t: "opponentProgress"; progress: ShadowProgress }
  | {
      t: "stateSnapshot";
      you: { cells: number[]; notes: number[][] };
      opponents: ShadowProgress[];
      startTs: number;
      serverNow: number;
    }
  | { t: "matchOver"; results: MatchResult[] }
  | { t: "error"; code: string; message: string }
  | { t: "pong" };

export type ServerMsgType = ServerMsg["t"];
export type ClientMsgType = ClientMsg["t"];
