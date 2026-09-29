import assert from "node:assert/strict";
import test from "node:test";
import * as h3 from "h3-js";

import {
  prepareRouteComparison,
  prepareRouteNetwork,
  recommendComparisonWorkerCount,
  runRouteConfiguration,
} from "../src/algorithms/routeComparison.js";

const graph = {
  city: "Teste",
  nodes: [
    { id: 1, latitude: -16.68, longitude: -49.26 },
    { id: 2, latitude: -16.68, longitude: -49.25 },
    { id: 3, latitude: -16.68, longitude: -49.24 },
    { id: 4, latitude: -16.68, longitude: -49.23 },
    { id: 5, latitude: -16.68, longitude: -49.22 },
  ],
  edges: [
    { from: 1, to: 2, distance_m: 1000, travel_time_s: 100, geometry: [[-16.68, -49.26], [-16.68, -49.25]] },
    { from: 2, to: 3, distance_m: 1000, travel_time_s: 100, geometry: [[-16.68, -49.25], [-16.68, -49.24]] },
    { from: 3, to: 4, distance_m: 1000, travel_time_s: 100, geometry: [[-16.68, -49.24], [-16.68, -49.23]] },
    { from: 4, to: 5, distance_m: 1000, travel_time_s: 100, geometry: [[-16.68, -49.23], [-16.68, -49.22]] },
  ],
};

const stops = [
  { id: "pickup", type: "pickup", name: "Coleta", edgeIndex: 0, latitude: -16.68, longitude: -49.2575 },
  { id: "delivery", type: "delivery", name: "Entrega", edgeIndex: 3, latitude: -16.68, longitude: -49.2225, deadline: new Date(Date.now() + 3_600_000).toISOString() },
];

test("módulo compara configurações arbitrárias no mesmo cenário", async () => {
  const departureTimeMs = Date.now();
  const normal = await runRouteConfiguration({
    graph,
    stops,
    departureTimeMs,
    configuration: { algorithm: "astar", modelType: "normal", useH3: false, h3Resolution: 9 },
  });
  const bidirectional = await runRouteConfiguration({
    graph,
    stops,
    departureTimeMs,
    configuration: { algorithm: "dijkstra", modelType: "bidirectional", useH3: false, h3Resolution: 9 },
  });

  assert.equal(normal.result.error, undefined);
  assert.equal(bidirectional.result.error, undefined);
  assert.equal(normal.result.distanceMeters, bidirectional.result.distanceMeters);
  assert.equal(normal.result.travelTimeSeconds, bidirectional.result.travelTimeSeconds);
  assert.equal(normal.h3Info, null);
  assert.equal(bidirectional.h3Info, null);
  assert.ok(normal.trace.every((event) => event.direction === "forward"));
  assert.ok(bidirectional.trace.some((event) => event.direction === "backward"));
});

test("cada configuração controla seu próprio corredor H3", async () => {
  const outcome = await runRouteConfiguration({
    graph,
    stops,
    h3,
    configuration: { algorithm: "dijkstra", modelType: "normal", useH3: true, h3Resolution: 9 },
  });

  assert.equal(outcome.result.error, undefined);
  assert.equal(outcome.h3Info.resolution, 9);
  assert.ok(outcome.h3Info.cellCount > 0);
  assert.ok(outcome.corridorCells.length > 0);
});

test("comparação executa Greedy e Beam nos modos normal e bidirecional", async () => {
  for (const algorithm of ["greedy", "beam"]) {
    for (const modelType of ["normal", "bidirectional"]) {
      const outcome = await runRouteConfiguration({
        graph,
        stops,
        configuration: {
          algorithm,
          modelType,
          useH3: false,
          h3Resolution: 9,
        },
      });
      assert.equal(outcome.result.error, undefined, `${algorithm} ${modelType}`);
      assert.ok(outcome.result.distanceMeters > 0, `${algorithm} ${modelType}`);
      assert.ok(outcome.trace.length > 0, `${algorithm} ${modelType}`);
    }
  }
});

test("módulo de comparação aceita cancelamento", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runRouteConfiguration({
      graph,
      stops,
      signal: controller.signal,
      configuration: { algorithm: "bfs", modelType: "bidirectional", useH3: false, h3Resolution: 9 },
    }),
    (error) => error.name === "AbortError",
  );
});

test("modo leve conta expansões sem reter o histórico de visualização", async () => {
  const outcome = await runRouteConfiguration({
    graph,
    stops,
    collectTrace: false,
    configuration: { algorithm: "dijkstra", modelType: "normal", useH3: true, h3Resolution: 9 },
    h3,
  });

  assert.equal(outcome.result.error, undefined);
  assert.ok(outcome.explorationCount > 0);
  assert.deepEqual(outcome.trace, []);
  assert.deepEqual(outcome.corridorCells, []);
  assert.ok(outcome.h3Info.cellCount > 0);
});

