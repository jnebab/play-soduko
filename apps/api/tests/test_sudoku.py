import random

import pytest

from app.sudoku import (
    CLUE_TARGETS,
    count_solutions,
    generate_solved,
    is_valid_complete,
    make_puzzle,
    solve,
)


def test_generated_solution_is_valid():
    g = generate_solved(random.Random(1))
    assert is_valid_complete(g)


@pytest.mark.parametrize("difficulty", list(CLUE_TARGETS))
def test_puzzle_is_unique_and_hits_clue_target(difficulty: str):
    givens, solution = make_puzzle(difficulty, rng=random.Random(42))

    # clue count matches the difficulty target
    assert sum(1 for v in givens if v != 0) == CLUE_TARGETS[difficulty]

    # the dug puzzle has EXACTLY one solution
    assert count_solutions(givens, limit=2) == 1

    # solution is a valid complete grid and every given agrees with it
    assert is_valid_complete(solution)
    for i, v in enumerate(givens):
        if v != 0:
            assert v == solution[i]


def test_solver_recovers_the_solution():
    givens, solution = make_puzzle("easy", rng=random.Random(7))
    recovered = solve(givens)
    assert recovered == solution


def test_count_solutions_detects_multiple():
    # an empty grid has many solutions; early-exit caps the count at the limit
    assert count_solutions([0] * 81, limit=2) == 2
