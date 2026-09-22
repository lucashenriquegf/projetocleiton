class Aresta {
  constructor(destino, peso) {
    this.destino = destino;
    this.peso = peso;
  }
}

class Vertice {
  constructor(nome) {
    this.nome = nome;
    this.rotasSaindo = [];
    this.distanciaMinima = Number.POSITIVE_INFINITY;
    this.predecessor = null;
  }

  adicionarRota(destino, peso) {
    this.rotasSaindo.push(new Aresta(destino, peso));
  }
}

class FilaDePrioridade {
  constructor() {
    this.itens = [];
  }

  adicionar(vertice) {
    this.itens.push(vertice);
    this.subir(this.itens.length - 1);
  }

  remover(vertice) {
    const index = this.itens.indexOf(vertice);
    if (index < 0) return;

    const ultimo = this.itens.pop();
    if (index === this.itens.length) return;

    this.itens[index] = ultimo;
    if (index > 0 && this.comparar(this.itens[index], this.itens[this.pai(index)]) < 0) {
      this.subir(index);
    } else {
      this.descer(index);
    }
  }

  retirarPrimeiro() {
    if (!this.itens.length) return null;
    const primeiro = this.itens[0];
    const ultimo = this.itens.pop();

    if (this.itens.length) {
      this.itens[0] = ultimo;
      this.descer(0);
    }

    return primeiro;
  }

  estaVazia() {
    return this.itens.length === 0;
  }

  subir(indexInicial) {
    let index = indexInicial;
    while (index > 0) {
      const parentIndex = this.pai(index);
      if (this.comparar(this.itens[parentIndex], this.itens[index]) <= 0) break;
      [this.itens[parentIndex], this.itens[index]] = [this.itens[index], this.itens[parentIndex]];
      index = parentIndex;
    }
  }

  descer(indexInicial) {
    let index = indexInicial;

    while (true) {
      const esquerda = index * 2 + 1;
      const direita = esquerda + 1;
      let menor = index;

      if (
        esquerda < this.itens.length &&
        this.comparar(this.itens[esquerda], this.itens[menor]) < 0
      ) {
        menor = esquerda;
      }
      if (
        direita < this.itens.length &&
        this.comparar(this.itens[direita], this.itens[menor]) < 0
      ) {
        menor = direita;
      }
      if (menor === index) break;

      [this.itens[index], this.itens[menor]] = [this.itens[menor], this.itens[index]];
      index = menor;
    }
  }

  pai(index) {
    return Math.floor((index - 1) / 2);
  }

  comparar(primeiro, segundo) {
    return primeiro.distanciaMinima - segundo.distanciaMinima;
  }
}

export async function dijkstra({
  grafo,
  inicio,
  destino,
  cost = "distance",
  trace = null,
  onExplore = null,
  yieldControl = null,
  yieldEvery = 128,
  signal = null,
}) {
  const vertices = construirVertices(grafo, cost);
  const origem = vertices.get(inicio);
  const verticeDestino = vertices.get(destino);

  if (!origem || !verticeDestino) return null;

  await calcularMenorCaminho(origem, {
    trace,
    onExplore,
    yieldControl,
    yieldEvery: Math.max(1, Number(yieldEvery) || 1),
    signal,
  });

  if (!Number.isFinite(verticeDestino.distanciaMinima)) return null;
  return obterCaminho(verticeDestino).map((vertice) => vertice.nome);
}

async function calcularMenorCaminho(origem, observacao) {
  origem.distanciaMinima = 0;
  const filaDePrioridade = new FilaDePrioridade();
  filaDePrioridade.adicionar(origem);
  let expansoes = 0;

  while (!filaDePrioridade.estaVazia()) {
    throwIfCancelled(observacao.signal);
    const atual = filaDePrioridade.retirarPrimeiro();

    if (atual.predecessor) {
      const expansao = { de: atual.predecessor.nome, para: atual.nome };
      observacao.trace?.push(expansao);
      observacao.onExplore?.(expansao);
    }

    expansoes += 1;
    if (
      observacao.yieldControl &&
      expansoes % observacao.yieldEvery === 0
    ) {
      await observacao.yieldControl();
      throwIfCancelled(observacao.signal);
    }

    for (const aresta of atual.rotasSaindo) {
      throwIfCancelled(observacao.signal);
      const vizinho = aresta.destino;
      const distanciaPeloAtual = atual.distanciaMinima + aresta.peso;

      if (distanciaPeloAtual < vizinho.distanciaMinima) {
        filaDePrioridade.remover(vizinho);
        vizinho.distanciaMinima = distanciaPeloAtual;
        vizinho.predecessor = atual;
        filaDePrioridade.adicionar(vizinho);
      }
    }
  }

  if (observacao.yieldControl && expansoes % observacao.yieldEvery !== 0) {
    await observacao.yieldControl();
    throwIfCancelled(observacao.signal);
  }
}

function obterCaminho(destino) {
  const caminho = [];
  for (let vertice = destino; vertice !== null; vertice = vertice.predecessor) {
    caminho.push(vertice);
  }
  caminho.reverse();
  return caminho;
}

function construirVertices(grafo, cost) {
  const vertices = new Map(
    grafo.nodes.map((node) => [node.id, new Vertice(node.id)]),
  );

  for (const edge of grafo.edges) {
    const origem = vertices.get(edge.from);
    const destino = vertices.get(edge.to);
    if (!origem || !destino) continue;

    const peso = cost === "time"
      ? Number(edge.travel_time_s ?? edge.travel_time)
      : Number(edge.distance_m);
    if (!Number.isFinite(peso) || peso < 0) continue;

    origem.adicionarRota(destino, peso);
  }

  return vertices;
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Cálculo cancelado.");
  error.name = "AbortError";
  throw error;
}
