import assert from "node:assert/strict";
import test from "node:test";
import * as h3 from "h3-js";

import { runRouteConfiguration } from "../src/algorithms/routeComparison.js";

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
