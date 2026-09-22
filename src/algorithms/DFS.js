export async function dfs({
  grafo,
  inicio,
  destino,
  trace = null,
  onExplore = null,
  yieldControl = null,
  yieldEvery = 128,
  signal = null,
}) {
  const adjacency = buildAdjacency(grafo);

  if (!adjacency.has(inicio) || !adjacency.has(destino)) {
    return null;
  }

  const visitados = new Set([inicio]);
  const caminhoAtual = [inicio];
  const resultado = { caminho: null };
  const observacao = createObservation({
    trace,
    onExplore,
    yieldControl,
    yieldEvery,
    signal,
  });

  await buscarPrimeiroCaminho(
    inicio,
    destino,
    visitados,
    caminhoAtual,
    adjacency,
    resultado,
    observacao,
  );

  if (observacao.yieldControl && observacao.expansoes % observacao.yieldEvery !== 0) {
    await observacao.yieldControl();
    throwIfCancelled(observacao.signal);
  }

  return resultado.caminho ? [...resultado.caminho] : null;
}

async function buscarPrimeiroCaminho(
  noAtual,
  destino,
  visitados,
  caminhoAtual,
  adjacency,
  resultado,
  observacao,
) {
  throwIfCancelled(observacao.signal);

  if (noAtual === destino) {
    resultado.caminho = [...caminhoAtual];
    return true;
  }

  for (const aresta of adjacency.get(noAtual)) {
    throwIfCancelled(observacao.signal);
    if (visitados.has(aresta.destino)) continue;

    visitados.add(aresta.destino);
    caminhoAtual.push(aresta.destino);
    await reportExpansion(noAtual, aresta.destino, null, observacao);

    const encontrouDestino = await buscarPrimeiroCaminho(
      aresta.destino,
      destino,
      visitados,
      caminhoAtual,
      adjacency,
      resultado,
      observacao,
    );

    if (encontrouDestino) return true;

    caminhoAtual.pop();
    // O nó permanece visitado: o DFS não testa combinações diferentes.
  }

  return false;
}

async function reportExpansion(de, para, distanciaAtual, observacao) {
  const expansao = distanciaAtual === null
    ? { de, para }
    : { de, para, distanciaAtual };
  observacao.trace?.push(expansao);
  observacao.onExplore?.(expansao);

  observacao.expansoes += 1;
  if (
    observacao.yieldControl &&
    observacao.expansoes % observacao.yieldEvery === 0
  ) {
    await observacao.yieldControl();
    throwIfCancelled(observacao.signal);
  }
}

function createObservation({
  trace,
  onExplore,
  yieldControl,
  yieldEvery,
  signal,
}) {
  return {
    trace,
    onExplore,
    yieldControl,
    yieldEvery: Math.max(1, Number(yieldEvery) || 1),
    signal,
    expansoes: 0,
  };
}

function buildAdjacency(grafo) {
  const adjacency = new Map(grafo.nodes.map((node) => [node.id, []]));

  for (const edge of grafo.edges) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) continue;

    const distance = Number(edge.distance_m);
    if (!Number.isFinite(distance) || distance < 0) continue;

    adjacency.get(edge.from).push({ destino: edge.to });
  }

  return adjacency;
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Cálculo cancelado.");
  error.name = "AbortError";
  throw error;
}
