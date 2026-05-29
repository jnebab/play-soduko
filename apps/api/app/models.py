"""Durable data model (see docs/PROTOCOL.md).

`givens` and `solution` are stored as JSON arrays of 81 ints for portability
across SQLite (dev/test) and Postgres (prod). The `solution` column is
SERVER-ONLY and must never be serialized into any API response.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=_uuid, primary_key=True)
    handle: str = Field(index=True)
    rating: int = Field(default=1000)
    created_at: datetime = Field(default_factory=_now)


class Puzzle(SQLModel, table=True):
    __tablename__ = "puzzles"

    id: str = Field(default_factory=_uuid, primary_key=True)
    difficulty: str = Field(index=True)
    givens: list[int] = Field(sa_column=Column(JSON))
    # SERVER-ONLY — never serialized to a client.
    solution: list[int] = Field(sa_column=Column(JSON))
    used: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=_now)


class Match(SQLModel, table=True):
    __tablename__ = "matches"

    id: str = Field(default_factory=_uuid, primary_key=True)
    puzzle_id: str = Field(foreign_key="puzzles.id")
    difficulty: str
    status: str = Field(default="playing")  # playing | finished
    started_at: datetime | None = None
    ended_at: datetime | None = None
    winner_id: str | None = Field(default=None, foreign_key="users.id")


class MatchPlayer(SQLModel, table=True):
    __tablename__ = "match_players"

    match_id: str = Field(foreign_key="matches.id", primary_key=True)
    user_id: str = Field(foreign_key="users.id", primary_key=True)
    finish_ms: int | None = None
    mistakes: int = Field(default=0)
    placement: int = Field(default=0)
    rating_delta: int = Field(default=0)
