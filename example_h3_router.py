"""Example script demonstrating the Dynamic H3 Corridor Routing Engine

with all four routing algorithms (A*, Dijkstra, BFS, DFS).
"""

from h3_router import GeoPoint, H3Router, RouteRequest, get_base_corridor
import h3


def main():
    print("=== Dynamic H3 Corridor Routing Engine Demo ===\n")

    # Origin and destination in Goiania, Brazil
    origin = GeoPoint(lat=-16.6800, lng=-49.2550)
    destination = GeoPoint(lat=-16.6900, lng=-49.2650)
    resolution = 9

    start_cell = h3.latlng_to_cell(origin.lat, origin.lng, resolution)
    goal_cell = h3.latlng_to_cell(destination.lat, destination.lng, resolution)

    print(f"Origin:      {origin.as_tuple} -> H3 Cell: {start_cell}")
    print(f"Destination: {destination.as_tuple} -> H3 Cell: {goal_cell}")

    base_line = get_base_corridor(start_cell, goal_cell)
    print(f"Base corridor length: {len(base_line)} cells\n")

    # 1. Clear corridor test across all 4 algorithms
    print("--- 1. Clear Corridor Test (No obstacles) ---")
    algorithms = ["astar", "dijkstra", "bfs", "dfs"]
    for algo in algorithms:
        req = RouteRequest(
            origin=origin,
            destination=destination,
            resolution=resolution,
            algorithm=algo,
            edge_weight_mode="discrete",
        )
        res = H3Router.find_route(req)
        print(
            f"[{algo.upper():8}] Success: {res.success} | Buffer Level: {res.expanded_buffer_level} | "
            f"Steps: {len(res.path)} | Cost: {res.total_cost:.1f} | Evaluated: {res.evaluated_cells_count}"
        )

    # 2. Obstacle bypass with dynamic lateral corridor expansion
    mid_cell = base_line[len(base_line) // 2]
    print(f"\n--- 2. Obstacle Bypass Test (Blocking middle cell {mid_cell}) ---")
    for algo in algorithms:
        req = RouteRequest(
            origin=origin,
            destination=destination,
            resolution=resolution,
            blocked_cells={mid_cell},
            algorithm=algo,
            max_buffer_expansion=5,
            edge_weight_mode="haversine",
        )
        res = H3Router.find_route(req)
        print(
            f"[{algo.upper():8}] Success: {res.success} | Buffer Level: {res.expanded_buffer_level} | "
            f"Steps: {len(res.path)} | Cost (meters): {res.total_cost:.1f}m | Evaluated: {res.evaluated_cells_count}"
        )

    print("\nDemonstration completed successfully.")


if __name__ == "__main__":
    main()
