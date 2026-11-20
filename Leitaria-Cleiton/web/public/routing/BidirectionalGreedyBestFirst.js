import {
  buildBidirectionalAdjacency,
  MinHeap,
  reconstructBidirectionalPath,
  straightLineLowerBound,
  throwIfCancelled,
} from "./bidirectionalUtils.js";

/**
 * Greedy Best-First bidirecional. As duas frentes são alternadas e cada uma
 * ordena sua fila somente pela estimativa h(n) até a raiz oposta.
 */
export async function bidirectionalGreedyBestFirst({
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
  const { nodes, forward, backward, maxSpeedKph } = buildBidirectionalAdjacency(
    grafo,
    { cost, fallbackSpeedKph },
  );

  if (!nodes.has(inicio) || !nodes.has(destino)) return null;
  if (inicio === destino) return [inicio];

  const fromStart = makeFront({
    root: inicio,
    target: nodes.get(destino),
    adjacency: forward,
    reverse: false,
    nodes,
    cost,
    maxSpeedKph,
  });
  const fromGoal = makeFront({
    root: destino,
    target: nodes.get(inicio),
    adjacency: backward,
    reverse: true,
    nodes,
    cost,
    maxSpeedKph,
  });
  const batchSize = Math.max(1, Number(yieldEvery) || 1);
  let processed = 0;
  let useForward = true;

  while (fromStart.queue.size || fromGoal.queue.size) {
    throwIfCancelled(signal);
    let side;
    let other;
    if (!fromGoal.queue.size || (useForward && fromStart.queue.size)) {
      side = fromStart;
      other = fromGoal;
    } else {
      side = fromGoal;
      other = fromStart;
    }
    useForward = side !== fromStart;

    const current = side.queue.pop().node;
    if (side.closed.has(current)) continue;
    side.closed.add(current);

    if (side.parent.has(current)) {
      const parent = side.parent.get(current);
      const expansion = side.reverse
        ? { from: current, to: parent, direction: "backward" }
        : { from: parent, to: current, direction: "forward" };
      trace?.push(expansion);
      onExplore?.(expansion);
      throwIfCancelled(signal);
    }

    processed += 1;
    if (other.discovered.has(current)) {
      await yieldRemainder({ yieldControl, processed, batchSize, signal });
      return reconstructBidirectionalPath(
        fromStart.parent,
        fromGoal.parent,
        current,
        inicio,
        destino,
      );
    }

    for (const edge of side.adjacency.get(current) || []) {
      throwIfCancelled(signal);
      if (side.discovered.has(edge.node)) continue;
      side.discovered.add(edge.node);
      side.parent.set(edge.node, current);
      side.queue.push({
        node: edge.node,
        priority: straightLineLowerBound(
          side.nodes.get(edge.node),
          side.target,
          side.cost,
          side.maxSpeedKph,
        ),
      });
    }

    if (yieldControl && processed % batchSize === 0) {
      await yieldControl();
      throwIfCancelled(signal);
    }
  }

  await yieldRemainder({ yieldControl, processed, batchSize, signal });
  return null;
}

function makeFront({ root, target, adjacency, reverse, nodes, cost, maxSpeedKph }) {
  const queue = new MinHeap();
  queue.push({
    node: root,
    priority: straightLineLowerBound(nodes.get(root), target, cost, maxSpeedKph),
  });
  return {
    queue,
    adjacency,
    reverse,
    nodes,
    target,
    cost,
    maxSpeedKph,
    discovered: new Set([root]),
    closed: new Set(),
    parent: new Map(),
  };
}

async function yieldRemainder({ yieldControl, processed, batchSize, signal }) {
  if (yieldControl && processed % batchSize !== 0) {
    await yieldControl();
    throwIfCancelled(signal);
  }
}
