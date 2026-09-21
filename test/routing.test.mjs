import assert from "node:assert/strict";
import test from "node:test";

import {
  aStarPath,
  buildRoutingGraph,
  calculateMultiStopRoute,
  depthFirstPath,
  findNearestNode,
  shortestPath,
} from "../src/algorithms/routing.mjs";

const graph = buildRoutingGraph({
  nodes: [
    { id: 1, latitude: -16.4, longitude: -49.5 },
    { id: 2, latitude: -16.4, longitude: -49.4995 },
    { id: 3, latitude: -16.3995, longitude: -49.4995 },
    { id: 4, latitude: -16.3995, longitude: -49.499 },
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
});

test("Dijkstra escolhe o menor caminho e preserva as vias", () => {
  const result = shortestPath(graph, 1, 3);

  assert.deepEqual(result.nodeIds, [1, 2, 3]);
  assert.equal(result.distanceMeters, 220);
  assert.deepEqual(result.roads, ["Rua A", "Rua B"]);
  assert.deepEqual(result.coordinates.slice(0, 3), [
    [-16.4, -49.5],
    [-16.3998, -49.49975],
    [-16.4, -49.4995],
  ]);
});

test("A* encontra a mesma menor distância do Dijkstra", () => {
  assert.equal(aStarPath(graph, 1, 3).distanceMeters, 220);
});

test("DFS encontra um caminho válido", () => {
  const result = depthFirstPath(graph, 1, 4);
  assert.equal(result.nodeIds[0], 1);
  assert.equal(result.nodeIds.at(-1), 4);
});

test("rota com múltiplas paradas concatena os trechos", () => {
  const stops = [
    { id: "a", nodeId: 1, name: "Coleta 1" },
    { id: "b", nodeId: 3, name: "Coleta 2" },
    { id: "c", nodeId: 4, name: "Entrega 1" },
  ];
  const result = calculateMultiStopRoute(graph, stops);

  assert.equal(result.distanceMeters, 300);
  assert.deepEqual(result.nodeIds, [1, 2, 3, 4]);
  assert.equal(result.segments.length, 2);
});

test("ponto solto é associado ao nó mais próximo", () => {
  assert.equal(findNearestNode(graph, -16.4001, -49.4999).id, 1);
});
