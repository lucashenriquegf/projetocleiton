import { aStar } from './AStar.js';
import { optimizeStopOrderIls } from './StopOrderILS.js';
import {
  buildRoutingGraph,
  findNearestNode,
  findNearestEdge,
  connectStopsToGraph,
  buildPathResult,
  assembleMultiStopRoute,
  buildStopTravelTimeMatrix,
} from './routing.mjs';
export { buildRoutingGraph };
export function seed(graph) {
  const rg = buildRoutingGraph(graph),
    coords = [
      [-16.36, -49.51],
      [-16.345, -49.52],
      [-16.33, -49.505],
      [-16.345, -49.48],
      [-16.375, -49.475],
      [-16.395, -49.51],
    ];
  const names = [
    'Fazenda Boa Vista',
    'Sítio das Palmeiras',
    'Fazenda Santa Clara',
    'Sítio Água Limpa',
    'Fazenda São Bento',
    'Sítio Recanto Verde',
  ];
  const points = coords.map(([lat, lng], i) => {
    const n = findNearestNode(rg, lat, lng);
    const e = findNearestEdge(rg, n.latitude, n.longitude);
    return {
      id: 'p' + i,
      name: names[i],
      address: String(e?.roadName || 'Acesso rural · Inhumas/GO'),
      latitude: n.latitude,
      longitude: n.longitude,
      active: true,
      liters: 350 + i * 80,
    };
  });
  const n = findNearestNode(rg, -16.36, -49.495);
  return {
    points,
    base: {
      id: 'base',
      name: 'Base Leitaria Cleiton',
      address: 'Inhumas/GO',
      latitude: n.latitude,
      longitude: n.longitude,
      active: true,
      liters: 0,
    },
  };
}
export async function route(original, trip, blocks = [], optimize = false) {
  if (!trip.stops.length)
    throw Error('Selecione pelo menos um local de coleta.');
  const originalRg = buildRoutingGraph(original);
  // A blocked map position closes its nearest street segment in both directions.
  const banned = new Set();
  for (const b of blocks.filter((b) => b.active)) {
    const e = findNearestEdge(originalRg, b.latitude, b.longitude);
    if (!e || e.distanceMeters > 400)
      throw Error(`O bloqueio “${b.name}” está fora da cobertura.`);
    banned.add(`${e.from}|${e.to}`);
    banned.add(`${e.to}|${e.from}`);
  }
  const graph = {
    ...original,
    edges: original.edges.filter((e) => !banned.has(`${e.from}|${e.to}`)),
  };
  const rg = buildRoutingGraph(graph),
    visits = [
      { ...trip.origin, id: 'origin', type: 'pickup' },
      ...trip.stops.map((p) => ({ ...p, type: 'pickup' })),
      { ...trip.destination, id: 'destination', type: 'delivery' },
    ];
  for (const p of visits) {
    const e = findNearestEdge(rg, p.latitude, p.longitude);
    if (!e || e.distanceMeters > 400)
      throw Error(
        `“${p.name}” está fora da cobertura de ruas do mapa de Inhumas. Ajuste sua posição.`,
      );
  }
  const attached = connectStopsToGraph(graph, visits),
    ar = buildRoutingGraph(attached.graph);
  let ordered = attached.stops;
  if (optimize) {
    const matrix = await buildStopTravelTimeMatrix(ar, ordered);
    for (const a of ordered)
      for (const b of ordered)
        if (!Number.isFinite(matrix.get(a.nodeId)?.get(b.nodeId)))
          throw Error(
            'Não é possível otimizar: há locais sem ligação viária. Revise pontos e bloqueios.',
          );
    const result = await optimizeStopOrderIls({
      stops: ordered.slice(1, -1),
      travelTimeMatrix: matrix,
      startStop: ordered[0],
      endStop: ordered.at(-1),
      budgetMs: 250,
      maxIterations: 2000,
    });
    ordered = [ordered[0], ...result.stops, ordered.at(-1)];
  }
  const paths = [];
  for (let i = 1; i < ordered.length; i++) {
    const ids = aStar({
      grafo: attached.graph,
      inicio: ordered[i - 1].nodeId,
      destino: ordered[i].nodeId,
      cost: 'time',
    });
    const result = buildPathResult(ar, ids);
    if (!result)
      throw Error(
        `Não existe caminho disponível de “${ordered[i - 1].name}” até “${ordered[i].name}”. Revise pontos, bloqueios ou ordem.`,
      );
    paths.push(result);
  }
  const result = assembleMultiStopRoute(ordered, paths);
  if (result.error) throw Error(result.error);
  return {
    ...result,
    attachedStops: ordered,
    order: ordered.slice(1, -1).map((p) => p.id),
    algorithm: 'A* · menor tempo estimado',
    optimized: optimize,
  };
}
