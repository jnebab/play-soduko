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

## Status
Solo prototype validated (see `apps/web/src/_seed/`). Everything else is being built phase by phase per the implementation plan.
