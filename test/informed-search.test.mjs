import assert from "node:assert/strict";
import test from "node:test";

import { beamSearch } from "../src/algorithms/BeamSearch.js";
import { greedyBestFirst } from "../src/algorithms/GreedyBestFirst.js";
import { bidirectionalBeamSearch } from "../src/algorithms/BidirectionalBeamSearch.js";
import { bidirectionalGreedyBestFirst } from "../src/algorithms/BidirectionalGreedyBestFirst.js";

const directedLine = {
  nodes: Array.from({ length: 260 }, (_, id) => ({
    id,
    latitude: 0,
    longitude: id * 0.0001,
  })),
  edges: Array.from({ length: 259 }, (_, id) => ({
    from: id,
    to: id + 1,
    distance_m: 12,
    travel_time_s: 1,
  })),
};

test("Greedy Best-First usa somente a heurística e pode escolher uma rota mais cara", async () => {
  const graph = {
    nodes: [
      { id: "S", latitude: 0, longitude: 0 },
      { id: "A", latitude: 0, longitude: 0.009 },
      { id: "B", latitude: 0, longitude: -0.001 },
      { id: "G", latitude: 0, longitude: 0.01 },
    ],
    edges: [
      { from: "S", to: "A", distance_m: 100, travel_time_s: 100 },
      { from: "A", to: "G", distance_m: 100, travel_time_s: 100 },
      { from: "S", to: "B", distance_m: 100, travel_time_s: 1 },
      { from: "B", to: "G", distance_m: 100, travel_time_s: 1 },
    ],
  };

  assert.deepEqual(
    await greedyBestFirst({ grafo: graph, inicio: "S", destino: "G", cost: "time" }),
    ["S", "A", "G"],
  );
});

test("Beam Search limita cada nível à largura configurada", async () => {
  const graph = {
    nodes: [
      { id: "S", latitude: 0, longitude: 0 },
      { id: "dead-end", latitude: 0, longitude: 0.009 },
      { id: "detour", latitude: 0.01, longitude: 0 },
      { id: "G", latitude: 0, longitude: 0.01 },
    ],
    edges: [
      { from: "S", to: "dead-end", distance_m: 1 },
      { from: "S", to: "detour", distance_m: 1 },
      { from: "detour", to: "G", distance_m: 1 },
    ],
  };

  assert.equal(
    await beamSearch({ grafo: graph, inicio: "S", destino: "G", beamWidth: 1 }),
    null,
  );
  assert.deepEqual(
    await beamSearch({ grafo: graph, inicio: "S", destino: "G", beamWidth: 2 }),
    ["S", "detour", "G"],
  );
});

test("variantes normal e bidirecional respeitam direção, lotes e cancelamento", async () => {
  const variants = [
    ["Greedy", greedyBestFirst],
    ["Beam", beamSearch],
    ["Greedy bidirecional", bidirectionalGreedyBestFirst],
    ["Beam bidirecional", bidirectionalBeamSearch],
  ];
  const expected = directedLine.nodes.map(({ id }) => id);

  for (const [name, search] of variants) {
    const trace = [];
    let batches = 0;
    assert.deepEqual(
      await search({
        grafo: directedLine,
        inicio: 0,
        destino: 259,
        cost: "time",
        trace,
        yieldEvery: 128,
        yieldControl: async () => { batches += 1; },
      }),
      expected,
      name,
    );
    assert.equal(
      await search({ grafo: directedLine, inicio: 259, destino: 0, cost: "time" }),
      null,
      name,
    );
    assert.ok(trace.length > 0, name);
    assert.ok(batches >= 1, name);

    const controller = new AbortController();
    await assert.rejects(
      search({
        grafo: directedLine,
        inicio: 0,
        destino: 259,
        cost: "time",
        signal: controller.signal,
        yieldEvery: 1,
        yieldControl: async () => controller.abort(),
      }),
      (error) => error.name === "AbortError",
      name,
    );
  }
});

test("variantes bidirecionais registram as duas frentes da busca", async () => {
  for (const search of [bidirectionalGreedyBestFirst, bidirectionalBeamSearch]) {
    const trace = [];
    const path = await search({
      grafo: directedLine,
      inicio: 0,
      destino: 259,
      cost: "time",
      trace,
    });
    assert.deepEqual(path, directedLine.nodes.map(({ id }) => id));
    assert.ok(trace.some(({ direction }) => direction === "forward"));
    assert.ok(trace.some(({ direction }) => direction === "backward"));
  }
});
