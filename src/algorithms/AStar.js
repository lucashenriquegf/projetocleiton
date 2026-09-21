const EARTH_RADIUS_M = 6_371_000;

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

export function aStar({ grafo, inicio, destino }) {
  const nodes = new Map(grafo.nodes.map((node) => [node.id, node]));

  if (!nodes.has(inicio) || !nodes.has(destino)) {
    return null;
  }

  const adjacency = new Map(grafo.nodes.map((node) => [node.id, []]));

  for (const edge of grafo.edges) {
    if (!adjacency.has(edge.from) || !nodes.has(edge.to)) {
      continue;
    }

    const distance = Number(edge.distance_m);

    if (!Number.isFinite(distance) || distance < 0) {
      continue;
    }

    adjacency.get(edge.from).push({
      node: edge.to,
      cost: distance,
    });
  }

  // Equivalente ao dicionário f_score inicializado com infinito no Python.
  const fScore = new Map(grafo.nodes.map((node) => [node.id, Infinity]));
  const gScore = new Map();
  const path = new Map();

  gScore.set(inicio, 0);

  const startHScore = hScore(nodes.get(inicio), nodes.get(destino));
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

    if (node === destino) {
      return reconstructPath(path, inicio, destino);
    }

    for (const neighbor of adjacency.get(node)) {
      const newGScore = gScore.get(node) + neighbor.cost;
      const neighborHScore = hScore(
        nodes.get(neighbor.node),
        nodes.get(destino),
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

function hScore(node, target) {
  const latitude1 = toRadians(node.latitude);
  const latitude2 = toRadians(target.latitude);
  const deltaLatitude = toRadians(target.latitude - node.latitude);
  const deltaLongitude = toRadians(target.longitude - node.longitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;

  return (
    EARTH_RADIUS_M *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
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
