import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  initial,
  createTrip,
  register,
  record,
  mutate,
  undo,
  summary,
  validatePlan,
  assignTrip,
  startTrip,
  finishTrip,
} from '../lib/milk/model.ts';
import { seed, route, buildRoutingGraph } from '../public/routing/engine.mjs';
import { findNearestEdge } from '../public/routing/routing.mjs';
const graph = JSON.parse(
  fs.readFileSync(new URL('../public/data/inhumas.json', import.meta.url)),
);
const demo = seed(graph);
const fresh = () =>
  initial(structuredClone(demo.points), structuredClone(demo.base));
test('Gestor atribui; apenas o motorista responsável inicia e finaliza após resolver as paradas', () => {
  let s = fresh();
  const t = s.trips[0];
  assert.throws(() => startTrip(s, t.id, 'd1'), /não iniciada/);
  s = assignTrip(s, t.id);
  assert.equal(s.trips[0].stage, 'assigned');
  assert.equal(s.history.at(-1).actor, 'Gestor');
  assert.throws(
    () => register(s, t.id, t.stops[0].id, 'done', '', 350),
    /Inicie/,
  );
  assert.throws(() => startTrip(s, t.id, 'd2'), /motorista/);
  s = startTrip(s, t.id, 'd1');
  assert.ok(s.trips[0].startedAt);
  assert.throws(() => finishTrip(s, t.id, 'd1'), /todas as coletas/);
  for (const p of t.stops) s = register(s, t.id, p.id, 'failed', 'Sem leite');
  assert.throws(() => finishTrip(s, t.id, 'd2'), /responsável/);
  s = finishTrip(s, t.id, 'd1');
  assert.equal(s.trips[0].stage, 'finished');
  assert.ok(s.trips[0].finishedAt);
  assert.equal(s.history.at(-1).actor, 'Motorista');
});
test('Confirmação manual, motivo, data, correção e histórico reversível', () => {
  let s = fresh(),
    t = s.trips[0],
    p = t.stops[0];
  assert.throws(() => register(s, t.id, p.id, 'done', '', 350), /Inicie/);
  t.stage = 'active';
  assert.throws(() => register(s, t.id, p.id, 'failed'), /por que/);
  s = register(s, t.id, p.id, 'done', '', 350);
  assert.equal(summary(s.trips[0]).liters, 350);
  assert.ok(record(s.trips[0], p.id).at);
  const doneEvent = s.history[0];
  s = register(s, t.id, p.id, 'pending');
  assert.equal(summary(s.trips[0]).pending, 4);
  assert.throws(() => undo(s, doneEvent.id), /mais recente/);
  s = undo(s);
  assert.equal(record(s.trips[0], p.id).status, 'done');
  assert.equal(s.history.length, 3);
  s = register(s, t.id, p.id, 'failed', 'Local fechado');
  assert.equal(record(s.trips[0], p.id).reason, 'Local fechado');
  assert.equal(summary(s.trips[0]).liters, 0);
});
test('Outra viagem começa pendente; editar o cadastro preserva o histórico de locais', () => {
  let s = fresh(),
    t = s.trips[0],
    p = t.stops[0];
  t.stage = 'active';
  s = register(s, t.id, p.id, 'done', '', 350);
  const next = createTrip(demo.base, 'Próxima coleta', '2026-11-06');
  next.stops = structuredClone(s.points.slice(0, 4));
  s = mutate(s, 'trip', next, 'Nova viagem');
  assert.equal(summary(s.trips[1]).done, 0);
  assert.equal(summary(s.trips[0]).done, 1);
  s = mutate(
    s,
    'point',
    { ...s.points[0], name: 'Nome novo' },
    'Editou cadastro',
  );
  assert.equal(s.trips[0].stops[0].name, p.name);
});
test('Capacidade, motorista vinculado e conflito de viagem', () => {
  const s = fresh(),
    t = s.trips[0];
  validatePlan(s, t);
  assert.throws(() => validatePlan(s, { ...t, driverId: 'd2' }), /vinculado/);
  assert.throws(
    () =>
      validatePlan(s, {
        ...t,
        stops: t.stops.map((p) => ({ ...p, liters: 9000 })),
      }),
    /capacidade/,
  );
  s.trips.push({ ...structuredClone(t), id: 'other', stage: 'active' });
  assert.throws(() => validatePlan(s, t), /outra viagem/);
  s.trips.pop();
  t.stage = 'active';
  assert.throws(
    () => register(s, t.id, t.stops[0].id, 'done', '', 7000),
    /capacidade/,
  );
});
test('Percurso real mantém partida/chegada e otimiza sem aumentar o tempo', async () => {
  const s = fresh(),
    t = s.trips[0];
  t.stops = [t.stops[2], t.stops[0], t.stops[3], t.stops[1]];
  const before = JSON.stringify(s),
    normal = await route(graph, t),
    optimized = await route(graph, t, [], true);
  assert.ok(normal.coordinates.length > 20);
  assert.ok(normal.distanceMeters > 1000);
  assert.deepEqual(
    normal.order,
    t.stops.map((p) => p.id),
  );
  assert.deepEqual([...optimized.order].sort(), normal.order.toSorted());
  assert.equal(optimized.attachedStops[0].id, 'origin');
  assert.equal(optimized.attachedStops.at(-1).id, 'destination');
  assert.ok(optimized.travelTimeSeconds <= normal.travelTimeSeconds + 0.01);
  assert.equal(JSON.stringify(s), before);
});
test('Sem cobertura e sem ligação não inventam um trajeto', async () => {
  const t = fresh().trips[0];
  await assert.rejects(
    () =>
      route(graph, {
        ...t,
        stops: [{ ...t.stops[0], latitude: 0, longitude: 0 }],
      }),
    /fora da cobertura/,
  );
  await assert.rejects(() => route({ ...graph, edges: [] }, t), /cobertura/);
});
test('Bloqueio fecha o segmento nos dois sentidos e respeita os sentidos restantes', async () => {
  const t = fresh().trips[0],
    normal = await route(graph, t),
    mid = normal.coordinates[Math.floor(normal.coordinates.length / 2)];
  const e = findNearestEdge(buildRoutingGraph(graph), ...mid),
    block = {
      id: 'b1',
      name: 'Interdição teste',
      latitude: mid[0],
      longitude: mid[1],
      active: true,
    };
  const result = await route(graph, t, [block]);
  for (let i = 1; i < result.nodeIds.length; i++)
    assert.ok(
      !(
        (result.nodeIds[i - 1] === e.from && result.nodeIds[i] === e.to) ||
        (result.nodeIds[i - 1] === e.to && result.nodeIds[i] === e.from)
      ),
    );
  assert.ok(result.coordinates.length > 0);
});
