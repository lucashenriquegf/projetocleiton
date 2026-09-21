import assert from "node:assert/strict";
import test from "node:test";

import { aStar } from "../src/algorithms/AStar.js";
import {
  assembleMultiStopRoute,
  buildPathResult,
  buildRoutingGraph,
  findNearestNode,
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

test("A* escolhe o menor caminho usando g_score e h_score", () => {
  const nodeIds = aStar({ grafo: rawGraph, inicio: 1, destino: 3 });

  assert.deepEqual(nodeIds, [1, 2, 3]);
});

test("A* retorna nulo quando não existe caminho", () => {
  assert.equal(aStar({ grafo: rawGraph, inicio: 1, destino: 5 }), null);
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
