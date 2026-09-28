import {
  buildBidirectionalAdjacency,
  reconstructBidirectionalPath,
  throwIfCancelled,
} from "./bidirectionalUtils.js";

export async function bidirectionalDfs({
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
  const { nodes, forward, backward } = buildBidirectionalAdjacency(grafo, { requireDistance: true });
  if (!nodes.has(inicio) || !nodes.has(destino)) return null;
  if (inicio === destino) return [inicio];

  const fromStart = {
    stack: [{ node: inicio, nextEdge: 0 }], visited: new Set([inicio]),
    parent: new Map(), adjacency: forward, reverse: false,
  };
  const fromGoal = {
    stack: [{ node: destino, nextEdge: 0 }], visited: new Set([destino]),
    parent: new Map(), adjacency: backward, reverse: true,
  };
  const batchSize = Math.max(1, Number(yieldEvery) || 1);
  let discoveries = 0;
  let reported = 0;
  let preferForward = true;
  let meeting = null;

  function advance(side, other) {
    while (side.stack.length) {
      throwIfCancelled(signal);
      const frame = side.stack.at(-1);
      const edges = side.adjacency.get(frame.node);
      if (frame.nextEdge >= edges.length) {
        side.stack.pop();
        continue;
      }

      const next = edges[frame.nextEdge++].node;
      if (side.visited.has(next)) continue;
      side.visited.add(next);
      side.parent.set(next, frame.node);
      side.stack.push({ node: next, nextEdge: 0 });

      const expansion = side.reverse
        ? { de: next, para: frame.node, direction: "backward" }
        : { de: frame.node, para: next, direction: "forward" };
      trace?.push(expansion);
      onExplore?.(expansion);
      discoveries += 1;

      if (other.visited.has(next)) meeting = next;
      return;
    }
  }

  while (fromStart.stack.length && fromGoal.stack.length && meeting === null) {
    throwIfCancelled(signal);
    const side = preferForward ? fromStart : fromGoal;
    advance(side, side === fromStart ? fromGoal : fromStart);
    preferForward = !preferForward;

    if (yieldControl && discoveries - reported >= batchSize) {
      await yieldControl();
      throwIfCancelled(signal);
      reported = discoveries;
    }
  }

  if (yieldControl && discoveries > reported) {
    await yieldControl();
    throwIfCancelled(signal);
  }

  return meeting === null
    ? null
    : reconstructBidirectionalPath(fromStart.parent, fromGoal.parent, meeting, inicio, destino);
}
