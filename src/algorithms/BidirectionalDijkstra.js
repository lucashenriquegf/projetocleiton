import {
  buildBidirectionalAdjacency,
  MinHeap,
  reconstructBidirectionalPath,
  throwIfCancelled,
} from "./bidirectionalUtils.js";

export async function bidirectionalDijkstra({
  grafo,
  inicio,
  destino,
  cost = "distance",
  fallbackSpeedKph = 40,
  trace = null,
  onExplore = null,
  yieldControl = null,
  yieldEvery = 128,
  signal = null,
}) {
  throwIfCancelled(signal);
  const { nodes, forward, backward } = buildBidirectionalAdjacency(
    grafo, { cost, fallbackSpeedKph },
  );
  if (!nodes.has(inicio) || !nodes.has(destino)) return null;
  if (inicio === destino) return [inicio];

  const fromStart = makeFront(inicio, forward, false);
  const fromGoal = makeFront(destino, backward, true);
  const batchSize = Math.max(1, Number(yieldEvery) || 1);
  let processed = 0;
  let bestCost = Infinity;
  let meeting = null;
  let preferForward = true;

  function consider(node) {
    const forwardCost = fromStart.distance.get(node);
    const backwardCost = fromGoal.distance.get(node);
    if (forwardCost === undefined || backwardCost === undefined) return;
    const total = forwardCost + backwardCost;
    if (total < bestCost) {
      bestCost = total;
      meeting = node;
    }
  }

  while (true) {
    throwIfCancelled(signal);
    const first = cleanTop(fromStart);
    const second = cleanTop(fromGoal);
    if (!first || !second || first.distance + second.distance >= bestCost) break;

    const side = first.distance === second.distance
      ? (preferForward ? fromStart : fromGoal)
      : (first.distance < second.distance ? fromStart : fromGoal);
    preferForward = side !== fromStart;
    const current = side.queue.pop();
    side.settled.add(current.node);
    consider(current.node);

    if (side.parent.has(current.node)) {
      const parent = side.parent.get(current.node);
      const expansion = side.reverse
        ? { de: current.node, para: parent }
        : { de: parent, para: current.node };
      trace?.push(expansion);
      onExplore?.(expansion);
    }

    for (const edge of side.adjacency.get(current.node)) {
      throwIfCancelled(signal);
      const nextCost = current.distance + edge.weight;
      if (nextCost < (side.distance.get(edge.node) ?? Infinity)) {
        side.distance.set(edge.node, nextCost);
        side.parent.set(edge.node, current.node);
        side.queue.push({ node: edge.node, distance: nextCost, priority: nextCost });
        consider(edge.node);
      }
    }

    processed += 1;
    if (yieldControl && processed % batchSize === 0) {
      await yieldControl();
      throwIfCancelled(signal);
    }
  }

  if (yieldControl && processed % batchSize !== 0) {
    await yieldControl();
    throwIfCancelled(signal);
  }

  return meeting === null
    ? null
    : reconstructBidirectionalPath(fromStart.parent, fromGoal.parent, meeting, inicio, destino);
}

function makeFront(root, adjacency, reverse) {
  const queue = new MinHeap();
  queue.push({ node: root, distance: 0, priority: 0 });
  return {
    queue, adjacency, reverse,
    distance: new Map([[root, 0]]),
    parent: new Map(),
    settled: new Set(),
  };
}

function cleanTop(side) {
  while (side.queue.size) {
    const item = side.queue.peek();
    if (!side.settled.has(item.node) && item.distance === side.distance.get(item.node)) {
      return item;
    }
    side.queue.pop();
  }
  return null;
}
