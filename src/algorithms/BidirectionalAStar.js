import {
  buildBidirectionalAdjacency,
  MinHeap,
  reconstructBidirectionalPath,
  straightLineLowerBound,
  throwIfCancelled,
} from "./bidirectionalUtils.js";

export async function bidirectionalAStar({
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
    grafo, { cost, fallbackSpeedKph },
  );
  if (!nodes.has(inicio) || !nodes.has(destino)) return null;
  if (inicio === destino) return [inicio];

  // Potenciais balanceados: os custos reduzidos acumulados equivalem a
  // gScore + potencial(no) na frente direta e gScore - potencial(no) na reversa
  // (descontadas constantes). São os fScores das duas buscas A*.
  // A soma dos custos de qualquer rota muda pela mesma constante.
  const potential = new Map();
  for (const [id, node] of nodes) {
    const toGoal = straightLineLowerBound(node, nodes.get(destino), cost, maxSpeedKph);
    const fromStart = straightLineLowerBound(nodes.get(inicio), node, cost, maxSpeedKph);
    potential.set(id, (toGoal - fromStart) / 2);
  }

  // Se dados da malha tornarem a heurística inconsistente, a redução poderia
  // criar arestas negativas. Potencial zero mantém a busca correta nesse caso.
  let validPotential = true;
  for (const [from, edges] of forward) {
    for (const edge of edges) {
      if (edge.weight + potential.get(edge.node) - potential.get(from) < 0) {
        validPotential = false;
        break;
      }
    }
    if (!validPotential) break;
  }
  if (!validPotential) {
    for (const id of nodes.keys()) potential.set(id, 0);
  }

  const fromStart = makeFront(inicio, forward, false);
  const fromGoal = makeFront(destino, backward, true);
  const batchSize = Math.max(1, Number(yieldEvery) || 1);
  let processed = 0;
  let bestReducedCost = Infinity;
  let meeting = null;
  let preferForward = true;

  function consider(node) {
    const forwardCost = fromStart.distance.get(node);
    const backwardCost = fromGoal.distance.get(node);
    if (forwardCost === undefined || backwardCost === undefined) return;
    const total = forwardCost + backwardCost;
    if (total < bestReducedCost) {
      bestReducedCost = total;
      meeting = node;
    }
  }

  while (true) {
    throwIfCancelled(signal);
    const first = cleanTop(fromStart);
    const second = cleanTop(fromGoal);
    if (!first || !second || first.priority + second.priority >= bestReducedCost) break;

    const side = first.priority === second.priority
      ? (preferForward ? fromStart : fromGoal)
      : (first.priority < second.priority ? fromStart : fromGoal);
    preferForward = side !== fromStart;
    const current = side.queue.pop();
    side.settled.add(current.node);
    consider(current.node);

    if (side.parent.has(current.node)) {
      const parent = side.parent.get(current.node);
      const expansion = side.reverse
        ? { from: current.node, to: parent }
        : { from: parent, to: current.node };
      trace?.push(expansion);
      onExplore?.(expansion);
    }

    for (const edge of side.adjacency.get(current.node)) {
      throwIfCancelled(signal);
      const reducedWeight = side.reverse
        ? edge.weight + potential.get(current.node) - potential.get(edge.node)
        : edge.weight + potential.get(edge.node) - potential.get(current.node);
      const nextCost = current.distance + reducedWeight;

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
