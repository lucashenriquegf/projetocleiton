"""Baixa malhas viárias do OpenStreetMap no formato consumido pelo protótipo."""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import osmnx as ox


ROOT_DIR = Path(__file__).resolve().parents[1]
MAPS_DIR = ROOT_DIR / "maps"


@dataclass(frozen=True)
class MapSpec:
    key: str
    label: str
    query: str | dict[str, str]


MAPS = {
    "goiania": MapSpec("goiania", "Goiânia, Goiás, Brazil", "Goiânia, Goiás, Brazil"),
    "inhumas": MapSpec("inhumas", "Inhumas, Goiás, Brazil", "Inhumas, Goiás, Brazil"),
    "goias": MapSpec(
        "goias",
        "Estado de Goiás, Brazil",
        {"state": "Goiás", "country": "Brazil"},
    ),
    "sao-paulo": MapSpec(
        "sao-paulo",
        "São Paulo, São Paulo, Brazil",
        {"city": "São Paulo", "state": "São Paulo", "country": "Brazil"},
    ),
}


HIGHWAY_SPEEDS = {
    "motorway": 100,
    "motorway_link": 60,
    "trunk": 80,
    "trunk_link": 50,
    "primary": 60,
    "primary_link": 40,
    "secondary": 50,
    "secondary_link": 35,
    "tertiary": 40,
    "tertiary_link": 30,
    "residential": 30,
    "unclassified": 30,
    "service": 20,
    "living_street": 10,
}


def json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (list, tuple, set)):
        return [json_value(item) for item in value]
    if hasattr(value, "item"):
        return json_value(value.item())
    return str(value)


def oriented_geometry(graph, source, target, data) -> list[list[float]]:
    geometry = data.get("geometry")
    if geometry is not None:
        coordinates = list(geometry.coords)
    else:
        coordinates = [
            (graph.nodes[source]["x"], graph.nodes[source]["y"]),
            (graph.nodes[target]["x"], graph.nodes[target]["y"]),
        ]

    start = (graph.nodes[source]["x"], graph.nodes[source]["y"])
    first_distance = (coordinates[0][0] - start[0]) ** 2 + (coordinates[0][1] - start[1]) ** 2
    last_distance = (coordinates[-1][0] - start[0]) ** 2 + (coordinates[-1][1] - start[1]) ** 2
    if last_distance < first_distance:
        coordinates.reverse()
    return [[float(latitude), float(longitude)] for longitude, latitude in coordinates]


def write_graph(graph, spec: MapSpec, output_path: Path) -> None:
    temporary_path = output_path.with_suffix(output_path.suffix + ".part")
    with temporary_path.open("w", encoding="utf-8", newline="") as file:
        file.write('{"city":')
        json.dump(spec.label, file, ensure_ascii=False, separators=(",", ":"))
        file.write(',"nodes":[')

        first = True
        for node_id, data in graph.nodes(data=True):
            if not first:
                file.write(",")
            first = False
            json.dump(
                {
                    "id": json_value(node_id),
                    "latitude": float(data["y"]),
                    "longitude": float(data["x"]),
                },
                file,
                ensure_ascii=False,
                separators=(",", ":"),
                allow_nan=False,
            )

        file.write('],"edges":[')
        first = True
        for source, target, _key, data in graph.edges(keys=True, data=True):
            if not first:
                file.write(",")
            first = False
            json.dump(
                {
                    "from": json_value(source),
                    "to": json_value(target),
                    "distance_m": json_value(data.get("length")),
                    "road_name": json_value(data.get("name")),
                    "max_speed": json_value(data.get("maxspeed")),
                    "road_type": json_value(data.get("highway")),
                    "speed_kph": json_value(data.get("speed_kph")),
                    "travel_time_s": json_value(data.get("travel_time")),
                    "geometry": oriented_geometry(graph, source, target, data),
                },
                file,
                ensure_ascii=False,
                separators=(",", ":"),
                allow_nan=False,
            )
        file.write("]}")

    temporary_path.replace(output_path)


def download_map(spec: MapSpec, skip_existing: bool) -> None:
    output_path = MAPS_DIR / f"{spec.key}.json"
    if skip_existing and output_path.exists():
        print(f"[mantido] {spec.label}: {output_path.name}")
        return

    print(f"[baixando] {spec.label}")
    graph = ox.graph.graph_from_place(spec.query, network_type="drive")
    graph = ox.truncate.largest_component(graph, strongly=True)
    graph = ox.routing.add_edge_speeds(graph, hwy_speeds=HIGHWAY_SPEEDS, fallback=40)
    graph = ox.routing.add_edge_travel_times(graph)
    print(f"[convertendo] {len(graph.nodes):,} nós; {len(graph.edges):,} arestas")
    write_graph(graph, spec, output_path)
    print(f"[salvo] {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MiB)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--cities", action="store_true", help="baixa Goiânia, Inhumas e São Paulo")
    selection.add_argument("--all", action="store_true", help="baixa as cidades e também o estado de Goiás")
    selection.add_argument("--map", action="append", choices=MAPS, dest="maps", help="malha a baixar")
    parser.add_argument("--skip-existing", action="store_true", help="não baixa novamente arquivos existentes")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    MAPS_DIR.mkdir(parents=True, exist_ok=True)
    ox.settings.use_cache = True
    ox.settings.cache_folder = ROOT_DIR / "cache" / "osmnx"
    ox.settings.requests_timeout = 300
    selected = ["goiania", "inhumas", "sao-paulo"] if args.cities else list(MAPS) if args.all else args.maps
    for key in selected:
        download_map(MAPS[key], args.skip_existing)


if __name__ == "__main__":
    main()
