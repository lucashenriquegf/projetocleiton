import assert from "node:assert/strict";
import test from "node:test";

import { aStar } from "../src/algorithms/AStar.js";
import { dfs } from "../src/algorithms/DFS.js";
import {
  assembleMultiStopRoute,
  buildPathResult,
  buildRoutingGraph,
  connectStopsToGraph,
  findNearestEdge,
  findNearestNode,
  optimizeStopOrder,
} from "../src/algorithms/routing.mjs";

const rawGraph = {
  nodes: [
    { id: 1, latitude: -16.4, longitude: -49.5 },
    { id: 2, latitude: -16.4, longitude: -49.4995 },
    { id: 3, latitude: -16.3995, longitude: -49.4995 },
    { id: 4, latitude: -16.3995, longitude: -49.499 },
    { id: 5, latitude: -16.41, longitude: -49.51 },
  ],
  edges: [
    {
      from: 1,
      to: 2,
      distance_m: 100,
      road_name: "Rua A",
      geometry: [[-16.4, -49.5], [-16.3998, -49.49975], [-16.4, -49.4995]],
    },
    { from: 2, to: 3, distance_m: 120, road_name: "Rua B" },
    { from: 1, to: 3, distance_m: 500, road_name: "Rua Longa" },
    { from: 3, to: 4, distance_m: 80, road_name: "Rua C" },
  ],
};

const routingGraph = buildRoutingGraph(rawGraph);

test("DFS segue em profundidade e para no primeiro caminho até o destino", async () => {
  const graph = {
    nodes: [1, 2, 3, 4].map((id) => ({ id })),
    edges: [
      { from: 1, to: 2, distance_m: 1 },
      { from: 2, to: 4, distance_m: 10 },
      { from: 1, to: 3, distance_m: 2 },
      { from: 3, to: 4, distance_m: 2 },
    ],
  };

  assert.deepEqual(
    await dfs({ grafo: graph, inicio: 1, destino: 4 }),
    [1, 2, 4],
  );
});

test("DFS retorna nulo quando não existe caminho até o destino", async () => {
  assert.equal(await dfs({ grafo: rawGraph, inicio: 1, destino: 5 }), null);
});

test("DFS registra as arestas exploradas para visualização", async () => {
  const trace = [];
  await dfs({ grafo: rawGraph, inicio: 1, destino: 3, trace });

  assert.ok(trace.some(({ de, para }) => de === 1 && para === 2));
  assert.ok(trace.some(({ de, para }) => de === 2 && para === 3));
});

test("DFS não usa a heurística nem o custo do A*", async () => {
  const graph = {
    nodes: [
      { id: 1, latitude: 0, longitude: 0 },
      { id: 2, latitude: 0, longitude: 0.001 },
      { id: 3, latitude: 0, longitude: 0.002 },
    ],
    edges: [
      { from: 1, to: 3, distance_m: 100, travel_time_s: 100 },
      { from: 1, to: 2, distance_m: 150, travel_time_s: 10 },
      { from: 2, to: 3, distance_m: 150, travel_time_s: 10 },
    ],
  };

  const dfsPath = await dfs({
    grafo: graph,
    inicio: 1,
    destino: 3,
    cost: "time",
  });
  const aStarPath = aStar({
    grafo: graph,
    inicio: 1,
    destino: 3,
    cost: "time",
  });

  assert.deepEqual(dfsPath, [1, 3]);
  assert.deepEqual(aStarPath, [1, 2, 3]);
});

test("DFS pode ser cancelado", async () => {
  const graph = {
    nodes: [1, 2, 3].map((id) => ({ id })),
    edges: [
      { from: 1, to: 2, distance_m: 1 },
      { from: 2, to: 3, distance_m: 1 },
    ],
  };

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    dfs({
      grafo: graph,
      inicio: 1,
      destino: 3,
      signal: controller.signal,
    }),
    (error) => error.name === "AbortError",
  );
});

test("A* escolhe o menor caminho usando g_score e h_score", () => {
  const nodeIds = aStar({ grafo: rawGraph, inicio: 1, destino: 3 });

  assert.deepEqual(nodeIds, [1, 2, 3]);
});

test("A* retorna nulo quando não existe caminho", () => {
  assert.equal(aStar({ grafo: rawGraph, inicio: 1, destino: 5 }), null);
});

test("A* registra as arestas expandidas para visualização", () => {
  const trace = [];
  aStar({ grafo: rawGraph, inicio: 1, destino: 3, trace });

  assert.deepEqual(trace, [
    { from: 1, to: 2 },
    { from: 2, to: 3 },
  ]);
});

test("resultado do A* preserva distância, vias e geometria curva", () => {
  const nodeIds = aStar({ grafo: rawGraph, inicio: 1, destino: 3 });
  const result = buildPathResult(routingGraph, nodeIds);

  assert.equal(result.distanceMeters, 220);
  assert.deepEqual(result.roads, ["Rua A", "Rua B"]);
  assert.deepEqual(result.coordinates.slice(0, 3), [
    [-16.4, -49.5],
    [-16.3998, -49.49975],
    [-16.4, -49.4995],
  ]);
});

