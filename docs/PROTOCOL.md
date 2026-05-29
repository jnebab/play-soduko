# Protocol — the contract

This file is the **single source of truth** for client/server messages and data shapes. The TS types in `apps/web` and the Pydantic models in `apps/api` must mirror it. If they disagree, this doc wins (update it deliberately).

> A cell index is `0..80` (`row*9 + col`). A digit is `1..9`. `0`/`null` = empty.

## Shared shapes
```ts
type Difficulty = "easy" | "medium" | "hard" | "expert";
type CellState  = "given" | "filled" | "wrong" | "empty";   // shadow grid uses these — NEVER digits

interface PlayerPublic { id: string; handle: string; rating: number; }

// What spectators/opponents see of a player — STATES ONLY, no values
interface ShadowProgress {
  playerId: string;
  cells: CellState[];      // length 81, no digits
  filled: number;          // 0..81
  mistakes: number;
  elapsedMs: number;
}
```

## Client → Server
```ts
type ClientMsg =
  | { t: "joinQueue"; difficulty: Difficulty }
  | { t: "joinRoom"; code: string }
  | { t: "ready" }                                   // ack countdown
  | { t: "placeMove"; cell: number; value: number }  // value 1..9
  | { t: "eraseMove"; cell: number }
  | { t: "noteMove";  cell: number; value: number }  // toggle pencil mark (local-ish; server tracks fill state)
  | { t: "ping" };
```
Rules: server **ignores** moves targeting given/locked cells and any move from a spectator connection. `value`/`cell` are range-checked server-side.

## Server → Client
```ts
type ServerMsg =
  | { t: "matchFound"; matchId: string; players: PlayerPublic[]; difficulty: Difficulty }
  | { t: "countdown"; secondsLeft: number }
  | { t: "matchStart"; givens: number[]; startTs: number; players: PlayerPublic[] }  // givens length 81; NO solution
  | { t: "moveAck"; cell: number; ok: boolean }      // private: correctness for the mover only
  | { t: "opponentProgress"; progress: ShadowProgress }   // coalesced ~3/s per player
  | { t: "stateSnapshot"; you: { cells: number[]; notes: number[][] };
      opponents: ShadowProgress[]; startTs: number; serverNow: number }            // on (re)connect
  | { t: "matchOver"; results: MatchResult[] }
  | { t: "error"; code: string; message: string }
  | { t: "pong" };

interface MatchResult { playerId: string; placement: number; finishMs: number | null; mistakes: number; ratingDelta: number; }
```
Notes:
- `matchStart.givens` is the **only** board data the client ever receives. The solution stays server-side.
- `moveAck.ok` is the mover's private correctness signal; opponents only ever get `opponentProgress`.
- Official time = `serverReceiveTs(completing move) − startTs`; `serverNow` lets clients correct drift.

## REST (auth, matchmaking fallback, data)
```
GET  /health
GET  /me
POST /auth/...                  # session / token (mechanism TBD)
GET  /puzzles/next?difficulty=  # returns { id, givens } — NEVER solution
POST /matches                   # create/queue (alt to WS joinQueue)
GET  /matches/{id}              # post-game summary
GET  /leaderboard?window=
```

## Data model (Postgres / SQLModel)
```
users(id pk, handle, rating int, created_at)
puzzles(id pk, difficulty, givens int[81], solution int[81]  -- SERVER ONLY, never serialized out)
matches(id pk, puzzle_id fk, status, started_at, ended_at, winner_id fk?)
match_players(match_id fk, user_id fk, finish_ms int?, mistakes int, placement int, pk(match_id,user_id))
```
