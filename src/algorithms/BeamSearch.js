import {
  buildBidirectionalAdjacency,
  straightLineLowerBound,
  throwIfCancelled,
} from "./bidirectionalUtils.js";

/**
 * Beam Search por níveis. Em cada profundidade, somente os `beamWidth` nós
 * com menor h(n) continuam para o próximo nível. Assim como no algoritmo
 * clássico, um caminho existente pode ser descartado pelo limite do feixe.
 */
export async function beamSearch({
  grafo,
  inicio,
  destino,
  cost = "distance",
  fallbackSpeedKph = 40,
  beamWidth = 128,
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

  const width = Math.max(1, Math.floor(Number(beamWidth) || 1));
  const batchSize = Math.max(1, Number(yieldEvery) || 1);
  const target = nodes.get(destino);
  const parent = new Map();
  const retained = new Set([inicio]);
  const expanded = new Set();
  let beam = [inicio];
  let processed = 0;
  let order = 0;

  while (beam.length) {
    throwIfCancelled(signal);
    const candidates = new Map();

    for (const current of beam) {
      throwIfCancelled(signal);
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

      expanded.add(current);
      for (const edge of forward.get(current) || []) {
        throwIfCancelled(signal);
        if (expanded.has(edge.node) || retained.has(edge.node) || candidates.has(edge.node)) {
          continue;
        }
        candidates.set(edge.node, {
          node: edge.node,
          parent: current,
          heuristic: straightLineLowerBound(
            nodes.get(edge.node),
            target,
            cost,
            maxSpeedKph,
          ),
          order: order++,
        });
      }

      if (yieldControl && processed % batchSize === 0) {
        await yieldControl();
        throwIfCancelled(signal);
      }
    }

    const selected = [...candidates.values()]
      .sort((first, second) => first.heuristic - second.heuristic || first.order - second.order)
      .slice(0, width);

    beam = selected.map((candidate) => {
      retained.add(candidate.node);
      parent.set(candidate.node, candidate.parent);
      return candidate.node;
    });
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
