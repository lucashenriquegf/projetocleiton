import assert from "node:assert/strict";
import test from "node:test";

import { bidirectionalAStar } from "../src/algorithms/BidirectionalAStar.js";
import { bidirectionalBfs } from "../src/algorithms/BidirectionalBFS.js";
import { bidirectionalDfs } from "../src/algorithms/BidirectionalDFS.js";
import { bidirectionalDijkstra } from "../src/algorithms/BidirectionalDijkstra.js";
import { dijkstra } from "../src/algorithms/Dijkstra.js";

const variants = [
  ["A*", bidirectionalAStar],
  ["BFS", bidirectionalBfs],
  ["DFS", bidirectionalDfs],
  ["Dijkstra", bidirectionalDijkstra],
];

function pathCost(graph, path, field) {
  if (!path) return Infinity;
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = graph.edges.find(({ from, to }) => from === path[i] && to === path[i + 1]);
    assert.ok(edge, `aresta dirigida ausente: ${path[i]} -> ${path[i + 1]}`);
    total += edge[field];
  }
  return total;
}

test("todas as variantes bidirecionais respeitam mão única e reconstrução", async () => {
  const graph = {
    nodes: [1, 2, 3, 4].map((id) => ({ id, latitude: 0, longitude: id * 0.001 })),
    edges: [
      { from: 1, to: 2, distance_m: 150, travel_time_s: 15 },
      { from: 2, to: 3, distance_m: 150, travel_time_s: 15 },
      { from: 3, to: 4, distance_m: 150, travel_time_s: 15 },
    ],
  };

  for (const [name, search] of variants) {
    const trace = [];
    const path = await search({ grafo: graph, inicio: 1, destino: 4, cost: "time", trace });
    assert.deepEqual(path, [1, 2, 3, 4], name);
    assert.equal(await search({ grafo: graph, inicio: 4, destino: 1, cost: "time" }), null, name);
    assert.deepEqual(await search({ grafo: graph, inicio: 2, destino: 2 }), [2], name);
    assert.equal(await search({ grafo: graph, inicio: 1, destino: 99 }), null, name);
    for (const step of trace) {
      const from = step.from ?? step.de;
      const to = step.to ?? step.para;
      assert.ok(graph.edges.some((edge) => edge.from === from && edge.to === to), name);
    }
  }
});

test("BFS bidirecional minimiza saltos, não distância nem tempo", async () => {
  const graph = {
    nodes: [1, 2, 3, 4].map((id) => ({ id })),
    edges: [
      { from: 1, to: 4, distance_m: 1000, travel_time_s: 100 },
      { from: 1, to: 2, distance_m: 10, travel_time_s: 1 },
      { from: 2, to: 3, distance_m: 10, travel_time_s: 1 },
      { from: 3, to: 4, distance_m: 10, travel_time_s: 1 },
    ],
  };
  assert.deepEqual(await bidirectionalBfs({ grafo: graph, inicio: 1, destino: 4 }), [1, 4]);
});

test("BFS bidirecional mantém o mínimo de saltos em grafos dirigidos", async () => {
  let seed = 19;
  const random = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);

  for (let sample = 0; sample < 40; sample++) {
    const graph = {
      nodes: Array.from({ length: 10 }, (_, id) => ({ id })),
      edges: [],
    };
    for (let from = 0; from < 10; from++) {
      for (let to = 0; to < 10; to++) {
        if (from !== to && random() < 0.3) {
          graph.edges.push({ from, to, distance_m: 1 });
        }
      }
    }

    const queue = [0];
    const depth = new Map([[0, 0]]);
    for (let head = 0; head < queue.length; head++) {
      for (const edge of graph.edges) {
        if (edge.from !== queue[head] || depth.has(edge.to)) continue;
        depth.set(edge.to, depth.get(queue[head]) + 1);
        queue.push(edge.to);
      }
    }

    const path = await bidirectionalBfs({ grafo: graph, inicio: 0, destino: 9 });
    assert.equal(path?.length ?? null, depth.has(9) ? depth.get(9) + 1 : null);
    pathCost(graph, path, "distance_m");
  }
});

