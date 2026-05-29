# CLAUDE.md — Project context for Claude Code

> Read this first, then `docs/IMPLEMENTATION_PLAN.md`. Work **one phase at a time**, open a PR per phase, keep `main` green.

## What we're building
**Sudoku Arena** (working title) — a Sudoku game with two modes:
1. **Solo** — a polished single-player puzzle (already prototyped, see "Current status").
2. **Arena** — realtime competitive mode: N players race the **same** puzzle on a synchronized, server-authoritative timer. Everyone watches everyone's progress fill in **live**, but **no one ever sees an opponent's digits**. Fastest correct completion wins.

## Current status
- ✅ **Solo gameplay is designed and a working prototype exists** at `apps/web/src/_seed/Sudoku.jsx` (React, validated). Engine generates a unique-solution puzzle per difficulty in <35ms. **Phase 1 ports this into the real app — do not rebuild from scratch.**
- ✅ Multiplayer architecture is fully designed — see `docs/ARCHITECTURE.md`.
- 🔲 Nothing else is built yet. Backend, realtime, and Arena UI are greenfield.

## Locked decisions — do NOT re-litigate
| Topic | Decision |
|---|---|
| Input model | **Tap a cell, then tap a number.** Tapping the same number again clears it. Number pad pinned to thumb zone. |
| Theme | **Light + dark toggle.** Palette = "Quiet Ink" (warm paper / coral) — preserved from the seed. |
| Errors (solo) | **Show errors instantly, no strike limit.** Wrong entry turns red + bumps a mistakes counter; never ends the game. |
| Source of truth (arena) | **Server-authoritative.** Solution never reaches the client. Server validates every move and owns the clock. |
| Win timing (arena) | Official finish = **server receive-time of the completing move** − `startTs`. Client clocks are display-only. |
| Match ownership (arena) | **One authority owner per match** (consistent hash of `matchId`) so move-validation / win-detection are serialized. |
| Opponent visibility | **Shadow grid**: broadcast cell *states* only (`given|filled|wrong|empty`), never values. See `docs/PROTOCOL.md`. |

## Tech stack
**Frontend** — React + TypeScript (strict), Vite, XState (match lifecycle), TanStack Query (REST), native `WebSocket` wrapped in a typed reconnecting client. Styling via scoped CSS variables (no Tailwind in the seed; keep it that way unless we agree otherwise).

**Backend** — Python 3.12+, **uv** for packaging, **FastAPI** (ASGI + WebSockets), **Pydantic v2**, **SQLModel** over PostgreSQL, **ARQ** for the puzzle-generation worker, **Redis 7** for pub/sub + ephemeral match state + queue.

**Infra (dev)** — `docker-compose` for Postgres + Redis. Unified commands via the root `Makefile`.

## Repo layout (monorepo)
```
sudoku-arena/
├─ CLAUDE.md                  ← you are here
├─ README.md
├─ Makefile                   ← unified dev/test/lint commands (create in Phase 0)
├─ docker-compose.yml         ← postgres + redis (Phase 0)
├─ docs/
│  ├─ ARCHITECTURE.md         ← system design + Mermaid diagrams
│  ├─ IMPLEMENTATION_PLAN.md  ← phased tasks + acceptance criteria
│  └─ PROTOCOL.md             ← WS event + REST contract (the source of truth)
├─ apps/
│  ├─ web/                    ← React + TS client (solo + arena)
│  │  └─ src/_seed/Sudoku.jsx ← validated solo prototype → refactor in Phase 1, then delete
│  └─ api/                    ← FastAPI: gateway + authority + matchmaking + worker
└─ packages/
   └─ engine-ts/              ← small TS helpers (board model, duplicate-conflict highlight). NO solver/solution on client.
```
> Puzzle **generation + solution** live ONLY in Python (`apps/api`). The TS engine package is render/UX helpers only.

## Conventions
- **TypeScript**: `strict: true`, no `any`, prefer discriminated unions for WS messages (mirror `docs/PROTOCOL.md` exactly).
- **Python**: fully type-hinted, Pydantic models for all boundaries, `ruff` + `mypy` clean.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`…). One PR per phase.
- **Tests**: engine logic (TS + Py) is unit-tested; the Python generator must assert **unique solution** (solution-count ≤ 2 stops early). Realtime paths get integration tests.
- **No secrets in repo.** `.env.example` only.

## Guardrails (security — these are not optional)
- The **solution array is server-only**. Never serialize it to any client payload, log, or the `puzzles` API response.
- Clients receive **givens only**; correctness comes back as a server `moveAck`.
- Validate **every** move server-side; never trust a client-claimed "done".
- Rate-limit moves per connection; flag anomalous (superhuman) solve curves.
- Spectators are **read-only** — reject any inbound move on a spectator connection.

## Where to start
Open `docs/IMPLEMENTATION_PLAN.md` and begin **Phase 0**. Confirm the scaffold plan with the user before generating large amounts of code.
