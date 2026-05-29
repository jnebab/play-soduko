"""ELO rating updates for finished matches (supports N players via pairwise)."""

from __future__ import annotations

from dataclasses import dataclass

K_FACTOR = 32


@dataclass
class Standing:
    user_id: str
    rating: int
    placement: int  # 1 = best


def compute_deltas(standings: list[Standing]) -> dict[str, int]:
    """Pairwise ELO. Each player is scored against every other by placement;
    deltas are averaged so a single match moves a rating by ~K at most."""
    n = len(standings)
    deltas: dict[str, float] = {s.user_id: 0.0 for s in standings}
    if n < 2:
        return {s.user_id: 0 for s in standings}

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            a, b = standings[i], standings[j]
            expected = 1.0 / (1.0 + 10 ** ((b.rating - a.rating) / 400.0))
            if a.placement < b.placement:
                score = 1.0
            elif a.placement > b.placement:
                score = 0.0
            else:
                score = 0.5
            deltas[a.user_id] += K_FACTOR * (score - expected)

    return {uid: round(d / (n - 1)) for uid, d in deltas.items()}
