"""Acceptance tests for H3Router, dynamic corridor expansion, and 4 routing algorithms."""

import pytest
import h3

from h3_router.engine import H3Router
from h3_router.graph import get_base_corridor
from h3_router.models import GeoPoint, RouteRequest, RouteResult


@pytest.fixture
def sample_points():
    # Goiania coordinates
    # Distance is approx 1.5 km
    p1 = GeoPoint(lat=-16.6800, lng=-49.2550)
    p2 = GeoPoint(lat=-16.6900, lng=-49.2650)
    return p1, p2


def test_straight_line_clear_path(sample_points):
    """Simple route with 0 blocked cells finds immediate path with expanded_buffer_level == 0."""
    origin, destination = sample_points
    request = RouteRequest(
        origin=origin,
        destination=destination,
        resolution=9,
        blocked_cells=set(),
        max_buffer_expansion=5,
    )
    result = H3Router.find_route(request)

    assert result.success is True
    assert result.expanded_buffer_level == 0
    assert len(result.path) >= 2
    assert result.error_message is None
    assert result.total_cost > 0.0

    # Verify origin and destination match start and end of path
    start_cell = h3.latlng_to_cell(origin.lat, origin.lng, 9)
    goal_cell = h3.latlng_to_cell(destination.lat, destination.lng, 9)
    assert result.path[0] == start_cell
    assert result.path[-1] == goal_cell


def test_obstacle_bypass_expansion(sample_points):
    """Block the exact middle cells of the base path; verify the router automatically

    expands buffer_k >= 1 and returns a valid path that detours around the obstacle.
    """
    origin, destination = sample_points
    start_cell = h3.latlng_to_cell(origin.lat, origin.lng, 9)
    goal_cell = h3.latlng_to_cell(destination.lat, destination.lng, 9)

    base_line = get_base_corridor(start_cell, goal_cell)
    assert len(base_line) >= 3

    # Block the exact middle cell of the base path
    mid_idx = len(base_line) // 2
    blocked_cell = base_line[mid_idx]

    request = RouteRequest(
        origin=origin,
        destination=destination,
        resolution=9,
        blocked_cells={blocked_cell},
        max_buffer_expansion=5,
    )
    result = H3Router.find_route(request)

    assert result.success is True
    assert result.expanded_buffer_level >= 1
    assert blocked_cell not in result.path
    assert result.path[0] == start_cell
    assert result.path[-1] == goal_cell

    # Ensure path is unbroken (every step must be a neighbor)
    for i in range(len(result.path) - 1):
        assert h3.grid_distance(result.path[i], result.path[i + 1]) == 1


def test_blocked_origin_or_goal(sample_points):
    """When start or goal is blocked, return failure immediately without expanding."""
    origin, destination = sample_points
    start_cell = h3.latlng_to_cell(origin.lat, origin.lng, 9)
    goal_cell = h3.latlng_to_cell(destination.lat, destination.lng, 9)

    # 1. Block start cell
    req_start_blocked = RouteRequest(
        origin=origin,
        destination=destination,
        resolution=9,
        blocked_cells={start_cell},
    )
    res_start = H3Router.find_route(req_start_blocked)
    assert res_start.success is False
    assert "Origin cell is blocked" in res_start.error_message
    assert res_start.expanded_buffer_level == 0
    assert res_start.evaluated_cells_count == 0

    # 2. Block goal cell
    req_goal_blocked = RouteRequest(
        origin=origin,
        destination=destination,
        resolution=9,
        blocked_cells={goal_cell},
    )
    res_goal = H3Router.find_route(req_goal_blocked)
    assert res_goal.success is False
    assert "Destination cell is blocked" in res_goal.error_message
    assert res_goal.expanded_buffer_level == 0
    assert res_goal.evaluated_cells_count == 0


def test_exceeded_max_buffer(sample_points):
    """Completely enclose the destination with blocked cells; verify it halts

    at max_buffer_expansion and reports graceful failure.
    """
    origin, destination = sample_points
    goal_cell = h3.latlng_to_cell(destination.lat, destination.lng, 9)

    # Completely surround the destination with blocked cells (all ring 1 neighbors)
    ring_1_neighbors = set(h3.grid_disk(goal_cell, 1)) - {goal_cell}

    max_buffer = 3
    request = RouteRequest(
        origin=origin,
        destination=destination,
        resolution=9,
        blocked_cells=ring_1_neighbors,
        max_buffer_expansion=max_buffer,
    )
    result = H3Router.find_route(request)

    assert result.success is False
    assert result.expanded_buffer_level == max_buffer
    assert "No traversable route found" in result.error_message
    assert result.path == []


