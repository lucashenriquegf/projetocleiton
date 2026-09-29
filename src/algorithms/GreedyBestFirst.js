import {
  buildBidirectionalAdjacency,
  MinHeap,
  straightLineLowerBound,
  throwIfCancelled,
} from "./bidirectionalUtils.js";

/**
 * Greedy Best-First Search.
 *
 * A fila é ordenada somente por h(n): a estimativa em linha reta até o
 * destino. O custo já percorrido não participa da prioridade, ao contrário
 * do A*. Por isso esta busca é rápida, mas não garante a rota de menor custo.
 */
export async function greedyBestFirst({
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
  const { nodes, forward, maxSpeedKph } = buildBidirectionalAdjacency(
    grafo,
    { cost, fallbackSpeedKph },
  );

  if (!nodes.has(inicio) || !nodes.has(destino)) return null;
  if (inicio === destino) return [inicio];

  const target = nodes.get(destino);
  const queue = new MinHeap();
  const discovered = new Set([inicio]);
  const parent = new Map();
  const batchSize = Math.max(1, Number(yieldEvery) || 1);
  let processed = 0;

  queue.push({
    node: inicio,
    priority: straightLineLowerBound(nodes.get(inicio), target, cost, maxSpeedKph),
  });

  while (queue.size) {
    throwIfCancelled(signal);
    const current = queue.pop().node;

    if (parent.has(current)) {
      const expansion = {
        from: parent.get(current),
        to: current,
        direction: "forward",
      };
      trace?.push(expansion);
      onExplore?.(expansion);
      throwIfCancelled(signal);
    }

    processed += 1;
    if (current === destino) {
      await yieldRemainder({ yieldControl, processed, batchSize, signal });
      return reconstructPath(parent, inicio, destino);
    }

    for (const edge of forward.get(current) || []) {
      throwIfCancelled(signal);
      if (discovered.has(edge.node)) continue;
      discovered.add(edge.node);
      parent.set(edge.node, current);
      queue.push({
        node: edge.node,
        priority: straightLineLowerBound(nodes.get(edge.node), target, cost, maxSpeedKph),
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

function reconstructPath(parent, start, goal) {
  const path = [goal];
  let current = goal;
  while (current !== start) {
    current = parent.get(current);
    if (current === undefined) return null;
    path.push(current);
  }
  return path.reverse();
}

async function yieldRemainder({ yieldControl, processed, batchSize, signal }) {
  if (yieldControl && processed % batchSize !== 0) {
    await yieldControl();
    throwIfCancelled(signal);
  }
}
