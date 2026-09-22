const EARTH_RADIUS_M = 6_371_000;
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

export function aStar({ grafo, inicio, destino, cost = "distance", trace = null }) {
  const search = aStarSearch({ grafo, inicio, destino, cost, trace });
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
}) {
  const search = aStarSearch({ grafo, inicio, destino, cost, trace });
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

function* aStarSearch({ grafo, inicio, destino, cost, trace }) {
  const { nodes, adjacency, maxSpeedKph } = prepareGraph(grafo, cost);

  if (!nodes.has(inicio) || !nodes.has(destino)) {
    return null;
  }

  // Equivalente ao dicionário f_score inicializado com infinito no Python.
  const fScore = new Map(grafo.nodes.map((node) => [node.id, Infinity]));
  const gScore = new Map();
  const path = new Map();

  gScore.set(inicio, 0);

  const startHScore = hScore(nodes.get(inicio), nodes.get(destino), cost, maxSpeedKph);
  fScore.set(inicio, startHScore);

  const queue = new PriorityQueue();
  queue.put({
    fScore: fScore.get(inicio),
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

      if (newFScore < fScore.get(neighbor.node)) {
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

function prepareGraph(grafo, cost) {
  if (!graphCache.has(grafo)) graphCache.set(grafo, new Map());
  const cachedByCost = graphCache.get(grafo);
  if (cachedByCost.has(cost)) return cachedByCost.get(cost);

  const nodes = new Map(grafo.nodes.map((node) => [node.id, node]));
  const adjacency = new Map(grafo.nodes.map((node) => [node.id, []]));
  let maxSpeedKph = 1;

  for (const edge of grafo.edges) {
    if (!adjacency.has(edge.from) || !nodes.has(edge.to)) continue;

    const distance = Number(edge.distance_m);
    const travelTime = Number(edge.travel_time_s ?? edge.travel_time);
    const edgeCost = cost === "time" ? travelTime : distance;
    if (!Number.isFinite(edgeCost) || edgeCost < 0) continue;

    adjacency.get(edge.from).push({ node: edge.to, cost: edgeCost });

    if (cost === "time" && travelTime > 0 && distance >= 0) {
      maxSpeedKph = Math.max(maxSpeedKph, (distance / travelTime) * 3.6);
    }
  }

  const prepared = { nodes, adjacency, maxSpeedKph };
  cachedByCost.set(cost, prepared);
  return prepared;
}

function hScore(node, target, cost, maxSpeedKph) {
  const latitude1 = toRadians(node.latitude);
  const latitude2 = toRadians(target.latitude);
  const deltaLatitude = toRadians(target.latitude - node.latitude);
  const deltaLongitude = toRadians(target.longitude - node.longitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;

  const distanceMeters = (
    EARTH_RADIUS_M *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );

  return cost === "time"
    ? distanceMeters / (maxSpeedKph / 3.6)
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
