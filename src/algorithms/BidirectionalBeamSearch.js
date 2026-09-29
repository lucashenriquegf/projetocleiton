import {
  buildBidirectionalAdjacency,
  reconstructBidirectionalPath,
  straightLineLowerBound,
  throwIfCancelled,
} from "./bidirectionalUtils.js";

/**
 * Beam Search bidirecional. Cada direção mantém seu próprio feixe e sua
 * largura máxima; o lote de renderização, por outro lado, é compartilhado
 * pelas duas direções como nos demais modelos bidirecionais.
 */
export async function bidirectionalBeamSearch({
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
  const { nodes, forward, backward, maxSpeedKph } = buildBidirectionalAdjacency(
    grafo,
    { cost, fallbackSpeedKph },
  );

  if (!nodes.has(inicio) || !nodes.has(destino)) return null;
  if (inicio === destino) return [inicio];

  const width = Math.max(1, Math.floor(Number(beamWidth) || 1));
  const batchSize = Math.max(1, Number(yieldEvery) || 1);
  const fromStart = makeFront(inicio, nodes.get(destino), forward, false);
  const fromGoal = makeFront(destino, nodes.get(inicio), backward, true);
  const progress = { processed: 0 };
  let expandForward = true;

  while (fromStart.beam.length || fromGoal.beam.length) {
    throwIfCancelled(signal);
    let side;
    let other;
    if (!fromGoal.beam.length || (expandForward && fromStart.beam.length)) {
      side = fromStart;
      other = fromGoal;
    } else {
      side = fromGoal;
      other = fromStart;
    }
    expandForward = side !== fromStart;

    const meeting = await expandBeamLevel({
      side,
      other,
      nodes,
      cost,
      maxSpeedKph,
      width,
      trace,
      onExplore,
      yieldControl,
      batchSize,
      signal,
      progress,
    });

    if (meeting !== null) {
      await yieldRemainder({
        yieldControl,
        processed: progress.processed,
        batchSize,
        signal,
      });
      return reconstructBidirectionalPath(
        fromStart.parent,
        fromGoal.parent,
        meeting,
        inicio,
        destino,
      );
    }
  }

  await yieldRemainder({
    yieldControl,
    processed: progress.processed,
    batchSize,
    signal,
  });
  return null;
}

async function expandBeamLevel({
  side,
  other,
  nodes,
  cost,
  maxSpeedKph,
  width,
  trace,
  onExplore,
  yieldControl,
  batchSize,
  signal,
  progress,
}) {
  const candidates = new Map();
  let order = 0;

  for (const current of side.beam) {
    throwIfCancelled(signal);
    if (side.parent.has(current)) {
      const parent = side.parent.get(current);
      const expansion = side.reverse
        ? { from: current, to: parent, direction: "backward" }
        : { from: parent, to: current, direction: "forward" };
      trace?.push(expansion);
      onExplore?.(expansion);
      throwIfCancelled(signal);
    }

    progress.processed += 1;
    if (other.retained.has(current)) return current;

    side.expanded.add(current);
    for (const edge of side.adjacency.get(current) || []) {
      throwIfCancelled(signal);
      if (
        side.expanded.has(edge.node) ||
        side.retained.has(edge.node) ||
        candidates.has(edge.node)
      ) {
        continue;
      }
      candidates.set(edge.node, {
        node: edge.node,
        parent: current,
        heuristic: straightLineLowerBound(
          nodes.get(edge.node),
          side.target,
          cost,
          maxSpeedKph,
        ),
        order: order++,
      });
    }

    if (yieldControl && progress.processed % batchSize === 0) {
      await yieldControl();
      throwIfCancelled(signal);
    }
  }

  const selected = [...candidates.values()]
    .sort((first, second) => first.heuristic - second.heuristic || first.order - second.order)
    .slice(0, width);
  side.beam = selected.map((candidate) => {
    side.retained.add(candidate.node);
    side.parent.set(candidate.node, candidate.parent);
    return candidate.node;
  });
  return null;
}

function makeFront(root, target, adjacency, reverse) {
  return {
    beam: [root],
    target,
    adjacency,
    reverse,
    retained: new Set([root]),
    expanded: new Set(),
    parent: new Map(),
  };
}

async function yieldRemainder({ yieldControl, processed, batchSize, signal }) {
  if (yieldControl && processed % batchSize !== 0) {
    await yieldControl();
    throwIfCancelled(signal);
  }
}
