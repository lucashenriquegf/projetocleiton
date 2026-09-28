"""H3 spatial abstractions, corridor geometry builders, and distance utilities."""

from __future__ import annotations

import logging
import math
from typing import List, Set, Tuple

import h3

logger = logging.getLogger("h3_router.graph")

EARTH_RADIUS_METERS = 6_371_000.0


def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Calculate the great-circle distance between two (lat, lng) points in meters."""
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = math.sin(dlat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    clamped_a = max(0.0, min(1.0, a))
    return 2.0 * EARTH_RADIUS_METERS * math.atan2(math.sqrt(clamped_a), math.sqrt(1.0 - clamped_a))


def lerp_line_cells(start_cell: str, goal_cell: str) -> List[str]:
    """Generate a discrete line of H3 cells using linear interpolation (lerp).

    Used as a robust fallback when native h3.grid_path_cells fails
    (e.g., crossing pentagon distortion boundaries or icosahedron faces).
    """
    if start_cell == goal_cell:
        return [start_cell]

    lat1, lng1 = h3.cell_to_latlng(start_cell)
    lat2, lng2 = h3.cell_to_latlng(goal_cell)
    resolution = h3.get_resolution(start_cell)

    dist_meters = haversine_distance((lat1, lng1), (lat2, lng2))
    edge_len_meters = h3.average_hexagon_edge_length(resolution, unit="m")

    # Sample points along the line with step size roughly half edge length
    step_size = max(edge_len_meters * 0.5, 1.0)
    num_samples = max(int(dist_meters / step_size), 2)

    cells: List[str] = []
    for step in range(num_samples + 1):
        fraction = step / num_samples
        lat = lat1 + fraction * (lat2 - lat1)
        lng = lng1 + fraction * (lng2 - lng1)
        cell = h3.latlng_to_cell(lat, lng, resolution)
        if not cells or cells[-1] != cell:
            cells.append(cell)

    if not cells:
        return [start_cell, goal_cell]

    if cells[0] != start_cell:
        cells.insert(0, start_cell)
    if cells[-1] != goal_cell:
        cells.append(goal_cell)

    return cells


def get_base_corridor(start_cell: str, goal_cell: str) -> List[str]:
    """Compute base discrete line of cells between start and goal.

    Attempts native h3.grid_path_cells first; falls back to geometric lerp
    if an H3 exception (e.g., pentagon distortion boundary) occurs.
    """
    if start_cell == goal_cell:
        return [start_cell]

    try:
        path = h3.grid_path_cells(start_cell, goal_cell)
        if path:
            return list(path)
        logger.warning(
            "grid_path_cells returned empty path between %s and %s, using lerp fallback",
            start_cell,
            goal_cell,
        )
    except (h3.H3BaseException, Exception) as exc:
        logger.warning(
            "h3.grid_path_cells failed between %s and %s (%s). Engaging lerp fallback.",
            start_cell,
            goal_cell,
            exc,
        )

    return lerp_line_cells(start_cell, goal_cell)


def expand_corridor(base_cells: List[str], buffer_k: int) -> Set[str]:
    """Expand base corridor cells laterally by buffer_k rings.

    For each cell in base_cells, aggregates h3.grid_disk(cell, buffer_k).
    Returns a unique set of allowed H3 hex IDs.
    """
    if buffer_k < 0:
        raise ValueError(f"buffer_k must be non-negative, got {buffer_k}")

    if not base_cells:
        return set()

    if buffer_k == 0:
        return set(base_cells)

    allowed: Set[str] = set()
    for cell in base_cells:
        disk = h3.grid_disk(cell, buffer_k)
        allowed.update(disk)

    return allowed


def get_cell_neighbors(
    current: str,
    allowed_cells: Set[str],
    blocked_cells: Set[str],
) -> List[str]:
    """Evaluate h3.grid_disk(current, 1) and filter allowed/unblocked neighbors.

    Neighbor must exist in allowed_cells, must not exist in blocked_cells,
    and cannot be current.
    """
    disk = h3.grid_disk(current, 1)
    neighbors: List[str] = []
    for neighbor in disk:
        if neighbor != current and neighbor in allowed_cells and neighbor not in blocked_cells:
            neighbors.append(neighbor)
    return neighbors


def get_transition_cost(u: str, v: str, edge_weight_mode: str) -> float:
    """Compute edge weight between adjacent cells u and v.

    - If 'discrete': Cost per transition is 1.0.
    - If 'haversine': Cost is physical geodesic distance between cell centers in meters.
    """
    if edge_weight_mode == "discrete":
        return 1.0
    elif edge_weight_mode == "haversine":
        c1 = h3.cell_to_latlng(u)
        c2 = h3.cell_to_latlng(v)
        return haversine_distance(c1, c2)
    else:
        raise ValueError(f"Unsupported edge_weight_mode: {edge_weight_mode}")
