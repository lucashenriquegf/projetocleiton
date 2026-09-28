import {
  coordinateDistanceMeters,
  resolveEdgeDistanceMeters,
  resolveEdgeSpeedKph,
  resolveEdgeTravelTimeSeconds,
} from "./routing.mjs";

export function buildBidirectionalAdjacency(
  grafo,
  { cost = null, fallbackSpeedKph = 40, requireDistance = false } = {},
) {
  const nodes = new Map(grafo.nodes.map((node) => [node.id, node]));
  const forward = new Map([...nodes.keys()].map((id) => [id, []]));
  const backward = new Map([...nodes.keys()].map((id) => [id, []]));
  const fallback = Number(fallbackSpeedKph) > 0 ? Number(fallbackSpeedKph) : 40;
  let maxSpeedKph = fallback;

  for (const edge of grafo.edges) {
    const fromNode = nodes.get(edge.from);
    const toNode = nodes.get(edge.to);
    if (!fromNode || !toNode) continue;

    let weight = 1;
    if (cost === null && requireDistance) {
      const rawDistance = Array.isArray(edge.distance_m ?? edge.distance)
        ? (edge.distance_m ?? edge.distance)[0]
        : (edge.distance_m ?? edge.distance);
      const distance = Number(rawDistance);
      if (!Number.isFinite(distance) || distance < 0) continue;
    } else if (cost !== null) {
      const distance = resolveEdgeDistanceMeters(edge, fromNode, toNode);
      if (!Number.isFinite(distance) || distance < 0) continue;

      if (cost === "time") {
        const speedKph = resolveEdgeSpeedKph(edge, fallback);
        const travelTime = resolveEdgeTravelTimeSeconds(edge, distance, speedKph, fallback);
        if (!Number.isFinite(travelTime) || travelTime < 0) continue;
        weight = travelTime;

        if (travelTime > 0) {
          maxSpeedKph = Math.max(maxSpeedKph, distance / travelTime * 3.6);
        } else if (distance === 0) {
          maxSpeedKph = Math.max(maxSpeedKph, speedKph);
        }
      } else if (cost === "distance") {
        weight = distance;
      }
    }

    forward.get(edge.from).push({ node: edge.to, weight });
    backward.get(edge.to).push({ node: edge.from, weight });
  }

  return { nodes, forward, backward, maxSpeedKph };
}

export function straightLineLowerBound(fromNode, toNode, cost, maxSpeedKph) {
  if (!fromNode || !toNode) return 0;
  const first = [Number(fromNode.latitude), Number(fromNode.longitude)];
  const second = [Number(toNode.latitude), Number(toNode.longitude)];
  if (![...first, ...second].every(Number.isFinite)) return 0;

  const distance = coordinateDistanceMeters(first, second);
  return cost === "time" ? distance / (maxSpeedKph / 3.6) : distance;
}

export function reconstructBidirectionalPath(forwardParent, backwardNext, meeting, start, goal) {
  const path = [meeting];
  let current = meeting;

  while (current !== start) {
    current = forwardParent.get(current);
    if (current === undefined) return null;
    path.unshift(current);
  }

  current = meeting;
  while (current !== goal) {
    current = backwardNext.get(current);
    if (current === undefined) return null;
    path.push(current);
  }

  return path;
}

export function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Cálculo cancelado.");
  error.name = "AbortError";
  throw error;
}

export class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (items[parent].priority <= item.priority) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = item;
  }

  pop() {
    const items = this.items;
    if (!items.length) return null;
    const first = items[0];
    const last = items.pop();
    if (items.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        if (left >= items.length) break;
        const right = left + 1;
        const child = right < items.length && items[right].priority < items[left].priority
          ? right : left;
        if (items[child].priority >= last.priority) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = last;
    }
    return first;
  }

  peek() {
    return this.items[0] ?? null;
  }

  get size() {
    return this.items.length;
  }
}
