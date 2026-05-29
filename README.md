# Sudoku Arena

A Sudoku game with a twist: **Arena mode** lets players race the *same* puzzle on a synchronized, server-authoritative timer. You watch opponents' boards fill in **live** — but you never see their digits. Fastest correct solve wins.

- **Solo** — polished single-player (tap cell → number, light/dark, instant error highlight, notes, hints).
- **Arena** — realtime multiplayer race with privacy-preserving live spectating.

## Stack
React + TS (Vite) · FastAPI (uv) · Redis · PostgreSQL · ARQ workers · WebSockets.

## Quickstart
```bash
make up      # postgres + redis via docker-compose
make dev     # web + api in watch mode
make test    # all tests
make lint    # ruff/mypy + eslint/tsc
```

## Docs
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design + diagrams
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — phased roadmap
- [`docs/PROTOCOL.md`](docs/PROTOCOL.md) — WS + REST contract
- [`CLAUDE.md`](CLAUDE.md) — context & conventions for Claude Code

## Running locally

With Docker (full parity — Postgres 16 + Redis 7):

```bash
make install   # pnpm install + uv sync
make up        # postgres + redis
make dev       # web (:5173) + api (:8000)
```

Without Docker (MVP single-process mode): the API falls back to a local
**SQLite** database and an **in-process** message bus when `DATABASE_URL` /
`REDIS_URL` are unset, so it runs with zero infra:

```bash
make install
make dev-api   # FastAPI on :8000 (SQLite + in-process fan-out)
make dev-web   # Vite on :5173
```

Commands: `make test` (web + api), `make lint` (eslint/tsc + ruff/mypy),
`make help` for the full list.

## Architecture notes

- **Solo** is a self-contained, offline-capable mode: the puzzle generator is an
  app-local module (`apps/web/src/solo/generator.ts`) used **only** by solo. The
  shared `packages/engine-ts` stays free of any solver/solution (board model +
  duplicate-conflict detection + protocol types only).
- **Arena** keeps the solution strictly server-side. Clients receive `givens`
  only; correctness comes back as a `moveAck`. The win is decided by the server's
  receive-time of the completing move. Opponent boards are broadcast as
  **shadow grids** (cell states only — never digits).
- The puzzle worker (ARQ) pre-generates a pool when Redis is configured; the API
  also tops up on startup and generates on demand, so it is an optimization, not
  a hard dependency.

## Status
Solo, backend, realtime core, and the Arena client are implemented per the
phased plan. Tests are green across both stacks (`make test`).
