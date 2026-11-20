import fs from 'node:fs';
import { aStar } from '../public/routing/AStar.js';
import { bidirectionalAStar } from '../public/routing/BidirectionalAStar.js';
import { bidirectionalDijkstra } from '../public/routing/BidirectionalDijkstra.js';
import { dijkstra } from '../public/routing/Dijkstra.js';
import {
  buildRoutingGraph,
  findNearestNode,
  buildPathResult,
} from '../public/routing/routing.mjs';
const graph = JSON.parse(
  fs.readFileSync(new URL('../public/data/inhumas.json', import.meta.url)),
);
const routing = buildRoutingGraph(graph);
const coords = [
  [-16.36, -49.51],
  [-16.345, -49.52],
  [-16.33, -49.505],
  [-16.345, -49.48],
  [-16.375, -49.475],
  [-16.395, -49.51],
  [-16.36, -49.495],
];
const ids = coords.map((p) => findNearestNode(routing, ...p).id);
const queries = ids.flatMap((a, i) =>
  ids.slice(i + 1).flatMap((b) => [
    [a, b],
    [b, a],
  ]),
);
const results = [];
let expected = [];
for (const [name, fn] of [
  ['Dijkstra', dijkstra],
  ['A*', aStar],
  ['A* bidirecional', bidirectionalAStar],
  ['Dijkstra bidirecional', bidirectionalDijkstra],
]) {
  const samples = [];
  const costs = [];
  for (let run = 0; run < 4; run++) {
    const start = performance.now();
    for (const [i, [inicio, destino]] of queries.entries()) {
      const path = await fn({ grafo: graph, inicio, destino, cost: 'time' });
      const result = buildPathResult(routing, path);
      if (!result) throw Error('Caminho ausente');
      if (run === 0) costs[i] = result.travelTimeSeconds;
    }
    samples.push(performance.now() - start);
  }
  if (!expected.length) expected = costs;
  const error = Math.max(...costs.map((v, i) => Math.abs(v - expected[i])));
  if (error > 0.01) throw Error(`${name}: custo divergiu ${error}`);
  results.push({
    algorithm: name,
    queries: queries.length,
    coldMs: +samples[0].toFixed(2),
    warmMedianMs: +samples
      .slice(1)
      .sort((a, b) => a - b)[1]
      .toFixed(2),
    maxCostDifferenceSeconds: error,
  });
}
console.log(
  JSON.stringify(
    {
      graph: { nodes: graph.nodes.length, edges: graph.edges.length },
      results,
    },
    null,
    2,
  ),
);
