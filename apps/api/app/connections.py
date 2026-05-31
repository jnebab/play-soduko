"""Connection registry — owns socket I/O so game logic stays transport-agnostic.

In single-process MVP mode this IS the fan-out layer. The scale path swaps it
for Redis pub/sub across stateless gateways without changing the protocol.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

from .schemas import ServerMsg

log = logging.getLogger("sudoku.connections")


class Socket(Protocol):
    async def send_text(self, data: str) -> None: ...


@dataclass
class Player:
    id: str
    handle: str
    rating: int = 1000
    socket: Socket | None = None
    match_id: str | None = None
    is_bot: bool = False
    # simple per-connection move-rate accounting (token-bucket-ish)
    _window_start: float = 0.0
    _window_count: int = 0

    @property
    def online(self) -> bool:
        return self.socket is not None


class ConnectionManager:
    def __init__(self) -> None:
        self.players: dict[str, Player] = {}

    def connect(self, player_id: str, handle: str, socket: Socket, rating: int) -> Player:
        existing = self.players.get(player_id)
        if existing is not None:
            existing.socket = socket
            existing.handle = handle
            existing.rating = rating
            return existing
        player = Player(id=player_id, handle=handle, rating=rating, socket=socket)
        self.players[player_id] = player
        return player

    def register_bot(self, player_id: str, handle: str, rating: int) -> Player:
        """A socketless participant (manager.send is a no-op for it)."""
        player = Player(id=player_id, handle=handle, rating=rating, socket=None, is_bot=True)
        self.players[player_id] = player
        return player

    def remove(self, player_id: str) -> None:
        self.players.pop(player_id, None)

    def disconnect(self, player_id: str, socket: Socket) -> None:
        player = self.players.get(player_id)
        if player is not None and player.socket is socket:
            player.socket = None

    def get(self, player_id: str) -> Player | None:
        return self.players.get(player_id)

    async def send(self, player_id: str, msg: ServerMsg) -> None:
        player = self.players.get(player_id)
        if player is None or player.socket is None:
            return
        try:
            await player.socket.send_text(msg.model_dump_json())
        except Exception:  # noqa: BLE001 - a dead socket should not crash the match
            log.debug("send failed for %s; marking offline", player_id)
            player.socket = None
