"""ARQ worker: pre-generates a unique-solution puzzle pool per difficulty.

Runs `ensure_pool` on a short cron so match start is instant (no gen latency at
GO). Requires Redis (REDIS_URL). The API also tops up on startup and generates
on demand, so the worker is an optimization, not a hard dependency.

Run with:  uv run arq app.worker.WorkerSettings
"""

from __future__ import annotations

import logging
from typing import Any

from arq import cron
from arq.connections import RedisSettings

from .config import get_settings
from .db import init_db
from .store import ensure_pool

log = logging.getLogger("sudoku.worker")
_settings = get_settings()


async def fill_pool(_ctx: dict[str, Any]) -> int:
    return await ensure_pool(_settings.pool_target)


async def startup(_ctx: dict[str, Any]) -> None:
    await init_db()
    await ensure_pool(_settings.pool_target)
    log.info("puzzle worker started")


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(_settings.redis_url or "redis://localhost:6379")
    functions = [fill_pool]
    cron_jobs = [cron(fill_pool, second={0, 30})]  # type: ignore[arg-type]  # top up 2x/min
    on_startup = startup
