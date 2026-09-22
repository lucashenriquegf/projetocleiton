import assert from "node:assert/strict";
import test from "node:test";

import { aStar, aStarWithProgress } from "../src/algorithms/AStar.js";
import { bfs } from "../src/algorithms/BSF.js";
import { dfs } from "../src/algorithms/DFS.js";
import { dijkstra } from "../src/algorithms/Dijkstra.js";
import {
  assembleMultiStopRoute,
  buildPathResult,
  buildRoutingGraph,
  connectStopsToGraph,
  findNearestEdge,
  findNearestNode,
  findStopsOnPath,
  prioritizeStopOrder,
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

test("Dijkstra encontra a rota de menor peso do exemplo fornecido", async () => {
  const graph = {
    nodes: ["Jaraguá", "Anápolis", "Inhumas", "Goiânia"].map((id) => ({ id })),
    edges: [
      { from: "Jaraguá", to: "Anápolis", distance_m: 60 },
      { from: "Jaraguá", to: "Inhumas", distance_m: 75 },
      { from: "Anápolis", to: "Goiânia", distance_m: 65 },
      { from: "Inhumas", to: "Goiânia", distance_m: 45 },
      { from: "Inhumas", to: "Anápolis", distance_m: 40 },
    ],
  };

  assert.deepEqual(
    await dijkstra({ grafo: graph, inicio: "Jaraguá", destino: "Goiânia" }),
    ["Jaraguá", "Inhumas", "Goiânia"],
  );
});

test("Dijkstra usa o tempo estimado como peso no sistema", async () => {
  const graph = {
    nodes: [1, 2, 3].map((id) => ({ id })),
    edges: [
      { from: 1, to: 3, distance_m: 100, travel_time_s: 100 },
      { from: 1, to: 2, distance_m: 150, travel_time_s: 10 },
      { from: 2, to: 3, distance_m: 150, travel_time_s: 10 },
    ],
  };

  assert.deepEqual(
    await dijkstra({ grafo: graph, inicio: 1, destino: 3, cost: "time" }),
    [1, 2, 3],
  );
});

test("Dijkstra registra expansões e aceita cancelamento", async () => {
  const trace = [];
  assert.equal(
    await dijkstra({ grafo: rawGraph, inicio: 1, destino: 5, trace }),
    null,
  );
  assert.ok(trace.some(({ de, para }) => de === 1 && para === 2));

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    dijkstra({
      grafo: rawGraph,
      inicio: 1,
      destino: 3,
      signal: controller.signal,
    }),
    (error) => error.name === "AbortError",
  );

  const runningController = new AbortController();
  await assert.rejects(
    dijkstra({
      grafo: rawGraph,
      inicio: 1,
      destino: 3,
      signal: runningController.signal,
      yieldEvery: 1,
      yieldControl: () => Promise.resolve(),
      onExplore: () => runningController.abort(),
    }),
    (error) => error.name === "AbortError",
  );
});

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

test("planejador prioriza prazo e deixa a coleta mais próxima da entrega urgente por último", () => {
  const departureTime = Date.parse("2026-09-22T08:00:00Z");
  const stops = [
    {
      id: "delivery-later",
      type: "delivery",
      deadline: "2026-09-22T10:00:00Z",
      latitude: 0,
      longitude: 0.002,
    },
    { id: "pickup-near", type: "pickup", latitude: 0, longitude: 0.001 },
    {
      id: "delivery-urgent",
      type: "delivery",
      deadline: "2026-09-22T08:30:00Z",
      latitude: 0,
      longitude: 0,
    },
    { id: "pickup-far", type: "pickup", latitude: 0, longitude: 0.01 },
  ];

  assert.deepEqual(
    prioritizeStopOrder(stops, {
      departureTimeMs: departureTime,
      averageSpeedKph: 40,
    }).map((stop) => stop.id),
    ["pickup-far", "pickup-near", "delivery-urgent", "delivery-later"],
  );
});

