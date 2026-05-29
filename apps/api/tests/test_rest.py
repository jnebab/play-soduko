from fastapi.testclient import TestClient


def test_health_and_no_solution_leak():
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}

        # /puzzles/next returns givens, NEVER a solution
        r = client.get("/puzzles/next", params={"difficulty": "easy"})
        assert r.status_code == 200
        body = r.json()
        assert "givens" in body
        assert len(body["givens"]) == 81
        assert "solution" not in body
        # defensively, no field should equal a full 81-int filled array
        for value in body.values():
            if isinstance(value, list) and len(value) == 81:
                assert any(v == 0 for v in value), "givens must contain blanks, not a solution"

        # /me upserts and returns a rating
        me = client.get("/me", params={"id": "u-rest", "handle": "Rae"}).json()
        assert me["handle"] == "Rae"
        assert me["rating"] == 1000

        # leaderboard responds
        lb = client.get("/leaderboard").json()
        assert "entries" in lb


def test_create_match_returns_room_code():
    from app.main import app

    with TestClient(app) as client:
        r = client.post("/matches", json={"difficulty": "hard"})
        assert r.status_code == 200
        assert len(r.json()["code"]) == 4
