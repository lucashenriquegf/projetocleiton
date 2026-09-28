"""Main coordinator engine for dynamic H3 corridor pathfinding."""

from __future__ import annotations

import logging
from typing import Optional

import h3

from h3_router.graph import expand_corridor, get_base_corridor
from h3_router.models import RouteRequest, RouteResult
from h3_router.pathfinding import find_path

logger = logging.getLogger("h3_router.engine")


class H3Router:
    """Coordinator orchestrating base line generation, dynamic corridor expansion, and path resolution."""

    @classmethod
    def find_route(cls, request: RouteRequest) -> RouteResult:
        """Find a route between origin and destination with dynamic corridor expansion.

        1. Convert origin and destination coordinates to H3 cells.
        2. Handle origin == destination early return.
        3. Check blocked status of origin and destination cells.
        4. Generate initial discrete base corridor line.
        5. Dynamically expand corridor from buffer_k = 0 to max_buffer_expansion.
        6. Return RouteResult with path, buffer level, evaluated cells count, and cost.
        """
        logger.info(
            "Initiating route search from %s to %s (resolution=%d, algorithm=%s, mode=%s)",
            request.origin.as_tuple,
            request.destination.as_tuple,
            request.resolution,
            request.algorithm,
            request.edge_weight_mode,
        )

        try:
            start_cell = h3.latlng_to_cell(
                request.origin.lat, request.origin.lng, request.resolution
            )
            goal_cell = h3.latlng_to_cell(
                request.destination.lat, request.destination.lng, request.resolution
            )
        except Exception as exc:
            logger.error("Failed to convert coordinates to H3 cells: %s", exc)
            return RouteResult(
                success=False,
                error_message=f"Failed to convert coordinates to H3 cells: {exc}",
            )

        # Early check: origin or destination blocked
        if start_cell in request.blocked_cells:
            logger.warning("Origin cell %s is in blocked_cells", start_cell)
            return RouteResult(
                success=False,
                error_message="Origin cell is blocked",
            )

        if goal_cell in request.blocked_cells:
            logger.warning("Destination cell %s is in blocked_cells", goal_cell)
            return RouteResult(
                success=False,
                error_message="Destination cell is blocked",
            )

        # Edge case: origin == destination
        if start_cell == goal_cell:
            logger.info("Origin and destination resolve to the same cell: %s", start_cell)
            return RouteResult(
                success=True,
                path=[start_cell],
                expanded_buffer_level=0,
                evaluated_cells_count=1,
                total_cost=0.0,
            )

        # Step 3: Base discrete line generation (with lerp fallback if native call fails)
        base_line = get_base_corridor(start_cell, goal_cell)
        logger.debug(
            "Generated base corridor line with %d cells from %s to %s",
            len(base_line),
            start_cell,
            goal_cell,
        )

        total_evaluated_cells = 0
        prev_cell_count = 0
        buffer_k = 0

        # Step 4: Dynamic corridor expansion loop (unbounded or up to max_buffer_expansion)
        while True:
            allowed_cells = expand_corridor(base_line, buffer_k)
            if len(allowed_cells) == prev_cell_count and buffer_k > 0:
                break
            prev_cell_count = len(allowed_cells)

            logger.debug(
                "Searching at buffer_k=%d (allowed_cells=%d)",
                buffer_k,
                len(allowed_cells),
            )

            path, evaluated_count, cost = find_path(
                start_cell=start_cell,
                goal_cell=goal_cell,
                allowed_cells=allowed_cells,
                blocked_cells=request.blocked_cells,
                edge_weight_mode=request.edge_weight_mode,
                algorithm=request.algorithm,
            )
            total_evaluated_cells += evaluated_count

            if path is not None:
                logger.info(
                    "Path found at buffer_k=%d with %d steps (cost=%.2f, evaluated=%d)",
                    buffer_k,
                    len(path),
                    cost,
                    total_evaluated_cells,
                )
                return RouteResult(
                    success=True,
                    path=path,
                    expanded_buffer_level=buffer_k,
                    evaluated_cells_count=total_evaluated_cells,
                    total_cost=cost,
                )

            if request.max_buffer_expansion is not None and buffer_k >= request.max_buffer_expansion:
                break

            # Dynamic expansion step
            if buffer_k == 0:
                buffer_k = 1
            elif buffer_k < 4:
                buffer_k += 1
            elif buffer_k < 10:
                buffer_k += 2
            else:
                buffer_k += max(3, int(buffer_k * 0.3))

            if buffer_k > 200:
                break

        limit_info = request.max_buffer_expansion if request.max_buffer_expansion is not None else buffer_k
        logger.warning(
            "No route found after reaching expansion level=%s",
            limit_info,
        )
        return RouteResult(
            success=False,
            expanded_buffer_level=limit_info,
            evaluated_cells_count=total_evaluated_cells,
            total_cost=0.0,
            error_message="No traversable route found within max expansion limit",
        )
