"""Game Authority — one per match (the match owner).

Holds the solution, validates every move, owns the countdown + clock, and
decides the winner by SERVER receive-time of the completing move. Emits two
distinct shapes: a private ``moveAck`` to the mover, and sanitized
``opponentProgress`` (cell STATES only, never digits) to everyone else.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from . import store
from .config import Settings
from .connections import ConnectionManager
from .schemas import (
    Countdown,
    MatchOver,
    MatchResult,
    MatchStart,
    MoveAck,
    OpponentProgress,
    PlayerPublic,
    ShadowProgress,
    StateSnapshot,
    YouState,
)

log = logging.getLogger("sudoku.authority")


def now_ms() -> int:
    return int(time.time() * 1000)


@dataclass
class PlayerState:
    public: PlayerPublic
    cells: list[int] = field(default_factory=lambda: [0] * 81)
    notes: list[list[int]] = field(default_factory=lambda: [[] for _ in range(81)])
    mistakes: int = 0
    finish_ms: int | None = None
    placement: int = 0
    dirty: bool = False


class GameAuthority:
    def __init__(
        self,
        *,
        match_id: str,
        difficulty: str,
        givens: list[int],
        solution: list[int],
        players: list[PlayerPublic],
        manager: ConnectionManager,
        settings: Settings,
        persist: bool = True,
        on_finish: Callable[[str], Awaitable[None]] | None = None,
    ) -> None:
        self.match_id = match_id
        self.difficulty = difficulty
        self.givens = givens
        self._solution = solution  # SERVER-ONLY; never serialized out
        self.manager = manager
        self.settings = settings
        self.persist = persist
        self._on_finish = on_finish

        self.status: str = "countdown"  # countdown | playing | finished
        self.start_ts: int = 0
        self.players: dict[str, PlayerState] = {}
        for p in players:
            st = PlayerState(public=p)
            for i, v in enumerate(givens):
                st.cells[i] = v
            self.players[p.id] = st

        self._finish_order: list[str] = []
        self._progress_task: asyncio.Task[None] | None = None
        self._lifecycle_task: asyncio.Task[None] | None = None

    # ----------------------------- lifecycle ---------------------------------

    def begin(self) -> None:
        self._lifecycle_task = asyncio.create_task(self._run())

    async def _run(self) -> None:
        players = [st.public for st in self.players.values()]
        # 3·2·1 countdown
        for n in range(self.settings.countdown_seconds, 0, -1):
            await self._broadcast(Countdown(secondsLeft=n))
            await asyncio.sleep(1)
        await self._broadcast(Countdown(secondsLeft=0))

        # GO
        self.status = "playing"
        self.start_ts = now_ms()
        await self._broadcast(
            MatchStart(givens=self.givens, startTs=self.start_ts, players=players)
        )
        self._progress_task = asyncio.create_task(self._progress_loop())

    async def _progress_loop(self) -> None:
        interval = 1.0 / max(0.5, self.settings.progress_hz)
        try:
            while self.status == "playing":
                await asyncio.sleep(interval)
                await self._flush_progress()
        except asyncio.CancelledError:  # pragma: no cover - shutdown path
            pass

    async def _flush_progress(self) -> None:
        for pid, st in self.players.items():
            if not st.dirty:
                continue
            st.dirty = False
            progress = self._shadow(pid)
            for other in self.players:
                if other != pid:
                    await self.manager.send(other, OpponentProgress(progress=progress))

    # ----------------------------- inbound -----------------------------------

    async def handle_move(self, player_id: str, msg: object) -> None:
        """Route a validated client move. ``msg`` is a parsed Pydantic model."""
        st = self.players.get(player_id)
        if st is None:
            return  # not a participant (spectator / stranger) — reject silently
        if self.status != "playing":
            return

        from .schemas import EraseMove, NoteMove, PlaceMove  # local to avoid cycles

        if isinstance(msg, PlaceMove):
            await self._place(player_id, st, msg.cell, msg.value)
        elif isinstance(msg, EraseMove):
            self._erase(st, msg.cell)
        elif isinstance(msg, NoteMove):
            self._note(st, msg.cell, msg.value)

    def _locked(self, cell: int) -> bool:
        return self.givens[cell] != 0

    async def _place(self, player_id: str, st: PlayerState, cell: int, value: int) -> None:
        if not (0 <= cell < 81) or not (1 <= value <= 9):
            return
        if self._locked(cell):
            return
        st.cells[cell] = value
        st.notes[cell] = []
        ok = value == self._solution[cell]
        if not ok:
            st.mistakes += 1
        st.dirty = True
        await self.manager.send(player_id, MoveAck(cell=cell, ok=ok))

        if ok and st.cells == self._solution:
            await self._on_complete(player_id, st)

    def _erase(self, st: PlayerState, cell: int) -> None:
        if not (0 <= cell < 81) or self._locked(cell):
            return
        st.cells[cell] = 0
        st.notes[cell] = []
        st.dirty = True

    def _note(self, st: PlayerState, cell: int, value: int) -> None:
        if not (0 <= cell < 81) or not (1 <= value <= 9) or self._locked(cell):
            return
        if st.cells[cell] != 0:
            return
        marks = st.notes[cell]
        if value in marks:
            marks.remove(value)
        else:
            marks.append(value)
            marks.sort()

    # ----------------------------- completion --------------------------------

    async def _on_complete(self, player_id: str, st: PlayerState) -> None:
        if st.finish_ms is not None:
            return
        st.finish_ms = now_ms() - self.start_ts
        self._finish_order.append(player_id)
        # Architecture: match ends on the FIRST correct completion.
        await self._finish(winner_id=player_id)

    async def _finish(self, winner_id: str | None) -> None:
        if self.status == "finished":
            return
        self.status = "finished"
        if self._progress_task is not None:
            self._progress_task.cancel()

        results = self._compute_results()
        if self.persist:
            try:
                results = await store.finish_match(self.match_id, winner_id, results)
            except Exception:  # noqa: BLE001 - never let persistence kill the match end
                log.exception("failed to persist match %s", self.match_id)

        await self._broadcast(MatchOver(results=results))
        if self._on_finish is not None:
            await self._on_finish(self.match_id)

    def _compute_results(self) -> list[MatchResult]:
        # finishers first (by finish order), then the rest by filled desc / mistakes asc
        finishers = list(self._finish_order)
        rest = [pid for pid in self.players if pid not in self._finish_order]
        rest.sort(key=lambda pid: (-self._filled(pid), self.players[pid].mistakes))
        ordered = finishers + rest

        results: list[MatchResult] = []
        for placement, pid in enumerate(ordered, start=1):
            st = self.players[pid]
            st.placement = placement
            results.append(
                MatchResult(
                    playerId=pid,
                    placement=placement,
                    finishMs=st.finish_ms,
                    mistakes=st.mistakes,
                    ratingDelta=0,
                )
            )
        return results

    # ----------------------------- snapshots ---------------------------------

    def _filled(self, player_id: str) -> int:
        return sum(1 for v in self.players[player_id].cells if v != 0)

    def _shadow(self, player_id: str) -> ShadowProgress:
        st = self.players[player_id]
        cells: list[str] = []
        for i, v in enumerate(st.cells):
            if self.givens[i] != 0:
                cells.append("given")
            elif v == 0:
                cells.append("empty")
            elif v == self._solution[i]:
                cells.append("filled")
            else:
                cells.append("wrong")
        elapsed = (now_ms() - self.start_ts) if self.start_ts else 0
        return ShadowProgress(
            playerId=player_id,
            cells=cells,
            filled=self._filled(player_id),
            mistakes=st.mistakes,
            elapsedMs=elapsed,
        )

    def snapshot_for(self, player_id: str) -> StateSnapshot:
        st = self.players[player_id]
        opponents = [self._shadow(pid) for pid in self.players if pid != player_id]
        return StateSnapshot(
            you=YouState(cells=list(st.cells), notes=[list(n) for n in st.notes]),
            opponents=opponents,
            startTs=self.start_ts,
            serverNow=now_ms(),
        )

    # ----------------------------- helpers -----------------------------------

    async def _broadcast(self, msg: object) -> None:
        for pid in self.players:
            await self.manager.send(pid, msg)  # type: ignore[arg-type]

    async def shutdown(self) -> None:
        for task in (self._progress_task, self._lifecycle_task):
            if task is not None:
                task.cancel()
