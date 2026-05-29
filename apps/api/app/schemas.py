"""Wire protocol models — mirror docs/PROTOCOL.md exactly (the doc wins).

Client→Server messages are parsed as a discriminated union on ``t``.
Server→Client messages are plain models serialized with ``model_dump``.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, TypeAdapter

Difficulty = Literal["easy", "medium", "hard", "expert"]
CellState = Literal["given", "filled", "wrong", "empty"]


class PlayerPublic(BaseModel):
    id: str
    handle: str
    rating: int


class ShadowProgress(BaseModel):
    playerId: str
    cells: list[CellState]  # length 81, no digits
    filled: int
    mistakes: int
    elapsedMs: int


class MatchResult(BaseModel):
    playerId: str
    placement: int
    finishMs: int | None
    mistakes: int
    ratingDelta: int


# --------------------------- Client → Server ---------------------------------


class JoinQueue(BaseModel):
    t: Literal["joinQueue"]
    difficulty: Difficulty


class JoinRoom(BaseModel):
    t: Literal["joinRoom"]
    code: str


class Ready(BaseModel):
    t: Literal["ready"]


class PlaceMove(BaseModel):
    t: Literal["placeMove"]
    cell: int
    value: int


class EraseMove(BaseModel):
    t: Literal["eraseMove"]
    cell: int


class NoteMove(BaseModel):
    t: Literal["noteMove"]
    cell: int
    value: int


class Ping(BaseModel):
    t: Literal["ping"]


ClientMsg = Annotated[
    JoinQueue | JoinRoom | Ready | PlaceMove | EraseMove | NoteMove | Ping,
    Field(discriminator="t"),
]

CLIENT_MSG_ADAPTER: TypeAdapter[ClientMsg] = TypeAdapter(ClientMsg)


# --------------------------- Server → Client ---------------------------------


class MatchFound(BaseModel):
    t: Literal["matchFound"] = "matchFound"
    matchId: str
    players: list[PlayerPublic]
    difficulty: Difficulty


class Countdown(BaseModel):
    t: Literal["countdown"] = "countdown"
    secondsLeft: int


class MatchStart(BaseModel):
    t: Literal["matchStart"] = "matchStart"
    givens: list[int]  # length 81; NO solution
    startTs: int
    players: list[PlayerPublic]


class MoveAck(BaseModel):
    t: Literal["moveAck"] = "moveAck"
    cell: int
    ok: bool


class OpponentProgress(BaseModel):
    t: Literal["opponentProgress"] = "opponentProgress"
    progress: ShadowProgress


class YouState(BaseModel):
    cells: list[int]
    notes: list[list[int]]


class StateSnapshot(BaseModel):
    t: Literal["stateSnapshot"] = "stateSnapshot"
    you: YouState
    opponents: list[ShadowProgress]
    startTs: int
    serverNow: int


class MatchOver(BaseModel):
    t: Literal["matchOver"] = "matchOver"
    results: list[MatchResult]


class ErrorMsg(BaseModel):
    t: Literal["error"] = "error"
    code: str
    message: str


class Pong(BaseModel):
    t: Literal["pong"] = "pong"


ServerMsg = (
    MatchFound
    | Countdown
    | MatchStart
    | MoveAck
    | OpponentProgress
    | StateSnapshot
    | MatchOver
    | ErrorMsg
    | Pong
)
