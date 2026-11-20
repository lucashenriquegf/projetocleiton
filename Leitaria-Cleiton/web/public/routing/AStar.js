import {
  coordinateDistanceMeters,
  resolveEdgeDistanceMeters,
  resolveEdgeSpeedKph,
  resolveEdgeTravelTimeSeconds,
} from "./routing.mjs";

const graphCache = new WeakMap();

class PriorityQueue {
  constructor() {
    this.items = [];
  }

  put(item) {
    this.items.push(item);
    let index = this.items.length - 1;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.items[parentIndex];

      if (compareItems(parent, item) <= 0) {
        break;
      }

      this.items[index] = parent;
      index = parentIndex;
    }

    this.items[index] = item;
  }

  get() {
    if (this.items.length === 0) {
      return null;
    }

    const first = this.items[0];
    const last = this.items.pop();

    if (this.items.length > 0) {
      let index = 0;

      while (true) {
        const leftIndex = index * 2 + 1;
        const rightIndex = leftIndex + 1;
        let smallestIndex = index;

        if (
          leftIndex < this.items.length &&
          compareItems(this.items[leftIndex], last) < 0
        ) {
          smallestIndex = leftIndex;
        }

        if (
          rightIndex < this.items.length &&
          compareItems(
            this.items[rightIndex],
            smallestIndex === index ? last : this.items[leftIndex],
          ) < 0
        ) {
          smallestIndex = rightIndex;
        }

        if (smallestIndex === index) {
          break;
        }

        this.items[index] = this.items[smallestIndex];
        index = smallestIndex;
      }

      this.items[index] = last;
    }

    return first;
  }

  empty() {
    return this.items.length === 0;
  }
}

export function aStar({
  grafo,
  inicio,
  destino,
  cost = "distance",
  trace = null,
  fallbackSpeedKph = 40,
}) {
  const search = aStarSearch({ grafo, inicio, destino, cost, trace, fallbackSpeedKph });
  let step = search.next();
  while (!step.done) step = search.next();
  return step.value;
}

export async function aStarWithProgress({
  grafo,
  inicio,
  destino,
  cost = "distance",
  trace = null,
  onExplore = null,
  yieldControl = null,
  yieldEvery = 128,
  signal = null,
  fallbackSpeedKph = 40,
}) {
  const search = aStarSearch({ grafo, inicio, destino, cost, trace, fallbackSpeedKph });
  const batchSize = Math.max(1, Number(yieldEvery) || 1);
  let batchCount = 0;
  throwIfCancelled(signal);
  let step = search.next();

  while (!step.done) {
    throwIfCancelled(signal);
    if (step.value) onExplore?.(step.value);
    batchCount += 1;

    if (batchCount === batchSize) {
      if (yieldControl) {
        await yieldControl();
        throwIfCancelled(signal);
      }
      batchCount = 0;
    }

    step = search.next();
  }

  if (batchCount && yieldControl) {
    await yieldControl();
    throwIfCancelled(signal);
  }

  return step.value;
}

function* aStarSearch({ grafo, inicio, destino, cost, trace, fallbackSpeedKph = 40 }) {
  const { nodes, adjacency, maxSpeedKph } = prepareGraph(grafo, cost, { fallbackSpeedKph });

  if (!nodes.has(inicio) || !nodes.has(destino)) {
    return null;
  }

  const fScore = new Map();
  const gScore = new Map();
  const path = new Map();

  gScore.set(inicio, 0);

  const startHScore = hScore(nodes.get(inicio), nodes.get(destino), cost, maxSpeedKph);
  fScore.set(inicio, startHScore);

  const queue = new PriorityQueue();
  queue.put({
    fScore: startHScore,
    hScore: startHScore,
    node: inicio,
  });

  while (!queue.empty()) {
    const item = queue.get();
    const node = item.node;

    // Uma mesma posição pode entrar mais de uma vez na fila. Ignora entradas
    // antigas quando já foi encontrado um custo melhor para o nó.
    if (item.fScore !== fScore.get(node)) {
      continue;
    }

    const expansion = node === inicio ? null : { from: path.get(node), to: node };
    if (expansion && trace) trace.push(expansion);
    yield expansion;

    if (node === destino) {
      return reconstructPath(path, inicio, destino);
    }

    for (const neighbor of adjacency.get(node)) {
      const newGScore = gScore.get(node) + neighbor.cost;
      const neighborHScore = hScore(
        nodes.get(neighbor.node),
        nodes.get(destino),
        cost,
        maxSpeedKph,
      );
      const newFScore = newGScore + neighborHScore;

      const currentFScore = fScore.get(neighbor.node) ?? Infinity;
      if (newFScore < currentFScore) {
        fScore.set(neighbor.node, newFScore);
        gScore.set(neighbor.node, newGScore);
        queue.put({
          fScore: newFScore,
          hScore: neighborHScore,
          node: neighbor.node,
        });
        path.set(neighbor.node, node);
      }
    }
  }

  return null;
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Cálculo cancelado.");
  error.name = "AbortError";
  throw error;
}

