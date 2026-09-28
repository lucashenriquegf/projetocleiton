"""Pathfinding algorithms (A*, Dijkstra, BFS, DFS) restricted to H3 corridors."""

from __future__ import annotations

from collections import deque
import heapq
import itertools
import logging
from typing import Dict, List, Literal, Optional, Set, Tuple

import h3

from h3_router.graph import (
    get_cell_neighbors,
    get_transition_cost,
    haversine_distance,
)
from h3_router.models import EdgeWeightMode, RoutingAlgorithm

logger = logging.getLogger("h3_router.pathfinding")


def compute_heuristic(
    cell: str,
    goal_cell: str,
    edge_weight_mode: EdgeWeightMode,
) -> float:
    """Calculate admissible heuristic h(n) from cell to goal_cell.

    - If 'discrete': uses native h3.grid_distance(cell, goal_cell). If cross-pentagon
      grid_distance raises an exception, falls back to geodesic distance / avg edge length.
    - If 'haversine': uses great-circle distance between cell centers in meters.
    """
    if cell == goal_cell:
        return 0.0

    if edge_weight_mode == "haversine":
        c1 = h3.cell_to_latlng(cell)
        c2 = h3.cell_to_latlng(goal_cell)
        return haversine_distance(c1, c2)

    # Discrete mode: grid_distance
    try:
        return float(h3.grid_distance(cell, goal_cell))
    except (h3.H3BaseException, Exception):
        # Fallback admissible heuristic across pentagons
        res = h3.get_resolution(cell)
        c1 = h3.cell_to_latlng(cell)
        c2 = h3.cell_to_latlng(goal_cell)
        dist = haversine_distance(c1, c2)
        edge_len = h3.average_hexagon_edge_length(res, unit="m")
        # In a hex grid, distance in cells >= physical distance / (edge_length * sqrt(3))
        return dist / (edge_len * 1.7320508) if edge_len > 0 else 0.0


def reconstruct_path(came_from: Dict[str, str], current: str) -> List[str]:
    """Reconstruct path from start to current node using came_from pointers."""
    path = [current]
    while current in came_from:
        current = came_from[current]
        path.append(current)
    path.reverse()
    return path


def compute_path_cost(path: List[str], edge_weight_mode: EdgeWeightMode) -> float:
    """Calculate the total cost of a path according to edge_weight_mode."""
    if len(path) <= 1:
        return 0.0

    total_cost = 0.0
    for idx in range(len(path) - 1):
        total_cost += get_transition_cost(path[idx], path[idx + 1], edge_weight_mode)
    return total_cost


def find_path_astar(
    start_cell: str,
    goal_cell: str,
    allowed_cells: Set[str],
    blocked_cells: Set[str],
    edge_weight_mode: EdgeWeightMode = "discrete",
) -> Tuple[Optional[List[str]], int, float]:
    """Find the shortest path using A* search restricted to allowed_cells."""
    if start_cell not in allowed_cells or start_cell in blocked_cells:
        return None, 0, 0.0
    if goal_cell not in allowed_cells or goal_cell in blocked_cells:
        return None, 0, 0.0

    if start_cell == goal_cell:
        return [start_cell], 1, 0.0

    counter = itertools.count()
    start_h = compute_heuristic(start_cell, goal_cell, edge_weight_mode)

    # Priority queue stores: (f_score, tie_breaker, cell_id)
    open_set: List[Tuple[float, int, str]] = []
    heapq.heappush(open_set, (start_h, next(counter), start_cell))

    g_score: Dict[str, float] = {start_cell: 0.0}
    f_score: Dict[str, float] = {start_cell: start_h}
    came_from: Dict[str, str] = {}
    evaluated_cells_count = 0

    while open_set:
        current_f, _, current = heapq.heappop(open_set)

        if current_f > f_score.get(current, float("inf")):
            continue

        evaluated_cells_count += 1

        if current == goal_cell:
            path = reconstruct_path(came_from, current)
            return path, evaluated_cells_count, g_score[current]

        current_g = g_score[current]
        for neighbor in get_cell_neighbors(current, allowed_cells, blocked_cells):
            transition = get_transition_cost(current, neighbor, edge_weight_mode)
            tentative_g = current_g + transition

            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                h = compute_heuristic(neighbor, goal_cell, edge_weight_mode)
                f = tentative_g + h
                f_score[neighbor] = f
                heapq.heappush(open_set, (f, next(counter), neighbor))

    return None, evaluated_cells_count, 0.0


