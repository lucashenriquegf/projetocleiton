"""Data models and schemas for H3 dynamic corridor routing."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Literal, Optional, Set, Tuple


@dataclass(frozen=True)
class GeoPoint:
    """Geographic point representation with latitude and longitude."""

    lat: float
    lng: float

    def __post_init__(self) -> None:
        if not (-90.0 <= self.lat <= 90.0):
            raise ValueError(f"Latitude must be within [-90.0, 90.0], got {self.lat}")
        if not (-180.0 <= self.lng <= 180.0):
            raise ValueError(f"Longitude must be within [-180.0, 180.0], got {self.lng}")

    @property
    def as_tuple(self) -> Tuple[float, float]:
        """Return (lat, lng) tuple."""
        return self.lat, self.lng


EdgeWeightMode = Literal["discrete", "haversine"]
RoutingAlgorithm = Literal["astar", "dijkstra", "bfs", "dfs"]


@dataclass
class RouteRequest:
    """Specification of a route request across an H3 grid."""

    origin: GeoPoint
    destination: GeoPoint
    resolution: int = 9
    blocked_cells: Set[str] = field(default_factory=set)
    max_buffer_expansion: Optional[int] = 8
    edge_weight_mode: EdgeWeightMode = "discrete"
    algorithm: RoutingAlgorithm = "astar"

    def __post_init__(self) -> None:
        if not (0 <= self.resolution <= 15):
            raise ValueError(f"H3 resolution must be between 0 and 15, got {self.resolution}")
        if self.max_buffer_expansion is not None and self.max_buffer_expansion < 0:
            raise ValueError(
                f"max_buffer_expansion must be non-negative, got {self.max_buffer_expansion}"
            )
        if self.edge_weight_mode not in ("discrete", "haversine"):
            raise ValueError(
                f"Unsupported edge_weight_mode: {self.edge_weight_mode}. Expected 'discrete' or 'haversine'."
            )
        if self.algorithm not in ("astar", "dijkstra", "bfs", "dfs"):
            raise ValueError(
                f"Unsupported algorithm: {self.algorithm}. Expected 'astar', 'dijkstra', 'bfs', or 'dfs'."
            )
        if not isinstance(self.blocked_cells, set):
            self.blocked_cells = set(self.blocked_cells)


@dataclass
class RouteResult:
    """Outcome of a route calculation."""

    success: bool
    path: List[str] = field(default_factory=list)
    expanded_buffer_level: int = 0
    evaluated_cells_count: int = 0
    total_cost: float = 0.0
    error_message: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert the result to a dictionary."""
        return {
            "success": self.success,
            "path": self.path,
            "expanded_buffer_level": self.expanded_buffer_level,
            "evaluated_cells_count": self.evaluated_cells_count,
            "total_cost": self.total_cost,
            "error_message": self.error_message,
        }
