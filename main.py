import json
import osmnx as ox

cidade = "Inhumas, Goiás, Brazil"

print(f"Baixando mapa de: {cidade}")

# Obtém a rede de ruas para veículos
G = ox.graph.graph_from_place(
    cidade,
    network_type="drive"
)

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
    edges.append({
        "from": u,
        "to": v,
        "distance_m": data.get("length"),
        "road_name": data.get("name"),
        "max_speed": data.get("maxspeed")
    })

graph = {
    "city": cidade,
    "nodes": nodes,
    "edges": edges
}

with open("cidade.json", "w", encoding="utf-8") as file:
    json.dump(
        graph,
        file,
        ensure_ascii=False,
        indent=2
    )

print("Grafo salvo em: cidade.json")