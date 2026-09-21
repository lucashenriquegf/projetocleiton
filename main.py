import json
import osmnx as ox

cidade = "Inhumas, Goiás, Brazil"

print(f"Baixando mapa de: {cidade}")

# Obtém a rede de ruas para veículos
G = ox.graph.graph_from_place(
    cidade,
    network_type="drive"
)

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

print(f"Nós encontrados: {len(G.nodes)}")
print(f"Arestas encontradas: {len(G.edges)}")

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

with open("Inhumas.json", "w", encoding="utf-8") as file:
    json.dump(
        graph,
        file,
        ensure_ascii=False,
        indent=2
    )

print("Grafo salvo em: Inhumas.json")
