import {
  buildBidirectionalAdjacency,
  reconstructBidirectionalPath,
  throwIfCancelled,
} from "./bidirectionalUtils.js";

export async function bidirectionalBfs({
  grafo,
  inicio,
  destino,
  trace = null,
  onExplore = null,
  yieldControl = null,
  yieldEvery = 128,
  signal = null,
}) {
  throwIfCancelled(signal);
  const { nodes, forward, backward } = buildBidirectionalAdjacency(grafo);
  if (!nodes.has(inicio) || !nodes.has(destino)) return null;
  if (inicio === destino) return [inicio];

  const fromStart = {
    queue: [inicio], head: 0, depth: new Map([[inicio, 0]]),
    parent: new Map(), adjacency: forward, reverse: false,
  };
  const fromGoal = {
    queue: [destino], head: 0, depth: new Map([[destino, 0]]),
    parent: new Map(), adjacency: backward, reverse: true,
  };
  const batchSize = Math.max(1, Number(yieldEvery) || 1);
  let processed = 0;
  let bestLength = Infinity;
  let meeting = null;
  let preferForward = true;

  async function expandLayer(side, other) {
    const level = side.depth.get(side.queue[side.head]);
    while (side.head < side.queue.length && side.depth.get(side.queue[side.head]) === level) {
      throwIfCancelled(signal);
      const current = side.queue[side.head++];
      for (const edge of side.adjacency.get(current)) {
        throwIfCancelled(signal);
        const next = edge.node;
        if (side.depth.has(next)) continue;

        side.depth.set(next, level + 1);
        side.parent.set(next, current);
        side.queue.push(next);
        const expansion = side.reverse
          ? { de: next, para: current, direction: "backward" }
          : { de: current, para: next, direction: "forward" };
        trace?.push(expansion);
        onExplore?.(expansion);

        if (other.depth.has(next)) {
          const length = level + 1 + other.depth.get(next);
          if (length < bestLength) {
            bestLength = length;
            meeting = next;
          }
        }
      }

      processed += 1;
      if (yieldControl && processed % batchSize === 0) {
        await yieldControl();
        throwIfCancelled(signal);
      }
    }
  }

  while (fromStart.head < fromStart.queue.length && fromGoal.head < fromGoal.queue.length) {
    throwIfCancelled(signal);
    const forwardDepth = fromStart.depth.get(fromStart.queue[fromStart.head]);
    const backwardDepth = fromGoal.depth.get(fromGoal.queue[fromGoal.head]);
    if (forwardDepth + backwardDepth >= bestLength) break;

    const forwardFrontier = fromStart.queue.length - fromStart.head;
    const backwardFrontier = fromGoal.queue.length - fromGoal.head;
    const side = forwardFrontier === backwardFrontier
      ? (preferForward ? fromStart : fromGoal)
      : (forwardFrontier < backwardFrontier ? fromStart : fromGoal);
    preferForward = side !== fromStart;
    await expandLayer(side, side === fromStart ? fromGoal : fromStart);
  }

  if (yieldControl && processed % batchSize !== 0) {
    await yieldControl();
    throwIfCancelled(signal);
  }

  return meeting === null
    ? null
    : reconstructBidirectionalPath(fromStart.parent, fromGoal.parent, meeting, inicio, destino);
}
