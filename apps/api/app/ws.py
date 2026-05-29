"""WebSocket gateway endpoint.

Auth (MVP): the client supplies a stable ``id`` + ``handle`` as query params
(anonymous identity persisted client-side). Heartbeat via ping/pong. Inbound
moves are rate-limited and routed to the match's GameAuthority. Reconnects get
a ``stateSnapshot`` replay.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from . import store
from .connections import Player
from .db import session_scope
from .runtime import manager, matchmaking, settings
from .schemas import (
    CLIENT_MSG_ADAPTER,
    EraseMove,
    ErrorMsg,
    JoinQueue,
    JoinRoom,
    NoteMove,
    Ping,
    PlaceMove,
    Pong,
    Ready,
)

log = logging.getLogger("sudoku.ws")

router = APIRouter()

_MOVE_TYPES = (PlaceMove, EraseMove, NoteMove)


def _rate_limited(player: Player) -> bool:
    now = time.monotonic()
    if now - player._window_start >= 1.0:
        player._window_start = now
        player._window_count = 0
    player._window_count += 1
    return player._window_count > settings.move_rate_limit


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    player_id = websocket.query_params.get("id")
    handle = websocket.query_params.get("handle") or "Player"
    if not player_id:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    # upsert user, read rating
    async with session_scope() as session:
        user = await store.get_or_create_user(session, player_id, handle)
        rating = user.rating

    player = manager.connect(player_id, handle, websocket, rating)

    # reconnect: replay snapshot if mid-match
    authority = matchmaking.authority_for(player)
    if authority is not None and authority.status == "playing":
        await manager.send(player_id, authority.snapshot_for(player_id))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = CLIENT_MSG_ADAPTER.validate_json(raw)
            except ValidationError:
                await manager.send(player_id, ErrorMsg(code="bad_message", message="malformed"))
                continue

            if isinstance(msg, Ping):
                await manager.send(player_id, Pong())
                continue

            if isinstance(msg, _MOVE_TYPES):
                if _rate_limited(player):
                    await manager.send(
                        player_id, ErrorMsg(code="rate_limited", message="slow down")
                    )
                    continue
                authority = matchmaking.authority_for(player)
                if authority is not None:
                    await authority.handle_move(player_id, msg)
                continue

            if isinstance(msg, JoinQueue):
                await matchmaking.join_queue(player, msg.difficulty)
            elif isinstance(msg, JoinRoom):
                await matchmaking.join_room(player, msg.code)
            elif isinstance(msg, Ready):
                pass  # countdown is automatic in MVP
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("ws loop error for %s", player_id)
    finally:
        manager.disconnect(player_id, websocket)
        matchmaking.cancel_from_queues(player_id)
