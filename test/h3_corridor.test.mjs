import assert from "node:assert/strict";
import test from "node:test";
import * as h3 from "h3-js";

globalThis.h3 = h3;

import {
  expandCorridor,
  filterGraphByCorridor,
  getBaseCorridor,
  haversineDistance,
  lerpLineCells,
} from "../src/algorithms/h3_corridor.js";

test("haversineDistance calcula distância corretamente", () => {
  const p1 = [-16.68, -49.255];
  const p2 = [-16.69, -49.265];
  const d = haversineDistance(p1, p2);
  assert(d > 1000 && d < 2000, `Distância esperada ~1.5km, obtida: ${d}`);
});

test("getBaseCorridor gera linha base contígua de hexágonos", () => {
  const c1 = h3.latLngToCell(-16.68, -49.255, 9);
  const c2 = h3.latLngToCell(-16.69, -49.265, 9);
  const path = getBaseCorridor(c1, c2, 9, h3);

  assert(path.length >= 2, "Caminho base deve ter pelo menos 2 células");
  assert.equal(path[0], c1);
  assert.equal(path.at(-1), c2);
});

test("expandCorridor expande lateralmente o corredor", () => {
  const c1 = h3.latLngToCell(-16.68, -49.255, 9);
  const c2 = h3.latLngToCell(-16.69, -49.265, 9);
  const baseLine = getBaseCorridor(c1, c2, 9, h3);

  const k0 = expandCorridor(baseLine, 0, h3);
  const k1 = expandCorridor(baseLine, 1, h3);
  const k2 = expandCorridor(baseLine, 2, h3);

  assert.equal(k0.size, baseLine.length);
  assert(k1.size > k0.size);
  assert(k2.size > k1.size);
});

test("filterGraphByCorridor restringe nós e arestas ao corredor", () => {
  const c1 = h3.latLngToCell(-16.68, -49.255, 9);
  const c2 = h3.latLngToCell(-16.69, -49.265, 9);
  const baseLine = getBaseCorridor(c1, c2, 9, h3);
  const allowed = expandCorridor(baseLine, 1, h3);

  const mockGraph = {
    nodes: [
      { id: "inside1", latitude: -16.68, longitude: -49.255 },
      { id: "inside2", latitude: -16.685, longitude: -49.26 },
      { id: "outside", latitude: -16.75, longitude: -49.35 },
    ],
    edges: [
      { from: "inside1", to: "inside2", distance_m: 50 },
      { from: "inside2", to: "outside", distance_m: 5000 },
    ],
  };

  const filtered = filterGraphByCorridor(mockGraph, allowed, new Set(), 9, "inside1", "inside2", h3);
  const nodeIds = filtered.nodes.map((n) => n.id);

  assert(nodeIds.includes("inside1"));
  assert(nodeIds.includes("inside2"));
  assert(!nodeIds.includes("outside"));
  assert.equal(filtered.edges.length, 1);
  assert.equal(filtered.edges[0].from, "inside1");
  assert.equal(filtered.edges[0].to, "inside2");
});
