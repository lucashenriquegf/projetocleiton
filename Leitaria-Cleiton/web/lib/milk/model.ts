export type Point = {
  deletedAt?: string;
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  active: boolean;
  liters: number;
};
export type Status = 'pending' | 'done' | 'failed';
export type RecordItem = {
  status: Status;
  reason: string;
  at: string | null;
  liters: number;
};
export type Trip = {
  deletedAt?: string;
  id: string;
  name: string;
  date: string;
  origin: Point;
  destination: Point;
  stops: Point[];
  records: Record<string, RecordItem>;
  driverId: string;
  vehicleId: string;
  stage: 'draft' | 'assigned' | 'active' | 'finished';
  startedAt?: string;
  finishedAt?: string;
  driverName?: string;
  vehiclePlate?: string;
  routeSnapshot?: {
    coordinates: [number, number][];
    distanceMeters: number;
    travelTimeSeconds: number;
    order: string[];
    attachedStops: Point[];
    algorithm: string;
    optimized: boolean;
  };
};
export type Driver = {
  deletedAt?: string;
  id: string;
  name: string;
  phone: string;
  active: boolean;
};
export type Vehicle = {
  id: string;
  plate: string;
  name: string;
  capacity: number;
  active: boolean;
  driverId: string;
};
export type Block = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  active: boolean;
};
export type Event = {
  id: string;
  at: string;
  actor: string;
  label: string;
  target: {
    type: 'point' | 'trip' | 'driver' | 'vehicle' | 'block';
    id: string;
  };
  before: unknown;
  after: unknown;
  undoOf?: string;
};
export type State = {
  version: 2;
  base: Point;
  points: Point[];
  trips: Trip[];
  drivers: Driver[];
  vehicles: Vehicle[];
  blocks: Block[];
  selected: string;
  history: Event[];
  undone: string[];
};
export const KEY = 'leitaria-cleiton.completo.v2';
export function canDeleteTrip(s: State, t: Trip): boolean {
  return (
    !t.deletedAt &&
    (t.stage === 'draft' || t.stage === 'assigned') &&
    !t.startedAt &&
    !t.finishedAt &&
    !Object.values(t.records).some(
      (r) => r.status !== 'pending' || r.at !== null,
    ) &&
    !s.history.some(
      (e) =>
        e.target.type === 'trip' &&
        e.target.id === t.id &&
        [e.before, e.after].some((value) => {
          const trip = value as Partial<Trip> | null;
          return (
            trip?.stage === 'active' ||
            trip?.stage === 'finished' ||
            !!trip?.startedAt
          );
        }),
    )
  );
}
export function deleteEntity(
  s: State,
  type: 'trip' | 'point' | 'driver',
  entityId: string,
): State {
  const at = new Date().toISOString();
  if (type === 'trip') {
    const trip = s.trips.find((t) => t.id === entityId);
    if (!trip || trip.deletedAt) throw Error('Esta viagem já foi excluída.');
    if (!canDeleteTrip(s, trip))
      throw Error('Uma viagem que já foi iniciada não pode ser excluída.');
    const next = mutate(
      s,
      'trip',
      { ...trip, deletedAt: at },
      'Excluiu a viagem · ' + trip.name,
    );
    if (next.selected === entityId)
      next.selected = next.trips.find((t) => !t.deletedAt)?.id || '';
    return next;
  }
  if (type === 'point') {
    const point = s.points.find((p) => p.id === entityId);
    if (!point || point.deletedAt) throw Error('Este local já foi excluído.');
    if (
      s.trips.some(
        (t) =>
          !t.deletedAt &&
          t.stage !== 'finished' &&
          (t.origin.id === entityId ||
            t.destination.id === entityId ||
            t.stops.some((p) => p.id === entityId)),
      )
    )
      throw Error(
        'Este local está em uma viagem ainda não finalizada. Retire-o do planejamento ou exclua a viagem não iniciada antes de excluir o local.',
      );
    return mutate(
      s,
      'point',
      { ...point, active: false, deletedAt: at },
      'Excluiu o local · ' + point.name,
    );
  }
  const driver = s.drivers.find((d) => d.id === entityId);
  if (!driver || driver.deletedAt)
    throw Error('Este motorista já foi excluído.');
  if (
    s.trips.some(
      (t) => !t.deletedAt && t.stage !== 'finished' && t.driverId === entityId,
    )
  )
    throw Error(
      'Este motorista está vinculado a uma viagem ainda não finalizada. Troque o responsável ou exclua a viagem não iniciada primeiro.',
    );
  let next = s;
  for (const vehicle of s.vehicles.filter((v) => v.driverId === entityId))
    next = mutate(
      next,
      'vehicle',
      { ...vehicle, driverId: '' },
      'Encerrou vínculo de ' + driver.name + ' com ' + vehicle.plate,
    );
  return mutate(
    next,
    'driver',
    { ...driver, active: false, deletedAt: at },
    'Excluiu o motorista · ' + driver.name,
  );
}
export const id = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const record = (t: Trip, p: string): RecordItem =>
  t.records[p] || { status: 'pending', reason: '', at: null, liters: 0 };