def test_origin_equals_destination():
    """If start and goal resolve to the same H3 cell, return a 1-element path immediately."""
    point = GeoPoint(lat=-16.6869, lng=-49.2648)
    request = RouteRequest(
        origin=point,
        destination=point,
        resolution=9,
    )
    result = H3Router.find_route(request)

    assert result.success is True
    assert len(result.path) == 1
    assert result.expanded_buffer_level == 0
    assert result.total_cost == 0.0
    expected_cell = h3.latlng_to_cell(point.lat, point.lng, 9)
    assert result.path[0] == expected_cell


def test_all_four_routing_algorithms(sample_points):
    """Verify that all 4 routing algorithms (astar, dijkstra, bfs, dfs)

    successfully find valid paths and handle obstacle bypass.
    """
    origin, destination = sample_points
    start_cell = h3.latlng_to_cell(origin.lat, origin.lng, 9)
    goal_cell = h3.latlng_to_cell(destination.lat, destination.lng, 9)

    base_line = get_base_corridor(start_cell, goal_cell)
    mid_cell = base_line[len(base_line) // 2]
    blocked = {mid_cell}

    for algo in ["astar", "dijkstra", "bfs", "dfs"]:
        # Test clear path
        req_clear = RouteRequest(
            origin=origin,
            destination=destination,
            resolution=9,
            algorithm=algo,
        )
        res_clear = H3Router.find_route(req_clear)
        assert res_clear.success is True, f"Clear path failed for {algo}"
        assert res_clear.expanded_buffer_level == 0, f"Buffer level not 0 for clear {algo}"
        assert res_clear.path[0] == start_cell
        assert res_clear.path[-1] == goal_cell

        # Test obstacle bypass
        req_blocked = RouteRequest(
            origin=origin,
            destination=destination,
            resolution=9,
            blocked_cells=blocked,
            algorithm=algo,
            max_buffer_expansion=4,
        )
        res_blocked = H3Router.find_route(req_blocked)
        assert res_blocked.success is True, f"Obstacle bypass failed for {algo}"
        assert res_blocked.expanded_buffer_level >= 1, f"Buffer level should be >= 1 for {algo}"
        assert mid_cell not in res_blocked.path, f"Blocked cell in path for {algo}"
        assert res_blocked.path[0] == start_cell
        assert res_blocked.path[-1] == goal_cell


def test_edge_weight_modes(sample_points):
    """Test both discrete and haversine edge weight modes."""
    origin, destination = sample_points

    # Discrete mode
    req_disc = RouteRequest(
        origin=origin,
        destination=destination,
        resolution=9,
        edge_weight_mode="discrete",
    )
    res_disc = H3Router.find_route(req_disc)
    assert res_disc.success is True
    # Discrete cost is transition count = len(path) - 1
    assert res_disc.total_cost == float(len(res_disc.path) - 1)

    # Haversine mode
    req_hav = RouteRequest(
        origin=origin,
        destination=destination,
        resolution=9,
        edge_weight_mode="haversine",
    )
    res_hav = H3Router.find_route(req_hav)
    assert res_hav.success is True
    # Total cost in meters should be > 500m
    assert res_hav.total_cost > 500.0


def test_input_validations():
    """Verify coordinate and request validation rules."""
    with pytest.raises(ValueError):
        GeoPoint(lat=95.0, lng=0.0)

    with pytest.raises(ValueError):
        GeoPoint(lat=0.0, lng=-190.0)

    p = GeoPoint(0.0, 0.0)
    with pytest.raises(ValueError):
        RouteRequest(origin=p, destination=p, resolution=16)

    with pytest.raises(ValueError):
        RouteRequest(origin=p, destination=p, max_buffer_expansion=-1)

    with pytest.raises(ValueError):
        RouteRequest(origin=p, destination=p, edge_weight_mode="invalid")

    with pytest.raises(ValueError):
        RouteRequest(origin=p, destination=p, algorithm="unknown")


def test_unbounded_corridor_expansion(sample_points):
    """Verify that max_buffer_expansion=None expands automatically until path found."""
    origin, destination = sample_points
    start_cell = h3.latlng_to_cell(origin.lat, origin.lng, 9)
    goal_cell = h3.latlng_to_cell(destination.lat, destination.lng, 9)
    base_line = get_base_corridor(start_cell, goal_cell)

    mid_cell = base_line[len(base_line) // 2]
    req = RouteRequest(
        origin=origin,
        destination=destination,
        resolution=9,
        blocked_cells={mid_cell},
        max_buffer_expansion=None,
    )
    result = H3Router.find_route(req)
    assert result.success is True
    assert result.expanded_buffer_level >= 1
    assert mid_cell not in result.path
