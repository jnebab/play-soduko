# Implementation plan

Work top to bottom. **One PR per phase.** Each phase lists tasks and an acceptance bar — don't move on until the bar is green.

---

## Phase 0 — Repo scaffold & tooling
- [ ] pnpm workspace + Turborepo for `apps/web` and `packages/engine-ts`.
- [ ] `apps/web`: Vite + React + TS (`strict`), ESLint + Prettier, Vitest.
- [ ] `apps/api`: `uv` project, FastAPI, Pydantic v2, ruff + mypy, pytest.
- [ ] `docker-compose.yml`: Postgres 16 + Redis 7. `.env.example`.
- [ ] Root `Makefile`: `dev`, `test`, `lint`, `up` (compose), `down`.
- [ ] CI (GitHub Actions): lint + test on PR for both stacks.
- **Acceptance:** `make up && make dev` runs an empty web app + a FastAPI `/health` returning 200; `make test && make lint` pass in CI.

## Phase 1 — Solo game (port the seed, don't rebuild)
- [ ] Extract the engine from `_seed/Sudoku.jsx` → `packages/engine-ts`: typed `Board`, `Difficulty`, duplicate-conflict detection, **no solver/solution on client**.
- [ ] Refactor the UI into typed components: `<Board/>`, `<Cell/>`, `<NumberPad/>`, `<Controls/>`, `<Home/>`, `<Solved/>`; lift state into a reducer or small store.
- [ ] Keep the locked decisions: tap-cell→number, light/dark toggle, errors-shown-no-limit, "Quiet Ink" palette.
- [ ] Unit tests for engine helpers. Delete `_seed/` once parity is reached.
- **Acceptance:** solo mode plays identically to the prototype, fully typed, tests green, no `any`.

## Phase 2 — Backend foundation
- [ ] Python puzzle engine `apps/api/.../sudoku.py`: generate solved grid, dig to unique puzzle per difficulty (count-solutions ≤ 2 early-exit), solver for hints.
- [ ] SQLModel models + migrations: `users`, `puzzles`, `matches`, `match_players` (see PROTOCOL.md).
- [ ] ARQ worker: pre-generate a puzzle pool per difficulty into Postgres; a "pool low" trigger to top it up.
- [ ] REST: `POST /matches` (or queue), `GET /puzzles/next` (givens only — **never** solution), `GET /me`, leaderboard.
- **Acceptance:** worker fills the pool; a unit test asserts every generated puzzle has a **unique** solution; no endpoint ever returns `solution`.

## Phase 3 — Realtime core (the heart)
- [ ] Typed WS endpoint on FastAPI; connection auth + heartbeat ping/pong.
- [ ] **Game Authority**: per-match in-memory state, holds solution, validates moves, owns the asyncio timer, detects first correct completion.
- [ ] Redis pub/sub: gateway publishes inbound moves to the match channel; authority publishes sanitized events back; gateways fan out to their sockets.
- [ ] Match lifecycle: `queue → countdown(3·2·1) → playing → finished`; broadcast `matchStart{givens, startTs}` simultaneously.
- [ ] Implement the full `docs/PROTOCOL.md` message set, incl. `stateSnapshot` on reconnect.
- **Acceptance:** integration test — two simulated clients join, both place moves, only the **server** decides the winner by receive-time; the losing client never received any opponent digit in any frame.

## Phase 4 — Arena client
- [ ] Reconnecting typed WS client (backoff, outbound queue, heartbeat) + XState machine mirroring the lifecycle.
- [ ] Matchmaking UI (quick match + room code), synchronized countdown.
- [ ] Opponent panels rendering **shadow grids** + live counters (filled / mistakes / time); server-synced timer from `startTs`.
- [ ] Optimistic local placement reconciled by `moveAck`; local duplicate-conflict highlight for feel.
- [ ] Win/lose/results screen.
- **Acceptance:** two browsers race the same board; progress animates live with **no digits** leaked; reconnect mid-match restores state from `stateSnapshot`.

## Phase 5 — Integrity, results & ranking
- [ ] Per-connection move rate-limit; reject moves from spectator sockets; anomaly flagging on solve curves.
- [ ] Persist results + placements; ELO update; leaderboard endpoint + screen.
- **Acceptance:** a scripted "instant solve" client is flagged/rejected; results and ratings persist correctly.

## Phase 6 — Polish & deploy
- [ ] Mobile pass (touch targets, safe-area, haptics-feel), a11y, error/empty states.
- [ ] Observability: structured logs, basic metrics (active matches, fan-out rate).
- [ ] Deploy: containerize api, host web (static), managed Postgres + Redis; document env.
- **Acceptance:** a stranger on a phone can quick-match and finish a game end-to-end on the deployed URL.
