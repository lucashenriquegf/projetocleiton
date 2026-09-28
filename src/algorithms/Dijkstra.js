import {
  resolveEdgeDistanceMeters,
  resolveEdgeSpeedKph,
  resolveEdgeTravelTimeSeconds,
} from "./routing.mjs";

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
    const index = this.itens.length - 1;
    vertice._heapIndex = index;
    this.subir(index);
  }

  remover(vertice) {
    const index = Number.isInteger(vertice._heapIndex) && vertice._heapIndex >= 0 && this.itens[vertice._heapIndex] === vertice
      ? vertice._heapIndex
      : this.itens.indexOf(vertice);
    if (index < 0) return;

    vertice._heapIndex = -1;
    const ultimo = this.itens.pop();
    if (index === this.itens.length) return;

    this.itens[index] = ultimo;
    ultimo._heapIndex = index;
    if (index > 0 && this.comparar(this.itens[index], this.itens[this.pai(index)]) < 0) {
      this.subir(index);
    } else {
      this.descer(index);
    }
  }

  retirarPrimeiro() {
    if (!this.itens.length) return null;
    const primeiro = this.itens[0];
    primeiro._heapIndex = -1;
    const ultimo = this.itens.pop();

    if (this.itens.length) {
      this.itens[0] = ultimo;
      ultimo._heapIndex = 0;
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
      const parent = this.itens[parentIndex];
      const current = this.itens[index];
      this.itens[parentIndex] = current;
      this.itens[index] = parent;
      current._heapIndex = parentIndex;
      parent._heapIndex = index;
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

      const current = this.itens[index];
      const next = this.itens[menor];
      this.itens[index] = next;
      this.itens[menor] = current;
      next._heapIndex = index;
      current._heapIndex = menor;
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
  fallbackSpeedKph = 40,
}) {
  const vertices = construirVertices(grafo, cost, { fallbackSpeedKph });
  const origem = vertices.get(inicio);
  const verticeDestino = vertices.get(destino);

  if (!origem || !verticeDestino) return null;

  if (origem === verticeDestino) {
    return [origem.nome];
  }

  await calcularMenorCaminho(origem, verticeDestino, {
    trace,
    onExplore,
    yieldControl,
    yieldEvery: Math.max(1, Number(yieldEvery) || 1),
    signal,
  });

  if (!Number.isFinite(verticeDestino.distanciaMinima)) return null;
  return obterCaminho(verticeDestino).map((vertice) => vertice.nome);
}

async function calcularMenorCaminho(origem, verticeDestino, observacao) {
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

    if (verticeDestino && atual === verticeDestino) {
      break;
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

function construirVertices(grafo, cost, { fallbackSpeedKph = 40 } = {}) {
  const fallback = Number.isFinite(Number(fallbackSpeedKph)) && Number(fallbackSpeedKph) > 0
    ? Number(fallbackSpeedKph)
    : 40;

  const vertices = new Map(
    grafo.nodes.map((node) => [node.id, new Vertice(node.id)]),
  );

  for (const edge of grafo.edges) {
    const origem = vertices.get(edge.from);
    const destino = vertices.get(edge.to);
    if (!origem || !destino) continue;

    const distance = resolveEdgeDistanceMeters(edge, origem, destino);
    if (!Number.isFinite(distance) || distance < 0) continue;

    const speedKph = resolveEdgeSpeedKph(edge, fallback);
    const peso = cost === "time"
      ? resolveEdgeTravelTimeSeconds(edge, distance, speedKph, fallback)
      : distance;
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
