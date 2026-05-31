"""Test configuration. Sets env BEFORE the app is imported so a throwaway
SQLite file is used, the puzzle pool auto-fill is disabled, and the countdown
is instant."""

from __future__ import annotations

import asyncio
import os
import tempfile

_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)  # noqa: SIM115 - lives for the session
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_db.name}"
os.environ["POOL_TARGET"] = "0"
os.environ["REDIS_URL"] = ""
os.environ["COUNTDOWN_SECONDS"] = "0"
os.environ["BOT_ENABLED"] = "false"


def seed_puzzle(givens: list[int], solution: list[int], difficulty: str = "easy") -> None:
    """Insert a known puzzle so the next claim returns it (deterministic tests)."""

    async def _seed() -> None:
        from app.db import engine, init_db, session_scope
        from app.models import Puzzle

        await init_db()
        async with session_scope() as session:
            session.add(
                Puzzle(difficulty=difficulty, givens=givens, solution=solution, used=False)
            )
            await session.commit()
        await engine.dispose()

    asyncio.run(_seed())