function prepareGraph(grafo, cost, { fallbackSpeedKph = 40 } = {}) {
  const fallback = Number.isFinite(Number(fallbackSpeedKph)) && Number(fallbackSpeedKph) > 0
    ? Number(fallbackSpeedKph)
    : 40;

  if (!graphCache.has(grafo)) graphCache.set(grafo, new Map());
  const cachedByCost = graphCache.get(grafo);
  const cacheKey = `${cost}:${fallback}`;
  if (cachedByCost.has(cacheKey)) return cachedByCost.get(cacheKey);

  const nodes = new Map(grafo.nodes.map((node) => [node.id, node]));
  const adjacency = new Map(grafo.nodes.map((node) => [node.id, []]));
  let maxSpeedKph = fallback;

  for (const edge of grafo.edges) {
    const fromNode = nodes.get(edge.from);
    const toNode = nodes.get(edge.to);
    if (!fromNode || !toNode || !adjacency.has(edge.from)) continue;

    const distance = resolveEdgeDistanceMeters(edge, fromNode, toNode);
    if (!Number.isFinite(distance) || distance < 0) continue;

    const speedKph = resolveEdgeSpeedKph(edge, fallback);
    const travelTime = resolveEdgeTravelTimeSeconds(edge, distance, speedKph, fallback);
    const edgeCost = cost === "time" ? travelTime : distance;
    if (!Number.isFinite(edgeCost) || edgeCost < 0) continue;

    adjacency.get(edge.from).push({ node: edge.to, cost: edgeCost });

    if (Number.isFinite(travelTime) && travelTime > 0 && Number.isFinite(distance) && distance >= 0) {
      const edgeSpeed = (distance / travelTime) * 3.6;
      if (Number.isFinite(edgeSpeed) && edgeSpeed > 0) {
        maxSpeedKph = Math.max(maxSpeedKph, edgeSpeed);
      }
    } else if (Number.isFinite(speedKph) && speedKph > 0) {
      maxSpeedKph = Math.max(maxSpeedKph, speedKph);
    }
  }

  maxSpeedKph = Number.isFinite(maxSpeedKph) && maxSpeedKph > 0 ? maxSpeedKph : fallback;

  const prepared = { nodes, adjacency, maxSpeedKph };
  cachedByCost.set(cacheKey, prepared);
  return prepared;
}

function hScore(node, target, cost, maxSpeedKph) {
  const distanceMeters = coordinateDistanceMeters(
    [node.latitude, node.longitude],
    [target.latitude, target.longitude],
  );

  const safeSpeed = Number.isFinite(maxSpeedKph) && maxSpeedKph > 0 ? maxSpeedKph : 40;

  return cost === "time"
    ? distanceMeters / (safeSpeed / 3.6)
    : distanceMeters;
}

function reconstructPath(path, startNode, targetNode) {
  const finalPath = [targetNode];
  let analysedNode = targetNode;

  while (analysedNode !== startNode) {
    analysedNode = path.get(analysedNode);

    if (analysedNode === undefined) {
      return null;
    }

    finalPath.push(analysedNode);
  }

  return finalPath.reverse();
}

function compareItems(first, second) {
  if (first.fScore !== second.fScore) {
    return first.fScore - second.fScore;
  }

  return first.hScore - second.hScore;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
