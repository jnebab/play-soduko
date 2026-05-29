"""Server-only Sudoku engine.

Generates a complete solution via randomized backtracking, then digs cells while
keeping the solution unique (count-solutions with early-exit at 2). Also provides
a solver for hints and a validity check. This module — and the solution it
produces — never leaves the server.
"""

from __future__ import annotations

import random
from typing import Final

Grid = list[int]

CLUE_TARGETS: Final[dict[str, int]] = {
    "easy": 43,
    "medium": 34,
    "hard": 30,
    "expert": 27,
}


def _can_place(g: Grid, idx: int, v: int) -> bool:
    r, c = divmod(idx, 9)
    for k in range(9):
        if g[r * 9 + k] == v:
            return False
        if g[k * 9 + c] == v:
            return False
    br, bc = (r // 3) * 3, (c // 3) * 3
    for i in range(3):
        for j in range(3):
            if g[(br + i) * 9 + (bc + j)] == v:
                return False
    return True


def _fill(g: Grid, rng: random.Random) -> bool:
    try:
        idx = g.index(0)
    except ValueError:
        return True
    digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    rng.shuffle(digits)
    for v in digits:
        if _can_place(g, idx, v):
            g[idx] = v
            if _fill(g, rng):
                return True
            g[idx] = 0
    return False


def generate_solved(rng: random.Random | None = None) -> Grid:
    """Return a complete, valid 9x9 solution grid."""
    rng = rng or random.Random()
    g: Grid = [0] * 81
    _fill(g, rng)
    return g


def count_solutions(g: Grid, limit: int = 2) -> int:
    """Count solutions of a partial grid, short-circuiting at `limit`."""
    work = list(g)
    n = 0

    def solve() -> None:
        nonlocal n
        if n >= limit:
            return
        try:
            idx = work.index(0)
        except ValueError:
            n += 1
            return
        for v in range(1, 10):
            if n >= limit:
                return
            if _can_place(work, idx, v):
                work[idx] = v
                solve()
                work[idx] = 0

    solve()
    return n


def solve(g: Grid) -> Grid | None:
    """Return the (first) full solution of a partial grid, or None if unsolvable."""
    work = list(g)
    if _fill(work, random.Random(0)):
        return work
    return None


def make_puzzle(
    difficulty: str, rng: random.Random | None = None
) -> tuple[Grid, Grid]:
    """Generate ``(givens, solution)`` for the difficulty with a UNIQUE solution.

    Returns the dug puzzle (0 = blank) and its full solution.
    """
    if difficulty not in CLUE_TARGETS:
        raise ValueError(f"unknown difficulty: {difficulty}")
    rng = rng or random.Random()
    target = CLUE_TARGETS[difficulty]
    solution = generate_solved(rng)
    puzzle = list(solution)
    givens = 81
    order = list(range(81))
    rng.shuffle(order)
    for idx in order:
        if givens <= target:
            break
        saved = puzzle[idx]
        if saved == 0:
            continue
        puzzle[idx] = 0
        if count_solutions(puzzle, limit=2) != 1:
            puzzle[idx] = saved
        else:
            givens -= 1
    return puzzle, solution


def is_valid_complete(g: Grid) -> bool:
    """True if g is a fully-filled, rule-valid grid."""
    if any(v == 0 for v in g):
        return False
    for idx in range(81):
        v = g[idx]
        g[idx] = 0
        ok = _can_place(g, idx, v)
        g[idx] = v
        if not ok:
            return False
    return True