test("preparação comum pode ser reaproveitada por configurações diferentes", async () => {
  const departureTimeMs = Date.now();
  const prepared = await prepareRouteComparison({ graph, stops, departureTimeMs, averageSpeedKph: 40 });
  const first = await runRouteConfiguration({
    prepared,
    departureTimeMs,
    collectTrace: false,
    configuration: { algorithm: "astar", modelType: "normal", useH3: false, h3Resolution: 9 },
  });
  const second = await runRouteConfiguration({
    prepared,
    departureTimeMs,
    collectTrace: false,
    configuration: { algorithm: "dijkstra", modelType: "normal", useH3: false, h3Resolution: 9 },
  });

  assert.equal(first.result.distanceMeters, second.result.distanceMeters);
  assert.ok(first.explorationCount > 0);
  assert.ok(second.explorationCount > 0);
});

test("cada configuração escolhe sua própria estratégia de ordenação", async () => {
  const departureTimeMs = Date.now();
  const preparedNetwork = await prepareRouteNetwork({ graph, stops, averageSpeedKph: 40 });
  const priority = await prepareRouteComparison({
    preparedNetwork,
    departureTimeMs,
    orderStrategy: "priority",
  });
  const ils = await prepareRouteComparison({
    preparedNetwork,
    departureTimeMs,
    orderStrategy: "ils",
    orderBudgetMs: 10,
  });

  assert.equal(priority.orderInfo.strategy, "priority");
  assert.equal(ils.orderInfo.strategy, "ils");
  assert.equal(ils.orderInfo.budgetMs, 10);
  assert.equal(priority.routingGraph, ils.routingGraph);
});

test("execução usa a ordenação definida na configuração", async () => {
  const outcome = await runRouteConfiguration({
    graph,
    stops,
    configuration: {
      algorithm: "astar",
      modelType: "normal",
      orderStrategy: "ils",
      orderBudgetMs: 10,
      useH3: false,
      h3Resolution: 9,
    },
  });

  assert.equal(outcome.result.error, undefined);
  assert.equal(outcome.planningInfo.strategy, "ils");
  assert.equal(outcome.planningInfo.budgetMs, 10);
});

test("malhas grandes reduzem automaticamente o paralelismo", () => {
  assert.equal(recommendComparisonWorkerCount({
    nodeCount: 122_466,
    edgeCount: 304_258,
    totalTasks: 60,
    hardwareConcurrency: 16,
  }), 1);
  assert.equal(recommendComparisonWorkerCount({
    nodeCount: 39_670,
    edgeCount: 102_122,
    totalTasks: 60,
    hardwareConcurrency: 16,
  }), 2);
  assert.equal(recommendComparisonWorkerCount({
    nodeCount: 2_630,
    edgeCount: 7_321,
    totalTasks: 2,
    hardwareConcurrency: 16,
  }), 2);
});

test("comparação avalia o prazo na chegada e pode retornar ao início", async () => {
  const departureTimeMs = Date.parse("2026-09-22T08:00:00Z");
  const closedGraph = {
    nodes: [
      { id: "a", latitude: 0, longitude: 0 },
      { id: "b", latitude: 0, longitude: 0.01 },
    ],
    edges: [
      { from: "a", to: "b", distance_m: 1000, travel_time_s: 100 },
      { from: "b", to: "a", distance_m: 1000, travel_time_s: 120 },
    ],
  };
  const closedStops = [
    { id: "p", type: "pickup", name: "Coleta", edgeIndex: 0, latitude: 0, longitude: 0.002 },
    { id: "d", type: "delivery", name: "Entrega", edgeIndex: 0, latitude: 0, longitude: 0.008, deadline: "2026-09-22T08:01:30Z" },
  ];
  const outcome = await runRouteConfiguration({
    graph: closedGraph,
    stops: closedStops,
    departureTimeMs,
    returnToStart: true,
    configuration: { algorithm: "dijkstra", modelType: "normal", useH3: false, h3Resolution: 9 },
  });

  assert.equal(outcome.result.error, undefined);
  assert.equal(outcome.result.segments.length, 2);
  assert.equal(outcome.result.segments.at(-1).to.type, "return");
  assert.equal(outcome.deadlineInfo.lateCount, 0);
  assert.equal(outcome.deadlineInfo.onTimeCount, 1);
});

test("preparação aceita ILS como estratégia comum de ordenação", async () => {
  const prepared = await prepareRouteComparison({
    graph,
    stops,
    orderStrategy: "ils",
    orderBudgetMs: 10,
  });

  assert.equal(prepared.orderInfo.strategy, "ils");
  assert.ok(prepared.orderInfo.candidateCount >= 1);
  assert.deepEqual(prepared.plannedStops.map((stop) => stop.type), ["pickup", "delivery"]);
});
