"""Unit tests for corridor geometry, expansion, and spatial utilities."""

import math
from unittest.mock import patch
import pytest
import h3

from h3_router.graph import (
    expand_corridor,
    get_base_corridor,
    get_cell_neighbors,
    get_transition_cost,
    haversine_distance,
    lerp_line_cells,
)


def test_haversine_distance():
    # Distance between Goiania points
    p1 = (-16.6869, -49.2648)
    p2 = (-16.6869, -49.2648)
    assert haversine_distance(p1, p2) == 0.0

    p3 = (-16.6900, -49.2700)
    dist = haversine_distance(p1, p3)
    assert 600 < dist < 800  # Approximately 650m


def test_base_corridor_straight():
    res = 9
    start = h3.latlng_to_cell(-16.6800, -49.2600, res)
    goal = h3.latlng_to_cell(-16.6900, -49.2700, res)

    corridor = get_base_corridor(start, goal)
    assert len(corridor) >= 2
    assert corridor[0] == start
    assert corridor[-1] == goal

    # Verify each consecutive pair are neighbors
    for i in range(len(corridor) - 1):
        assert h3.grid_distance(corridor[i], corridor[i + 1]) == 1


def test_corridor_same_cell():
    res = 9
    cell = h3.latlng_to_cell(-16.6800, -49.2600, res)
    corridor = get_base_corridor(cell, cell)
    assert corridor == [cell]


def test_corridor_expansion():
    res = 9
    start = h3.latlng_to_cell(-16.6800, -49.2600, res)
    goal = h3.latlng_to_cell(-16.6850, -49.2650, res)
    base_line = get_base_corridor(start, goal)

    buf0 = expand_corridor(base_line, 0)
    assert buf0 == set(base_line)

    buf1 = expand_corridor(base_line, 1)
    assert buf0.issubset(buf1)
    assert len(buf1) > len(buf0)

    buf2 = expand_corridor(base_line, 2)
    assert buf1.issubset(buf2)
    assert len(buf2) > len(buf1)

    with pytest.raises(ValueError):
        expand_corridor(base_line, -1)


def test_lerp_line_cells():
    res = 9
    start = h3.latlng_to_cell(-16.6800, -49.2600, res)
    goal = h3.latlng_to_cell(-16.6900, -49.2700, res)

    lerp_cells = lerp_line_cells(start, goal)
    assert len(lerp_cells) >= 2
    assert lerp_cells[0] == start
    assert lerp_cells[-1] == goal


def test_fallback_on_h3_exception():
    res = 9
    start = h3.latlng_to_cell(-16.6800, -49.2600, res)
    goal = h3.latlng_to_cell(-16.6900, -49.2700, res)

    with patch("h3.grid_path_cells", side_effect=h3.H3GridNavigationError("Pentagon distortion error")):
        corridor = get_base_corridor(start, goal)
        assert len(corridor) >= 2
        assert corridor[0] == start
        assert corridor[-1] == goal


def test_cell_neighbors():
    res = 9
    cell = h3.latlng_to_cell(-16.6800, -49.2600, res)
    disk = set(h3.grid_disk(cell, 1))

    # All neighbors allowed, none blocked
    allowed = disk.copy()
    blocked = set()
    neighbors = get_cell_neighbors(cell, allowed, blocked)
    assert len(neighbors) == len(disk) - 1
    assert cell not in neighbors

    # Block one neighbor
    blocked_neighbor = neighbors[0]
    blocked.add(blocked_neighbor)
    new_neighbors = get_cell_neighbors(cell, allowed, blocked)
    assert blocked_neighbor not in new_neighbors
    assert len(new_neighbors) == len(neighbors) - 1


def test_transition_costs():
    res = 9
    c1 = h3.latlng_to_cell(-16.6800, -49.2600, res)
    neighbors = [n for n in h3.grid_disk(c1, 1) if n != c1]
    c2 = neighbors[0]

    assert get_transition_cost(c1, c2, "discrete") == 1.0
    cost_h = get_transition_cost(c1, c2, "haversine")
    assert cost_h > 0.0

    with pytest.raises(ValueError):
        get_transition_cost(c1, c2, "invalid_mode")
