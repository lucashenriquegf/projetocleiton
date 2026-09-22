export async function bfs({
  grafo,
  inicio,
  destino,
  markers,
  velocidade = 40,
  yieldControl = null,
  yieldEvery = 128,
}) {
  const adjacency = new Map();

  for (const node of grafo.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of grafo.edges) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) {
      continue;
    }

    adjacency.get(edge.from).push(edge.to);
  }

  const fila = [inicio];
  let indiceFila = 0;

  const visitados = new Set();
  const anterior = new Map();
  const tamanhoLote = Math.max(1, Number(yieldEvery) || 1);
  let nosNoLote = 0;

  visitados.add(inicio);

  while (indiceFila < fila.length) {
    const atual = fila[indiceFila++];

    if (atual !== inicio && atual !== destino) {
      const marcador = markers.get(atual);

      if (marcador) {
        marcador.setStyle({
          fillColor: "gray",
          color: "gray",
        });
      }
    }

    if (yieldControl) {
      nosNoLote += 1;
      if (nosNoLote === tamanhoLote) {
        await yieldControl();
        nosNoLote = 0;
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, velocidade));
    }

    if (atual === destino) {
      break;
    }

    const vizinhos = adjacency.get(atual) || [];

    for (const vizinho of vizinhos) {
      if (visitados.has(vizinho)) {
        continue;
      }

      visitados.add(vizinho);
      anterior.set(vizinho, atual);
      fila.push(vizinho);
    }
  }

  if (yieldControl && nosNoLote > 0) {
    await yieldControl();
  }

  if (!visitados.has(destino)) {
    return null;
  }

  const caminho = [];

  let atual = destino;

  while (atual !== undefined) {
    caminho.push(atual);

    if (atual === inicio) {
      break;
    }

    atual = anterior.get(atual);
  }

  caminho.reverse();

  return caminho;
}
