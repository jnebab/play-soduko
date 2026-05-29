"""Integration: two clients race the same board. The SERVER decides the winner
by receive-time of the completing move, and the losing client never receives a
single opponent digit in any frame (only sanitized shadow states)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from .conftest import seed_puzzle

# A known valid solution.
SOLUTION = [
    5, 3, 4, 6, 7, 8, 9, 1, 2,
    6, 7, 2, 1, 9, 5, 3, 4, 8,
    1, 9, 8, 3, 4, 2, 5, 6, 7,
    8, 5, 9, 7, 6, 1, 4, 2, 3,
    4, 2, 6, 8, 5, 3, 7, 9, 1,
    7, 1, 3, 9, 2, 4, 8, 5, 6,
    9, 6, 1, 5, 3, 7, 2, 8, 4,
    2, 8, 7, 4, 1, 9, 6, 3, 5,
    3, 4, 5, 2, 8, 6, 1, 7, 9,
]
BLANKS = [72, 73, 74]  # values 3, 4, 5
GIVENS = [0 if i in BLANKS else SOLUTION[i] for i in range(81)]

ALLOWED_STATES = {"given", "filled", "wrong", "empty"}


def _read_until(ws, t: str, sink: list | None = None) -> dict:
    while True:
        msg = ws.receive_json()
        if sink is not None:
            sink.append(msg)
        if msg["t"] == t:
            return msg


def test_server_decides_winner_and_no_digit_leaks():
    seed_puzzle(GIVENS, SOLUTION, difficulty="easy")
    from app.main import app

    with TestClient(app) as client:
        with (
            client.websocket_connect("/ws?id=alice&handle=Alice") as wa,
            client.websocket_connect("/ws?id=bob&handle=Bob") as wb,
        ):
            wa.send_json({"t": "joinQueue", "difficulty": "easy"})
            wb.send_json({"t": "joinQueue", "difficulty": "easy"})

            start_a = _read_until(wa, "matchStart")
            _read_until(wb, "matchStart")

            # the only board data the client ever gets is givens (no solution)
            assert start_a["givens"] == GIVENS

            # Alice completes the board correctly -> she should win
            for cell in BLANKS:
                wa.send_json({"t": "placeMove", "cell": cell, "value": SOLUTION[cell]})

            over_a = _read_until(wa, "matchOver")
            b_frames: list[dict] = []
            over_b = _read_until(wb, "matchOver", sink=b_frames)

        # --- the server picked the winner ---
        res_a = {r["playerId"]: r for r in over_a["results"]}
        assert res_a["alice"]["placement"] == 1
        assert res_a["alice"]["finishMs"] is not None
        assert res_a["bob"]["placement"] == 2
        assert res_a["bob"]["finishMs"] is None

        # --- Bob (the loser) never saw an opponent digit ---
        for frame in b_frames:
            # Bob must never receive Alice's private correctness signal
            assert frame["t"] != "moveAck"
            if frame["t"] == "opponentProgress":
                cells = frame["progress"]["cells"]
                assert len(cells) == 81
                assert all(c in ALLOWED_STATES for c in cells), "shadow grid must be states only"

        assert over_b["results"][0]["placement"] == 1


def test_reconnect_replays_snapshot():
    seed_puzzle(GIVENS, SOLUTION, difficulty="easy")
    from app.main import app

    with TestClient(app) as client:
        with (
            client.websocket_connect("/ws?id=carol&handle=Carol") as wc,
            client.websocket_connect("/ws?id=dave&handle=Dave") as wd,
        ):
            wc.send_json({"t": "joinQueue", "difficulty": "easy"})
            wd.send_json({"t": "joinQueue", "difficulty": "easy"})
            _read_until(wc, "matchStart")
            _read_until(wd, "matchStart")

            # Carol makes one (correct) move, then "reconnects"
            wc.send_json({"t": "placeMove", "cell": 72, "value": SOLUTION[72]})
            _read_until(wc, "moveAck")

        # new connection with the same id mid-match -> snapshot replay
        with client.websocket_connect("/ws?id=carol&handle=Carol") as wc2:
            snap = _read_until(wc2, "stateSnapshot")
            assert snap["you"]["cells"][72] == SOLUTION[72]
            assert len(snap["opponents"]) == 1
            assert snap["startTs"] > 0
