"""REST surface (see docs/PROTOCOL.md). No endpoint ever returns a solution."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from . import store
from .db import session_scope
from .runtime import matchmaking

router = APIRouter()

Difficulty = Literal["easy", "medium", "hard", "expert"]


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/me")
async def me(
    id: str = Query(...),
    handle: str = Query("Player"),
) -> dict[str, object]:
    async with session_scope() as session:
        user = await store.get_or_create_user(session, id, handle)
        return {"id": user.id, "handle": user.handle, "rating": user.rating}


@router.get("/puzzles/next")
async def puzzles_next(difficulty: Difficulty = "medium") -> dict[str, object]:
    """Givens only — the solution stays server-side."""
    return await store.next_puzzle_public(difficulty)


class CreateMatchBody(BaseModel):
    difficulty: Difficulty = "medium"


@router.post("/matches")
async def create_match(body: CreateMatchBody) -> dict[str, str]:
    """Reserve a room code; players then connect via WS and joinRoom(code).

    The realtime path (WS joinQueue/joinRoom) is primary; this is the fallback.
    """
    code = matchmaking.reserve_room(body.difficulty)
    return {"code": code, "difficulty": body.difficulty}


@router.get("/matches/{match_id}")
async def match_summary(match_id: str) -> dict[str, object]:
    summary = await store.get_match_summary(match_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="match not found")
    return summary


@router.get("/leaderboard")
async def leaderboard(
    window: str = "all", limit: int = Query(20, ge=1, le=100)
) -> dict[str, object]:
    return {"window": window, "entries": await store.leaderboard(limit)}
