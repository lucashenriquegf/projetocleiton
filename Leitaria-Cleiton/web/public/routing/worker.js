import { seed, route } from './engine.mjs';
let graph;
self.onmessage = async ({ data }) => {
  try {
    graph ??= await fetch('/data/inhumas.json').then((r) => {
      if (!r.ok) throw Error('Não foi possível carregar o mapa local.');
      return r.json();
    });
    const result =
      data.type === 'seed'
        ? seed(graph)
        : await route(graph, data.trip, data.blocks, data.optimize);
    self.postMessage({ id: data.id, result });
  } catch (e) {
    self.postMessage({
      id: data.id,
      error: e.message || 'Falha no cálculo da rota.',
    });
  }
};