test("rota A* com múltiplas paradas concatena os trechos", () => {
  const stops = [
    { id: "a", nodeId: 1, name: "Coleta 1" },
    { id: "b", nodeId: 3, name: "Coleta 2" },
    { id: "c", nodeId: 4, name: "Entrega 1" },
  ];
  const pathResults = [
    buildPathResult(routingGraph, aStar({ grafo: rawGraph, inicio: 1, destino: 3 })),
    buildPathResult(routingGraph, aStar({ grafo: rawGraph, inicio: 3, destino: 4 })),
  ];
  const result = assembleMultiStopRoute(stops, pathResults);

  assert.equal(result.distanceMeters, 300);
  assert.deepEqual(result.nodeIds, [1, 2, 3, 4]);
  assert.equal(result.segments.length, 2);
});

test("ponto solto é associado ao nó mais próximo", () => {
  assert.equal(findNearestNode(routingGraph, -16.4001, -49.4999).id, 1);
});

test("planejador decide a ordem das coletas e entregas usando tempo e prazo", () => {
  const departureTime = Date.parse("2026-09-22T08:00:00Z");
  const stops = [
    { id: "delivery-later", type: "delivery", deadline: "2026-09-22T08:16:40Z" },
    { id: "pickup-2", type: "pickup" },
    { id: "delivery-urgent", type: "delivery", deadline: "2026-09-22T08:01:40Z" },
    { id: "pickup-1", type: "pickup" },
  ];
  const travelTimes = new Map([
    ["pickup-1:pickup-2", 20],
    ["pickup-2:pickup-1", 20],
    ["pickup-2:delivery-urgent", 20],
    ["pickup-2:delivery-later", 10],
    ["pickup-1:delivery-urgent", 200],
    ["pickup-1:delivery-later", 10],
    ["delivery-urgent:delivery-later", 20],
    ["delivery-later:delivery-urgent", 100],
  ]);
  const getTravelTime = (from, to) => travelTimes.get(`${from.id}:${to.id}`) ?? 500;

  assert.deepEqual(
    optimizeStopOrder(stops, getTravelTime, departureTime).map((stop) => stop.id),
    ["pickup-1", "pickup-2", "delivery-urgent", "delivery-later"],
  );
});

test("ponto é projetado e conectado no meio da aresta", async () => {
  const streetGraph = {
    nodes: [
      { id: "a", latitude: 0, longitude: 0 },
      { id: "b", latitude: 0, longitude: 0.01 },
    ],
    edges: [
      { from: "a", to: "b", distance_m: 1000, speed_kph: 50, travel_time_s: 72 },
      { from: "b", to: "a", distance_m: 1000, speed_kph: 50, travel_time_s: 72 },
    ],
  };
  const streetRoutingGraph = buildRoutingGraph(streetGraph);
  const nearestEdge = findNearestEdge(streetRoutingGraph, 0.0002, 0.004);

  assert.ok(Math.abs(nearestEdge.latitude) < 1e-9);
  assert.ok(Math.abs(nearestEdge.longitude - 0.004) < 1e-9);

  const connected = connectStopsToGraph(streetGraph, [
    { id: "first", name: "Coleta", type: "pickup", latitude: 0, longitude: 0.002, edgeIndex: 0 },
    { id: "second", name: "Entrega", type: "delivery", latitude: 0, longitude: 0.008, edgeIndex: 0 },
  ]);
  const connectedRoutingGraph = buildRoutingGraph(connected.graph);
  assert.equal(
    connected.graph.edges.some((edge) =>
      edge.from === "a" && edge.to === "b" && !edge.virtual,
    ),
    false,
  );
  const nodeIds = aStar({
    grafo: connected.graph,
    inicio: connected.stops[0].nodeId,
    destino: connected.stops[1].nodeId,
    cost: "time",
  });
  const result = buildPathResult(connectedRoutingGraph, nodeIds);
  const dfsNodeIds = await dfs({
    grafo: connected.graph,
    inicio: connected.stops[0].nodeId,
    destino: connected.stops[1].nodeId,
  });

  assert.deepEqual(nodeIds, ["stop:first", "stop:second"]);
  assert.deepEqual(dfsNodeIds, ["stop:first", "stop:second"]);
  assert.ok(Math.abs(result.distanceMeters - 600) < 0.001);
  assert.ok(Math.abs(result.travelTimeSeconds - 43.2) < 0.001);
});

test("A* pode minimizar tempo em vez de distância", () => {
  const graph = {
    nodes: [
      { id: 1, latitude: 0, longitude: 0 },
      { id: 2, latitude: 0, longitude: 0.001 },
      { id: 3, latitude: 0, longitude: 0.002 },
    ],
    edges: [
      { from: 1, to: 3, distance_m: 100, travel_time_s: 100 },
      { from: 1, to: 2, distance_m: 150, travel_time_s: 10 },
      { from: 2, to: 3, distance_m: 150, travel_time_s: 10 },
    ],
  };

  assert.deepEqual(aStar({ grafo: graph, inicio: 1, destino: 3 }), [1, 3]);
  assert.deepEqual(aStar({ grafo: graph, inicio: 1, destino: 3, cost: "time" }), [1, 2, 3]);
});
