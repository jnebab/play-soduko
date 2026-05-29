"""Database access: users, puzzle pool, match lifecycle persistence."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col

from .db import session_scope
from .models import Match, MatchPlayer, Puzzle, User
from .rating import Standing, compute_deltas
from .schemas import MatchResult
from .sudoku import CLUE_TARGETS, make_puzzle

log = logging.getLogger("sudoku.store")


def _now() -> datetime:
    return datetime.now(UTC)


async def get_or_create_user(session: AsyncSession, user_id: str, handle: str) -> User:
    user = await session.get(User, user_id)
    if user is None:
        user = User(id=user_id, handle=handle)
        session.add(user)
        await session.commit()
        await session.refresh(user)
    elif user.handle != handle:
        user.handle = handle
        session.add(user)
        await session.commit()
    return user


async def _generate_puzzle_row(difficulty: str) -> Puzzle:
    # generation is CPU-bound; keep the event loop responsive
    givens, solution = await asyncio.to_thread(make_puzzle, difficulty)
    return Puzzle(difficulty=difficulty, givens=givens, solution=solution, used=False)


async def ensure_pool(target: int) -> int:
    """Top each difficulty up to `target` unused puzzles. Returns total added."""
    added = 0
    async with session_scope() as session:
        for difficulty in CLUE_TARGETS:
            count = await session.scalar(
                select(func.count())
                .select_from(Puzzle)
                .where(col(Puzzle.difficulty) == difficulty, col(Puzzle.used).is_(False))
            )
            need = max(0, target - int(count or 0))
            for _ in range(need):
                session.add(await _generate_puzzle_row(difficulty))
                added += 1
        if added:
            await session.commit()
    if added:
        log.info("pool topped up: +%d puzzles", added)
    return added


async def claim_puzzle(difficulty: str) -> Puzzle:
    """Atomically take one unused puzzle of `difficulty`, generating if empty."""
    async with session_scope() as session:
        row = await session.scalar(
            select(Puzzle)
            .where(col(Puzzle.difficulty) == difficulty, col(Puzzle.used).is_(False))
            .limit(1)
        )
        if row is None:
            row = await _generate_puzzle_row(difficulty)
            row.used = True
            session.add(row)
        else:
            row.used = True
            session.add(row)
        await session.commit()
        await session.refresh(row)
        return row


async def next_puzzle_public(difficulty: str) -> dict[str, object]:
    """A puzzle for the solo/REST path — givens ONLY, never the solution."""
    puzzle = await claim_puzzle(difficulty)
    return {"id": puzzle.id, "difficulty": puzzle.difficulty, "givens": puzzle.givens}


async def create_match(puzzle_id: str, difficulty: str, player_ids: list[str]) -> str:
    async with session_scope() as session:
        match = Match(
            puzzle_id=puzzle_id,
            difficulty=difficulty,
            status="playing",
            started_at=_now(),
        )
        session.add(match)
        await session.commit()
        await session.refresh(match)
        for uid in player_ids:
            session.add(MatchPlayer(match_id=match.id, user_id=uid))
        await session.commit()
        return match.id


async def finish_match(
    match_id: str,
    winner_id: str | None,
    results: list[MatchResult],
) -> list[MatchResult]:
    """Persist results + apply ELO. Returns results with ratingDelta filled in."""
    async with session_scope() as session:
        match = await session.get(Match, match_id)
        if match is None:
            return results

        # load current ratings
        standings: list[Standing] = []
        for r in results:
            user = await session.get(User, r.playerId)
            rating = user.rating if user else 1000
            standings.append(Standing(user_id=r.playerId, rating=rating, placement=r.placement))
        deltas = compute_deltas(standings)

        for r in results:
            r.ratingDelta = deltas.get(r.playerId, 0)
            await session.execute(
                update(MatchPlayer)
                .where(
                    col(MatchPlayer.match_id) == match_id,
                    col(MatchPlayer.user_id) == r.playerId,
                )
                .values(
                    finish_ms=r.finishMs,
                    mistakes=r.mistakes,
                    placement=r.placement,
                    rating_delta=r.ratingDelta,
                )
            )
            user = await session.get(User, r.playerId)
            if user is not None:
                user.rating = max(100, user.rating + r.ratingDelta)
                session.add(user)

        match.status = "finished"
        match.ended_at = _now()
        match.winner_id = winner_id
        session.add(match)
        await session.commit()
    return results


async def get_match_summary(match_id: str) -> dict[str, object] | None:
    """Post-game summary — players, placements, ratings. NEVER the solution."""
    async with session_scope() as session:
        match = await session.get(Match, match_id)
        if match is None:
            return None
        rows = await session.scalars(
            select(MatchPlayer).where(col(MatchPlayer.match_id) == match_id)
        )
        players: list[dict[str, object]] = []
        for mp in rows.all():
            user = await session.get(User, mp.user_id)
            players.append(
                {
                    "playerId": mp.user_id,
                    "handle": user.handle if user else "Player",
                    "placement": mp.placement,
                    "finishMs": mp.finish_ms,
                    "mistakes": mp.mistakes,
                    "ratingDelta": mp.rating_delta,
                }
            )
        players.sort(key=lambda p: cast(int, p["placement"]) or 99)
        return {
            "id": match.id,
            "difficulty": match.difficulty,
            "status": match.status,
            "winnerId": match.winner_id,
            "startedAt": match.started_at.isoformat() if match.started_at else None,
            "endedAt": match.ended_at.isoformat() if match.ended_at else None,
            "players": players,
        }


async def leaderboard(limit: int = 20) -> list[dict[str, object]]:
    async with session_scope() as session:
        rows = await session.scalars(select(User).order_by(col(User.rating).desc()).limit(limit))
        return [
            {"id": u.id, "handle": u.handle, "rating": u.rating}
            for u in rows.all()
        ]