test("A* e Dijkstra bidirecionais minimizam o peso escolhido", async () => {
  const graph = {
    nodes: [1, 2, 3].map((id) => ({ id, latitude: 0, longitude: id * 0.0001 })),
    edges: [
      { from: 1, to: 3, distance_m: 100, travel_time_s: 100 },
      { from: 1, to: 2, distance_m: 150, travel_time_s: 10 },
      { from: 2, to: 3, distance_m: 150, travel_time_s: 10 },
    ],
  };

  for (const search of [bidirectionalAStar, bidirectionalDijkstra]) {
    assert.deepEqual(await search({ grafo: graph, inicio: 1, destino: 3, cost: "distance" }), [1, 3]);
    assert.deepEqual(await search({ grafo: graph, inicio: 1, destino: 3, cost: "time" }), [1, 2, 3]);
  }
});

test("A* bidirecional preserva o ótimo se os dados invalidam a heurística", async () => {
  const graph = {
    nodes: [0, 1, 2].map((id) => ({ id, latitude: 0, longitude: id * 0.01 })),
    edges: [
      { from: 0, to: 1, distance_m: 1, travel_time_s: 1 },
      { from: 1, to: 2, distance_m: 1, travel_time_s: 1 },
      { from: 0, to: 2, distance_m: 10, travel_time_s: 10 },
    ],
  };
  assert.deepEqual(
    await bidirectionalAStar({ grafo: graph, inicio: 0, destino: 2, cost: "time" }),
    [0, 1, 2],
  );
});

test("A* e Dijkstra bidirecionais igualam o custo ótimo em grafos dirigidos", async () => {
  let seed = 42;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

  for (let sample = 0; sample < 30; sample++) {
    const graph = {
      nodes: Array.from({ length: 9 }, (_, id) => ({
        id, latitude: 0, longitude: id * 0.0001,
      })),
      edges: [],
    };
    for (let from = 0; from < 9; from++) {
      for (let to = 0; to < 9; to++) {
        if (from === to || random() > 0.35) continue;
        graph.edges.push({
          from, to,
          distance_m: 100 + Math.floor(random() * 200),
          travel_time_s: 10 + Math.floor(random() * 50),
        });
      }
    }

    for (const [cost, field] of [["time", "travel_time_s"], ["distance", "distance_m"]]) {
      const normal = await dijkstra({ grafo: graph, inicio: 0, destino: 8, cost });
      const expected = pathCost(graph, normal, field);
      for (const search of [bidirectionalDijkstra, bidirectionalAStar]) {
        const path = await search({ grafo: graph, inicio: 0, destino: 8, cost });
        assert.equal(pathCost(graph, path, field), expected);
        assert.equal(path?.[0] ?? null, normal?.[0] ?? null);
        assert.equal(path?.at(-1) ?? null, normal?.at(-1) ?? null);
      }
    }
  }
});

test("variantes bidirecionais cedem controle em lotes e aceitam cancelamento", async () => {
  const ids = Array.from({ length: 260 }, (_, id) => id);
  const graph = {
    nodes: ids.map((id) => ({ id, latitude: 0, longitude: id * 0.001 })),
    edges: ids.slice(1).map((id) => ({
      from: id - 1, to: id, distance_m: 112, travel_time_s: 10,
    })),
  };

  for (const [name, search] of variants) {
    let batches = 0;
    const path = await search({
      grafo: graph, inicio: 0, destino: 259, cost: "time",
      yieldEvery: 128,
      yieldControl: async () => { batches += 1; },
    });
    assert.deepEqual(path, ids, name);
    assert.ok(batches >= 1, name);

    const controller = new AbortController();
    await assert.rejects(
      search({
        grafo: graph, inicio: 0, destino: 259, cost: "time",
        signal: controller.signal,
        yieldEvery: 1,
        yieldControl: async () => controller.abort(),
      }),
      (error) => error.name === "AbortError",
      name,
    );
  }
});
