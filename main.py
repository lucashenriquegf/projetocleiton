import json
from pathlib import Path

cidade = "São Paulo, São Paulo, Brazil"
maps_dir = Path(__file__).resolve().parent / "maps"
map_path = maps_dir / "sao-paulo.json"

if map_path.exists():
    print(f"Carregando mapa já existente de: {map_path}")
    with open(map_path, "r", encoding="utf-8") as file:
        graph = json.load(file)

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
else:
    import osmnx as ox

    print(f"Baixando mapa de: {cidade}")

    # Obtém a rede de ruas para veículos
    G = ox.graph.graph_from_place(
        cidade,
        network_type="drive"
    )

    # Garante que apenas o maior componente fortemente conectado seja mantido,
    # eliminando ilhas isoladas e becos sem saída desconectados no OpenStreetMap
    G = ox.truncate.largest_component(G, strongly=True)

    # O OpenStreetMap nem sempre informa maxspeed. Nesses casos, o OSMnx usa
    # velocidades típicas por categoria viária para estimar o tempo em fluxo livre.
    velocidades_por_via = {
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

    G = ox.routing.add_edge_speeds(
        G,
        hwy_speeds=velocidades_por_via,
        fallback=40,
    )
    G = ox.routing.add_edge_travel_times(G)

    nodes = []

    for node_id, data in G.nodes(data=True):
        nodes.append({
            "id": node_id,
            "latitude": data["y"],
            "longitude": data["x"]
        })

    edges = []

    for u, v, key, data in G.edges(keys=True, data=True):
        geometry = data.get("geometry")

        if geometry is not None:
            coordinates = list(geometry.coords)
        else:
            coordinates = [
                (G.nodes[u]["x"], G.nodes[u]["y"]),
                (G.nodes[v]["x"], G.nodes[v]["y"])
            ]

        # Garante que a geometria siga a direção da aresta (u -> v).
        start = (G.nodes[u]["x"], G.nodes[u]["y"])
        first_distance = (coordinates[0][0] - start[0]) ** 2 + (coordinates[0][1] - start[1]) ** 2
        last_distance = (coordinates[-1][0] - start[0]) ** 2 + (coordinates[-1][1] - start[1]) ** 2

        if last_distance < first_distance:
            coordinates.reverse()

        edges.append({
            "from": u,
            "to": v,
            "distance_m": data.get("length"),
            "road_name": data.get("name"),
            "max_speed": data.get("maxspeed"),
            "road_type": data.get("highway"),
            "speed_kph": data.get("speed_kph"),
            "travel_time_s": data.get("travel_time"),
            "geometry": [[latitude, longitude] for longitude, latitude in coordinates]
        })

    graph = {
        "city": cidade,
        "nodes": nodes,
        "edges": edges
    }

    maps_dir.mkdir(parents=True, exist_ok=True)
    with open(map_path, "w", encoding="utf-8") as file:
        json.dump(
            graph,
            file,
            ensure_ascii=False,
            indent=2
        )

    print(f"Grafo salvo em: {map_path}")

print(f"Cidade: {cidade}")
print(f"Nós encontrados: {len(nodes)}")
print(f"Arestas encontradas: {len(edges)}")