def find_path_dijkstra(
    start_cell: str,
    goal_cell: str,
    allowed_cells: Set[str],
    blocked_cells: Set[str],
    edge_weight_mode: EdgeWeightMode = "discrete",
) -> Tuple[Optional[List[str]], int, float]:
    """Find the shortest path using Dijkstra's algorithm restricted to allowed_cells."""
    if start_cell not in allowed_cells or start_cell in blocked_cells:
        return None, 0, 0.0
    if goal_cell not in allowed_cells or goal_cell in blocked_cells:
        return None, 0, 0.0

    if start_cell == goal_cell:
        return [start_cell], 1, 0.0

    counter = itertools.count()
    # Priority queue stores: (g_score, tie_breaker, cell_id)
    open_set: List[Tuple[float, int, str]] = []
    heapq.heappush(open_set, (0.0, next(counter), start_cell))

    dist: Dict[str, float] = {start_cell: 0.0}
    came_from: Dict[str, str] = {}
    evaluated_cells_count = 0

    while open_set:
        current_dist, _, current = heapq.heappop(open_set)

        if current_dist > dist.get(current, float("inf")):
            continue

        evaluated_cells_count += 1

        if current == goal_cell:
            path = reconstruct_path(came_from, current)
            return path, evaluated_cells_count, current_dist

        for neighbor in get_cell_neighbors(current, allowed_cells, blocked_cells):
            transition = get_transition_cost(current, neighbor, edge_weight_mode)
            tentative_dist = current_dist + transition

            if tentative_dist < dist.get(neighbor, float("inf")):
                dist[neighbor] = tentative_dist
                came_from[neighbor] = current
                heapq.heappush(open_set, (tentative_dist, next(counter), neighbor))

    return None, evaluated_cells_count, 0.0


def find_path_bfs(
    start_cell: str,
    goal_cell: str,
    allowed_cells: Set[str],
    blocked_cells: Set[str],
    edge_weight_mode: EdgeWeightMode = "discrete",
) -> Tuple[Optional[List[str]], int, float]:
    """Find a path using Breadth-First Search (BFS) restricted to allowed_cells."""
    if start_cell not in allowed_cells or start_cell in blocked_cells:
        return None, 0, 0.0
    if goal_cell not in allowed_cells or goal_cell in blocked_cells:
        return None, 0, 0.0

    if start_cell == goal_cell:
        return [start_cell], 1, 0.0

    queue: deque[str] = deque([start_cell])
    visited: Set[str] = {start_cell}
    came_from: Dict[str, str] = {}
    evaluated_cells_count = 0

    while queue:
        current = queue.popleft()
        evaluated_cells_count += 1

        if current == goal_cell:
            path = reconstruct_path(came_from, current)
            cost = compute_path_cost(path, edge_weight_mode)
            return path, evaluated_cells_count, cost

        for neighbor in get_cell_neighbors(current, allowed_cells, blocked_cells):
            if neighbor not in visited:
                visited.add(neighbor)
                came_from[neighbor] = current
                queue.append(neighbor)

    return None, evaluated_cells_count, 0.0


def find_path_dfs(
    start_cell: str,
    goal_cell: str,
    allowed_cells: Set[str],
    blocked_cells: Set[str],
    edge_weight_mode: EdgeWeightMode = "discrete",
) -> Tuple[Optional[List[str]], int, float]:
    """Find a path using Depth-First Search (DFS) restricted to allowed_cells."""
    if start_cell not in allowed_cells or start_cell in blocked_cells:
        return None, 0, 0.0
    if goal_cell not in allowed_cells or goal_cell in blocked_cells:
        return None, 0, 0.0

    if start_cell == goal_cell:
        return [start_cell], 1, 0.0

    stack: List[str] = [start_cell]
    visited: Set[str] = {start_cell}
    came_from: Dict[str, str] = {}
    evaluated_cells_count = 0

    while stack:
        current = stack.pop()
        evaluated_cells_count += 1

        if current == goal_cell:
            path = reconstruct_path(came_from, current)
            cost = compute_path_cost(path, edge_weight_mode)
            return path, evaluated_cells_count, cost

        for neighbor in get_cell_neighbors(current, allowed_cells, blocked_cells):
            if neighbor not in visited:
                visited.add(neighbor)
                came_from[neighbor] = current
                stack.append(neighbor)

    return None, evaluated_cells_count, 0.0


def find_path(
    start_cell: str,
    goal_cell: str,
    allowed_cells: Set[str],
    blocked_cells: Set[str],
    edge_weight_mode: EdgeWeightMode = "discrete",
    algorithm: RoutingAlgorithm = "astar",
) -> Tuple[Optional[List[str]], int, float]:
    """Unified entry point dispatching to the requested pathfinding algorithm."""
    if algorithm == "astar":
        return find_path_astar(start_cell, goal_cell, allowed_cells, blocked_cells, edge_weight_mode)
    elif algorithm == "dijkstra":
        return find_path_dijkstra(start_cell, goal_cell, allowed_cells, blocked_cells, edge_weight_mode)
    elif algorithm == "bfs":
        return find_path_bfs(start_cell, goal_cell, allowed_cells, blocked_cells, edge_weight_mode)
    elif algorithm == "dfs":
        return find_path_dfs(start_cell, goal_cell, allowed_cells, blocked_cells, edge_weight_mode)
    else:
        raise ValueError(f"Unknown routing algorithm: {algorithm}")
