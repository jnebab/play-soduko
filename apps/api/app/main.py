"""FastAPI application: REST + WebSocket gateway + game authority (MVP single process)."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import rest, store, ws
from .db import engine, init_db
from .runtime import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("sudoku")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await init_db()
    try:
        await store.ensure_pool(settings.pool_target)
    except Exception:  # noqa: BLE001 - pool fill should never block startup
        log.exception("initial pool fill failed (will generate on demand)")
    log.info("Sudoku Arena API ready (db=%s, redis=%s)", settings.database_url, settings.redis_url)
    yield
    await engine.dispose()


app = FastAPI(title="Sudoku Arena", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rest.router)
app.include_router(ws.router)
