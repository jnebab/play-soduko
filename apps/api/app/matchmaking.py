"""Matchmaking: difficulty queues, room codes, and the active-match registry.

Spawns a GameAuthority per match (the match owner). In single-process MVP mode
the registry is just a dict; the scale path homes matches on authority owners by
consistent hash of matchId without changing this interface.
"""

from __future__ import annotations

import asyncio
import logging
import random
import string

from . import store
from .authority import GameAuthority
from .config import Settings
from .connections import ConnectionManager, Player
from .schemas import MatchFound, PlayerPublic

log = logging.getLogger("sudoku.matchmaking")

DEFAULT_ROOM_DIFFICULTY = "medium"


def _room_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=4))


class Matchmaking:
    def __init__(self, manager: ConnectionManager, settings: Settings) -> None:
        self.manager = manager
        self.settings = settings
        self.queues: dict[str, list[str]] = {}  # difficulty -> [player_id]
        self.rooms: dict[str, dict[str, object]] = {}  # code -> {difficulty, members:[ids]}
        self.matches: dict[str, GameAuthority] = {}
        self._lock = asyncio.Lock()

    # ------------------------------ queue ------------------------------------

    async def join_queue(self, player: Player, difficulty: str) -> None:
        async with self._lock:
            q = self.queues.setdefault(difficulty, [])
            if player.id not in q and player.match_id is None:
                q.append(player.id)
            ready = [pid for pid in q if self._available(pid)]
            if len(ready) >= self.settings.min_players:
                chosen = ready[: self.settings.min_players]
                self.queues[difficulty] = [pid for pid in q if pid not in chosen]
                await self._spawn(difficulty, chosen)

    # ------------------------------ rooms ------------------------------------

    async def join_room(self, player: Player, code: str) -> None:
        code = code.upper()
        async with self._lock:
            room = self.rooms.get(code)
            if room is None:
                self.rooms[code] = {
                    "difficulty": DEFAULT_ROOM_DIFFICULTY,
                    "members": [player.id],
                }
                return
            members: list[str] = room["members"]  # type: ignore[assignment]
            if player.id not in members and self._available(player.id):
                members.append(player.id)
            if len(members) >= self.settings.min_players:
                difficulty: str = room["difficulty"]  # type: ignore[assignment]
                chosen = members[: self.settings.min_players]
                del self.rooms[code]
                await self._spawn(difficulty, chosen)

    def reserve_room(self, difficulty: str) -> str:
        """Reserve an empty room code (REST entry point); filled via WS joinRoom."""
        code = _room_code()
        while code in self.rooms:
            code = _room_code()
        self.rooms[code] = {"difficulty": difficulty, "members": []}
        return code

    # ------------------------------ helpers ----------------------------------

    def _available(self, player_id: str) -> bool:
        p = self.manager.get(player_id)
        return p is not None and p.match_id is None

    def _public(self, player_id: str) -> PlayerPublic:
        p = self.manager.get(player_id)
        if p is None:
            return PlayerPublic(id=player_id, handle="Player", rating=1000)
        return PlayerPublic(id=p.id, handle=p.handle, rating=p.rating)

    async def _spawn(self, difficulty: str, player_ids: list[str]) -> None:
        puzzle = await store.claim_puzzle(difficulty)
        match_id = await store.create_match(puzzle.id, difficulty, player_ids)
        players = [self._public(pid) for pid in player_ids]

        authority = GameAuthority(
            match_id=match_id,
            difficulty=difficulty,
            givens=list(puzzle.givens),
            solution=list(puzzle.solution),
            players=players,
            manager=self.manager,
            settings=self.settings,
            on_finish=self._cleanup,
        )
        self.matches[match_id] = authority
        for pid in player_ids:
            p = self.manager.get(pid)
            if p is not None:
                p.match_id = match_id
            await self.manager.send(
                pid,
                MatchFound(matchId=match_id, players=players, difficulty=difficulty),
            )
        log.info("match %s started: %s (%s)", match_id, player_ids, difficulty)
        authority.begin()

    def authority_for(self, player: Player) -> GameAuthority | None:
        if player.match_id is None:
            return None
        return self.matches.get(player.match_id)

    async def _cleanup(self, match_id: str) -> None:
        authority = self.matches.pop(match_id, None)
        if authority is None:
            return
        for pid in authority.players:
            p = self.manager.get(pid)
            if p is not None and p.match_id == match_id:
                p.match_id = None

    def cancel_from_queues(self, player_id: str) -> None:
        for q in self.queues.values():
            if player_id in q:
                q.remove(player_id)
        empty_rooms = [
            code
            for code, room in self.rooms.items()
            if player_id in room["members"]  # type: ignore[operator]
            and len(room["members"]) <= 1  # type: ignore[arg-type]
        ]
        for code in empty_rooms:
            del self.rooms[code]