export const summary = (t: Trip) =>
  t.stops.reduce(
    (s, p) => {
      const r = record(t, p.id);
      s[r.status]++;
      s.total++;
      s.liters += r.status === 'done' ? r.liters : 0;
      return s;
    },
    { total: 0, pending: 0, done: 0, failed: 0, liters: 0 },
  );
export const planKey = (t: Trip, blocks: Block[] = []) =>
  JSON.stringify([
    t.origin,
    t.destination,
    t.stops,
    blocks.filter((b) => b.active),
  ]);
export function createTrip(
  base: Point,
  name = 'Coleta da manhã',
  date = today(),
): Trip {
  return {
    id: id(),
    name,
    date,
    origin: { ...base },
    destination: { ...base },
    stops: [],
    records: {},
    driverId: 'd1',
    vehicleId: 'v1',
    stage: 'draft',
  };
}
export function initial(points: Point[], base: Point): State {
  const t = createTrip(base);
  t.stops = points.slice(0, 4);
  return {
    version: 2,
    base: structuredClone(base),
    points,
    trips: [t],
    selected: t.id,
    drivers: [
      {
        id: 'd1',
        name: 'Carlos Oliveira',
        phone: '(62) 99900-0001',
        active: true,
      },
      { id: 'd2', name: 'Ana Souza', phone: '(62) 99900-0002', active: true },
    ],
    vehicles: [
      {
        id: 'v1',
        plate: 'LEI1A23',
        name: 'Caminhão-tanque 01',
        capacity: 6000,
        active: true,
        driverId: 'd1',
      },
      {
        id: 'v2',
        plate: 'LEI2B34',
        name: 'Caminhão-tanque 02',
        capacity: 4500,
        active: true,
        driverId: 'd2',
      },
    ],
    blocks: [],
    history: [],
    undone: [],
  };
}
const arrayName = {
  point: 'points',
  trip: 'trips',
  driver: 'drivers',
  vehicle: 'vehicles',
  block: 'blocks',
} as const;
export function mutate(
  s: State,
  type: Event['target']['type'],
  value: Point | Trip | Driver | Vehicle | Block,
  label: string,
  actor = 'Gestor',
): State {
  const next = structuredClone(s),
    array = next[arrayName[type]] as { id: string }[];
  const index = array.findIndex((p) => p.id === value.id),
    before = index < 0 ? null : structuredClone(array[index]);
  if (JSON.stringify(before) === JSON.stringify(value)) return s;
  if (index < 0) array.push(structuredClone(value));
  else array[index] = structuredClone(value);
  next.history.push({
    id: id(),
    at: new Date().toISOString(),
    actor,
    label,
    target: { type, id: value.id },
    before,
    after: structuredClone(value),
  });
  return next;
}
export function undo(s: State, eventId?: string): State {
  const e = eventId
    ? s.history.find((e) => e.id === eventId)
    : [...s.history]
        .reverse()
        .find((e) => !e.undoOf && !s.undone.includes(e.id));
  if (!e || e.undoOf || s.undone.includes(e.id)) return s;
  // Only undo the latest change to this entity; restoring an older snapshot could erase newer work.
  if (
    s.history
      .slice(s.history.findIndex((x) => x.id === e.id) + 1)
      .some(
        (x) =>
          x.target.type === e.target.type &&
          x.target.id === e.target.id &&
          !x.undoOf &&
          !s.undone.includes(x.id),
      )
  )
    throw Error('Desfaça primeiro a alteração mais recente deste registro.');
  const next = structuredClone(s),
    array = next[arrayName[e.target.type]] as { id: string }[];
  const index = array.findIndex((p) => p.id === e.target.id),
    current = index < 0 ? null : structuredClone(array[index]);
  if (e.before === null) {
    if (e.target.type === 'trip' && next.trips.length === 1)
      throw Error('Mantenha ao menos uma viagem.');
    if (index >= 0) array.splice(index, 1);
  } else if (index < 0) array.push(structuredClone(e.before) as { id: string });
  else array[index] = structuredClone(e.before) as { id: string };
  if (!next.trips.some((t) => t.id === next.selected))
    next.selected = next.trips[0].id;
  next.undone.push(e.id);
  next.history.push({
    id: id(),
    at: new Date().toISOString(),
    actor: 'Gestor',
    label: `Desfez: ${e.label}`,
    target: e.target,
    before: current,
    after: e.before,
    undoOf: e.id,
  });
  return next;
}
export function register(
  s: State,
  tripId: string,
  pointId: string,
  status: Status,
  reason = '',
  liters = 0,
): State {
  const t = structuredClone(s.trips.find((t) => t.id === tripId));
  if (!t || !t.stops.some((p) => p.id === pointId))
    throw Error('Ponto fora desta viagem.');
  if (t.stage !== 'active')
    throw Error('Inicie a viagem antes de registrar a coleta.');
  if (status === 'failed' && !reason.trim())
    throw Error('Informe por que a coleta não foi realizada.');
  if (status === 'done' && (!Number.isFinite(liters) || liters <= 0))
    throw Error('Informe um volume coletado maior que zero.');
  const vehicle = s.vehicles.find((v) => v.id === t.vehicleId);
  const total =
    t.stops.reduce(
      (v, p) => v + (p.id === pointId ? 0 : record(t, p.id).liters),
      0,
    ) + (status === 'done' ? liters : 0);
  if (vehicle && total > vehicle.capacity)
    throw Error('O volume ultrapassa a capacidade do caminhão.');
  t.records[pointId] = {
    status,
    reason: status === 'failed' ? reason.trim() : '',
    at: status === 'pending' ? null : new Date().toISOString(),
    liters: status === 'done' ? liters : 0,
  };
  return mutate(
    s,
    'trip',
    t,
    `${status === 'done' ? 'Confirmou coleta' : status === 'failed' ? 'Coleta não realizada' : 'Corrigiu para pendente'} · ${t.stops.find((p) => p.id === pointId)?.name}`,
    'Motorista',
  );
}
export function validatePlan(
  s: State,
  t: Trip,
  { checkAvailability = true }: { checkAvailability?: boolean } = {},
) {
  if (!t.stops.length) throw Error('Selecione pelo menos um local.');
  if (t.stops.some((p) => !s.points.find((x) => x.id === p.id)?.active))
    throw Error('Há um local desativado nesta seleção. Revise a rota.');
  const v = s.vehicles.find((v) => v.id === t.vehicleId),
    d = s.drivers.find((d) => d.id === t.driverId);
  if (!v?.active || !d?.active || v.driverId !== d.id)
    throw Error('Selecione um motorista ativo vinculado ao caminhão.');
  if (t.stops.reduce((n, p) => n + p.liters, 0) > v.capacity)
    throw Error('O volume previsto ultrapassa a capacidade do caminhão.');
  if (
    checkAvailability &&
    s.trips.some(
      (x) =>
        x.id !== t.id &&
        x.stage === 'active' &&
        (x.driverId === t.driverId || x.vehicleId === t.vehicleId),
    )
  )
    throw Error(
      'O motorista ou caminhão já está em outra viagem em andamento.',
    );
}
export function assignTrip(
  s: State,
  tripId: string,
  routeSnapshot?: Trip['routeSnapshot'],
): State {
  const t = s.trips.find((t) => t.id === tripId);
  if (!t || t.deletedAt || t.stage !== 'draft')
    throw Error('Somente viagens em planejamento podem ser atribuídas.');
  validatePlan(s, t, { checkAvailability: false });
  return mutate(
    s,
    'trip',
    {
      ...t,
      stage: 'assigned',
      driverName: s.drivers.find((d) => d.id === t.driverId)?.name,
      vehiclePlate: s.vehicles.find((v) => v.id === t.vehicleId)?.plate,
      routeSnapshot: routeSnapshot ? structuredClone(routeSnapshot) : undefined,
    },
    'Atribuiu a rota ao motorista',
    'Gestor',
  );
}
export function startTrip(s: State, tripId: string, driverId: string): State {
  const t = s.trips.find((t) => t.id === tripId);
  if (!t || t.deletedAt || t.driverId !== driverId || t.stage !== 'assigned')
    throw Error('Selecione uma rota não iniciada atribuída a este motorista.');
  validatePlan(s, t);
  return mutate(
    s,
    'trip',
    { ...t, stage: 'active', startedAt: new Date().toISOString() },
    'Iniciou a viagem',
    'Motorista',
  );
}
export function finishTrip(
  s: State,
  tripId: string,
  driverId: string,
  routeSnapshot?: Trip['routeSnapshot'],
): State {
  const t = s.trips.find((t) => t.id === tripId);
  if (!t || t.driverId !== driverId || t.stage !== 'active')
    throw Error(
      'Somente o motorista responsável pode finalizar sua viagem em andamento.',
    );
  if (summary(t).pending)
    throw Error('Registre o resultado de todas as coletas antes de finalizar.');
  return mutate(
    s,
    'trip',
    {
      ...t,
      stage: 'finished',
      finishedAt: new Date().toISOString(),
      driverName: s.drivers.find((d) => d.id === driverId)?.name,
      vehiclePlate: s.vehicles.find((v) => v.id === t.vehicleId)?.plate,
      routeSnapshot: routeSnapshot
        ? structuredClone(routeSnapshot)
        : t.routeSnapshot,
    },
    'Finalizou a viagem',
    'Motorista',
  );
}