test("pontos encontrados no caminho são aproveitados sem nova busca", () => {
  const remainingStops = [
    { id: "target", nodeId: 4, type: "delivery" },
    { id: "pickup", nodeId: 2, type: "pickup" },
    { id: "along-the-way", nodeId: 3, type: "delivery" },
  ];

  assert.deepEqual(
    findStopsOnPath([1, 2, 3, 4], remainingStops, "delivery")
      .map((stop) => stop.id),
    ["along-the-way", "target"],
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

test("algoritmos preservam o caminho ao mostrar lotes de 128 nós", async () => {
  const ids = Array.from({ length: 260 }, (_, index) => index);
  const graph = {
    nodes: ids.map((id) => ({ id, latitude: 0, longitude: id * 0.001 })),
    edges: ids.slice(1).map((id) => ({
      from: id - 1,
      to: id,
      distance_m: 112,
      travel_time_s: 10,
    })),
  };
  const batchCounts = { astar: 0, bfs: 0, dfs: 0, dijkstra: 0 };

  const aStarPath = await aStarWithProgress({
    grafo: graph,
    inicio: 0,
    destino: 259,
    cost: "time",
    yieldEvery: 128,
    yieldControl: async () => { batchCounts.astar += 1; },
  });
  const bfsPath = await bfs({
    grafo: graph,
    inicio: 0,
    destino: 259,
    markers: new Map(),
    yieldEvery: 128,
    yieldControl: async () => { batchCounts.bfs += 1; },
  });
  const dfsPath = await dfs({
    grafo: graph,
    inicio: 0,
    destino: 259,
    yieldEvery: 128,
    yieldControl: async () => { batchCounts.dfs += 1; },
  });
  const dijkstraPath = await dijkstra({
    grafo: graph,
    inicio: 0,
    destino: 259,
    cost: "time",
    yieldEvery: 128,
    yieldControl: async () => { batchCounts.dijkstra += 1; },
  });

  assert.deepEqual(aStarPath, ids);
  assert.deepEqual(bfsPath, ids);
  assert.deepEqual(dfsPath, ids);
  assert.deepEqual(dijkstraPath, ids);
  assert.deepEqual(batchCounts, { astar: 3, bfs: 3, dfs: 3, dijkstra: 3 });

  const controller = new AbortController();
  await assert.rejects(
    aStarWithProgress({
      grafo: graph,
      inicio: 0,
      destino: 259,
      cost: "time",
      signal: controller.signal,
      yieldEvery: 128,
      yieldControl: async () => controller.abort(),
    }),
    (error) => error.name === "AbortError",
  );
});

test("A* e Dijkstra encontram caminho mesmo quando arestas não possuem travel_time_s ou possuem null/arrays", async () => {
  const graphWithIncompleteEdges = {
    nodes: [
      { id: "A", latitude: -16.4, longitude: -49.5 },
      { id: "B", latitude: -16.4, longitude: -49.499 },
      { id: "C", latitude: -16.4, longitude: -49.498 },
      { id: "D", latitude: -16.4, longitude: -49.497 },
    ],
    edges: [
      // Aresta sem travel_time_s (apenas distance_m)
      { from: "A", to: "B", distance_m: 100 },
      // Aresta com travel_time_s = null
      { from: "B", to: "C", distance_m: 100, travel_time_s: null },
      // Aresta com travel_time_s como array [tempo1, tempo2]
      { from: "C", to: "D", distance_m: 100, travel_time_s: [10, 15], speed_kph: [36, 40] },
    ],
  };

  const aStarRoute = await aStar({
    grafo: graphWithIncompleteEdges,
    inicio: "A",
    destino: "D",
    cost: "time",
    fallbackSpeedKph: 36,
  });

  const dijkstraRoute = await dijkstra({
    grafo: graphWithIncompleteEdges,
    inicio: "A",
    destino: "D",
    cost: "time",
    fallbackSpeedKph: 36,
  });

  assert.deepEqual(aStarRoute, ["A", "B", "C", "D"]);
  assert.deepEqual(dijkstraRoute, ["A", "B", "C", "D"]);
});

test("A* e Dijkstra não quebram e não propagam NaN na heurística com arestas com tempos inválidos", async () => {
  const graphWithMalformed = {
    nodes: [
      { id: 1, latitude: -16.68, longitude: -49.25 },
      { id: 2, latitude: -16.69, longitude: -49.26 },
      { id: 3, latitude: -16.70, longitude: -49.27 },
    ],
    edges: [
      // Aresta malformada em outra parte do grafo
      { from: 1, to: 2, distance_m: 50, travel_time_s: NaN, speed_kph: null },
      { from: 2, to: 3, distance_m: 50, travel_time_s: -5 },
      // Caminho válido
      { from: 1, to: 3, distance_m: 80, road_name: "Via Direta" },
    ],
  };

  const aStarRoute = await aStar({
    grafo: graphWithMalformed,
    inicio: 1,
    destino: 3,
    cost: "time",
  });

  const dijkstraRoute = await dijkstra({
    grafo: graphWithMalformed,
    inicio: 1,
    destino: 3,
    cost: "time",
  });

  assert.deepEqual(aStarRoute, [1, 3]);
  assert.deepEqual(dijkstraRoute, [1, 3]);
});

test("Dijkstra interrompe busca após alcançar o destino em vez de varrer nós distantes", async () => {
  const trace = [];
  const graph = {
    nodes: [
      { id: "origem", latitude: 0, longitude: 0 },
      { id: "destino", latitude: 0, longitude: 0.001 },
      { id: "distante1", latitude: 1, longitude: 1 },
      { id: "distante2", latitude: 2, longitude: 2 },
    ],
    edges: [
      { from: "origem", to: "destino", distance_m: 100 },
      { from: "destino", to: "distante1", distance_m: 50000 },
      { from: "distante1", to: "distante2", distance_m: 50000 },
    ],
  };

  const rota = await dijkstra({
    grafo: graph,
    inicio: "origem",
    destino: "destino",
    cost: "distance",
    trace,
  });

  assert.deepEqual(rota, ["origem", "destino"]);
  // Não deve ter expandido de 'distante1' para 'distante2'
  assert.ok(!trace.some(({ de, para }) => de === "distante1" && para === "distante2"));
});

