"""Dynamic H3 Corridor Routing Engine.

Provides spatial pathfinding across Uber H3 hexagonal grids with dynamic lateral corridor expansion.
Supports A*, Dijkstra, BFS, and DFS algorithms.
"""

from h3_router.engine import H3Router
from h3_router.graph import expand_corridor, get_base_corridor, haversine_distance
from h3_router.models import GeoPoint, RouteRequest, RouteResult
from h3_router.pathfinding import (
    find_path,
    find_path_astar,
    find_path_bfs,
    find_path_dfs,
    find_path_dijkstra,
)

__all__ = [
    "H3Router",
    "GeoPoint",
    "RouteRequest",
    "RouteResult",
    "expand_corridor",
    "get_base_corridor",
    "haversine_distance",
    "find_path",
    "find_path_astar",
    "find_path_dijkstra",
    "find_path_bfs",
    "find_path_dfs",
]
