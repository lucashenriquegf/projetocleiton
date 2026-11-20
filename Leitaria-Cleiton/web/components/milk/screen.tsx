'use client';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Download,
  Trash2,
  History,
  Plus,
  Route,
  Truck,
  Undo2,
  X,
} from 'lucide-react';
import { ManagerShell } from '@/components/layout/manager-shell';
import { PersonaShell } from '@/components/layout/persona-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { useMilk, type RoadRoute } from './context';
import { MilkMap } from './map';
import {
  createTrip,
  deleteEntity,
  canDeleteTrip,
  id,
  mutate,
  planKey,
  record,
  register,
  summary,
  today,
  undo,
  validatePlan,
  assignTrip,
  startTrip,
  finishTrip,
  type Point,
  type Trip,
  type Driver,
  type Vehicle,
  type Block,
  type Status,
} from '@/lib/milk/model';

type View =
  | 'home'
  | 'plan'
  | 'tracking'
  | 'registry'
  | 'agenda'
  | 'history'
  | 'settings'
  | 'driver'
  | 'audit';
const labels = {
  pending: 'Pendente',
  done: 'Realizada',
  failed: 'Não realizada',
};
const stageLabels = {
  draft: 'Em planejamento',
  assigned: 'Não iniciada',
  active: 'Em andamento',
  finished: 'Finalizada',
};
const fmt = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const date = (value: string) =>
  new Date(value + 'T12:00:00').toLocaleDateString('pt-BR');
const timestamp = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR') : 'Sem confirmação';
function formText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
const phoneDigits = (value: string) => value.replace(/[^0-9]/g, '');
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="milk-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-white p-5 ${className}`}>
      {children}
    </section>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-labelledby={titleId}
      className="milk-dialog"
    >
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
function DeleteButton({
  type,
  entity,
  onDeleted,
}: {
  type: 'trip' | 'point' | 'driver';
  entity: { id: string; name: string };
  onDeleted?: () => void;
}) {
  const { state, save, notify } = useMilk();
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  const label = { trip: 'viagem', point: 'local', driver: 'motorista' }[type];
  if (type === 'trip') {
    const t = state.trips.find((t) => t.id === entity.id);
    if (!t || !canDeleteTrip(state, t)) return null;
  }
  return (
    <>
      <Button
        variant="destructive"
        size="icon-lg"
        title={`Excluir ${label}`}
        aria-label={`Excluir ${label} ${entity.name}`}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" />
      </Button>
      {open && (
        <Dialog title={`Excluir ${label}?`} onClose={() => setOpen(false)}>
          <p className="text-sm">
            Deseja excluir <strong>{entity.name}</strong>?
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {type === 'trip'
              ? 'A viagem será retirada das listagens. Viagens já iniciadas não podem ser excluídas.'
              : type === 'driver'
                ? 'O motorista sairá dos cadastros e seu vínculo com o caminhão será encerrado.'
                : 'O local sairá dos cadastros e da seleção de novas viagens.'}{' '}
            As informações de viagens finalizadas e o registro desta exclusão
            serão preservados.
          </p>
          {error && (
            <p role="alert" className="milk-error mt-4">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" size="lg" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={() => {
                try {
                  const next = deleteEntity(state, type, entity.id);
                  save(next);
                  setOpen(false);
                  onDeleted?.();
                  notify(
                    type === 'trip'
                      ? 'Viagem excluída.'
                      : type === 'point'
                        ? 'Local excluído.'
                        : 'Motorista excluído.',
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Excluir {label}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function Badge({ status }: { status: Status }) {
  return (
    <span className={`milk-badge ${status}`}>
      <span aria-hidden="true">
        {status === 'done' ? '✓' : status === 'failed' ? '×' : '○'}
      </span>
      {labels[status]}
    </span>
  );
}
function Stats({ trip }: { trip: Trip }) {
  const s = summary(trip);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        ['Pontos', s.total],
        ['Realizadas', s.done],
        ['Não realizadas', s.failed],
        ['Pendentes', s.pending],
      ].map(([k, v]) => (
        <div key={k} className="rounded-xl border bg-white p-3">
          <p className="text-xs text-muted-foreground">{k}</p>
          <p className="mt-1 text-xl font-semibold">{v}</p>
        </div>
      ))}
    </div>
  );
}
function Legend() {
  return (
    <div
      className="flex flex-wrap gap-3 text-xs text-muted-foreground"
      aria-label="Legenda"
    >
      <span>○ Pendente</span>
      <span className="text-success">● ✓ Realizada</span>
      <span className="text-destructive">● × Não realizada</span>
    </div>
  );
}

export function MilkScreen({ view }: { view: View }) {
  const { state } = useMilk();
  const [driverId, setDriverId] = useState(
    () => state.drivers.find((d) => d.active && !d.deletedAt)?.id || '',
  );
  const [planning, setPlanning] = useState(false);
  return (
    <MilkWorkspace
      key={`${view}:${state.selected}`}
      view={view}
      driverId={driverId}
      setDriverId={setDriverId}
      planning={planning}
      setPlanning={setPlanning}
    />
  );
}
function MilkWorkspace({
  view,
  driverId,
  setDriverId,
  planning,
  setPlanning,
}: {
  view: View;
  planning: boolean;
  setPlanning: (value: boolean) => void;
  driverId: string;
  setDriverId: (id: string) => void;
}) {
  const { state, save, message, notify, calculate } = useMilk();
  const activeDrivers = state.drivers.filter(
    (driver) => driver.active && !driver.deletedAt,
  );
  const availableVehicles = state.vehicles.filter(
    (vehicle) =>
      vehicle.active &&
      activeDrivers.some((driver) => driver.id === vehicle.driverId),
  );
  const vehicleForDriver = (driverId: string) =>
    availableVehicles.find((vehicle) => vehicle.driverId === driverId);
  const driverOptions = activeDrivers.map((driver) => (
    <option key={driver.id} value={driver.id}>
      {driver.name} · {vehicleForDriver(driver.id)?.plate ?? 'sem caminhão'}
    </option>
  ));
  const vehicleOptions = availableVehicles.map((vehicle) => (
    <option key={vehicle.id} value={vehicle.id}>
      {state.drivers.find((driver) => driver.id === vehicle.driverId)?.name} ·{' '}
      {vehicle.plate}
    </option>
  ));
  const activePoints = state.points.filter(
    (point) => point.active && !point.deletedAt,
  );
  const driverTrips = state.trips.filter(
    (t) => !t.deletedAt && t.driverId === driverId && t.stage !== 'draft',
  );
  const availableTrips = view === 'driver' ? driverTrips : state.trips;
  const trip =
    availableTrips.find((t) => t.id === state.selected && !t.deletedAt) ||
    availableTrips.find((t) => !t.deletedAt) ||
    state.trips[0];
  const linkedVehicle = vehicleForDriver(trip.driverId);
  const displayedVehicle = trip.stage === 'draft'
    ? linkedVehicle
    : state.vehicles.find((vehicle) => vehicle.id === trip.vehicleId);
  const [route, setRoute] = useState<RoadRoute | null>(null),
    [routeKey, setRouteKey] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState('');
  const [newOpen, setNewOpen] = useState(false),
    [assignmentOpen, setAssignmentOpen] = useState(false),
    [assignmentDriverId, setAssignmentDriverId] = useState(''),
    [transferOpen, setTransferOpen] = useState(false),
    [failure, setFailure] = useState<Point | null>(null),
    [confirmation, setConfirmation] = useState<Point | null>(null),
    [correction, setCorrection] = useState<Point | null>(null);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const key = planKey(trip, state.blocks),
    validRoute = routeKey === key ? route : null;
  const assignmentVehicle = vehicleForDriver(assignmentDriverId);
  const currentKey = useRef(key);
  useLayoutEffect(() => {
    currentKey.current = key;
  }, [key]);
  const request = useRef(0);
  function act(fn: () => void) {
    try {
      setError('');
      fn();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function editTrip(next: Trip, label: string) {
    save(mutate(state, 'trip', next, label));
    notify(label);
  }
  function changePlan(next: Trip, label: string) {
    if (trip.stage !== 'draft')
      throw Error(
        'O planejamento fica bloqueado durante a viagem. Use uma nova viagem para outro planejamento.',
      );
    editTrip(next, label);
  }
  async function generate(optimize = false, announce = true) {
    const token = ++request.current,
      sourceKey = key;
    setBusy(true);
    setError('');
    try {
      const result = await calculate(trip, optimize);
      if (token !== request.current) return;
      if (currentKey.current !== sourceKey) {
        setError(
          'O planejamento mudou durante o cálculo. Clique em Calcular rota novamente.',
        );
        return;
      }
      let next = trip;
      if (optimize) {
        next = {
          ...trip,
          stops: result.order.map((id) => trip.stops.find((p) => p.id === id)!),
        };
        changePlan(next, 'Otimizou a ordem das paradas');
      }
      setRoute(result);
      setRouteKey(planKey(next, state.blocks));
      if (announce)
        notify(
          optimize
            ? 'Ordem otimizada e percurso calculado.'
            : 'Percurso calculado pelas ruas do mapa.',
        );
    } catch (e) {
      if (token === request.current) {
        setRoute(null);
        setError((e as Error).message);
      }
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  const recalculate = useEffectEvent(() => {
    void generate(false, false);
  });
  useEffect(() => {
    if (
      (view !== 'driver' || trip.driverId === driverId) &&
      !trip.deletedAt &&
      trip.stage !== 'draft' &&
      trip.stops.length
    ) {
      const frame = requestAnimationFrame(recalculate);
      return () => cancelAnimationFrame(frame);
    }
  }, [
    view,
    driverId,
    trip.driverId,
    trip.stage,
    trip.stops.length,
    trip.deletedAt,
    key,
  ]);
  function toggle(p: Point) {
    act(() => {
      const present = trip.stops.some((s) => s.id === p.id);
      changePlan(
        {
          ...trip,
          stops: present
            ? trip.stops.filter((s) => s.id !== p.id)
            : [...trip.stops, structuredClone(p)],
        },
        `${present ? 'Removeu' : 'Incluiu'} ${p.name} na rota`,
      );
    });
  }
  function move(index: number, delta: number) {
    act(() => {
      const stops = [...trip.stops];
      [stops[index], stops[index + delta]] = [
        stops[index + delta],
        stops[index],
      ];
      changePlan({ ...trip, stops }, 'Alterou a ordem das paradas');
    });
  }
  function confirm(p: Point, status: Status, reason = '', liters = 0) {
    act(() => {
      if (view !== 'driver' || trip.driverId !== driverId)
        throw Error('Somente o motorista responsável registra as coletas.');
      save(register(state, trip.id, p.id, status, reason, liters));
      notify('Registro salvo no histórico desta viagem.');
      setFailure(null);
      setConfirmation(null);
      setCorrection(null);
    });
  }
  function tripSelect(value: string) {
    save({ ...state, selected: value });
  }
  function openNewTrip() {
    setError('');
    setNewOpen(true);
  }
  const syncDriverTrip = useEffectEvent(() => {
    if (
      view === 'driver' &&
      !driverTrips.some((t) => t.id === state.selected) &&
      driverTrips[0]
    )
      tripSelect(driverTrips[0].id);
  });
  useEffect(() => {
    const frame = requestAnimationFrame(syncDriverTrip);
    return () => cancelAnimationFrame(frame);
  }, [view, driverId, state.selected, state.trips]);
  const shell = (content: ReactNode) =>
    view === 'driver' ? (
      <PersonaShell persona="driver">{content}</PersonaShell>
    ) : (
      <ManagerShell>{content}</ManagerShell>
    );
  const notices = (
    <>
      {message && (
        <output className="milk-notice block">
          {message}
          <button aria-label="Fechar aviso" onClick={() => notify('')}>
            ×
          </button>
        </output>
      )}
      {error &&
        view !== 'home' &&
        view !== 'driver' &&
        !(view === 'plan' && planning) && (
          <div className="milk-error" role="alert">
            {error}
          </div>
        )}
    </>
  );
  const routeInfo = (
    <div className="rounded-xl border bg-subtle p-3 text-sm">
      {error && view !== 'driver' && (
        <p className="milk-error mb-3" role="alert">
          {error}
        </p>
      )}
      {busy ? (
        <output>Calculando o percurso nas ruas…</output>
      ) : validRoute ? (
        <>
          <strong>{fmt(validRoute.distanceMeters / 1000)} km</strong>
          <span className="mx-2 text-muted-foreground">·</span>
          <strong>
            {Math.ceil(validRoute.travelTimeSeconds / 60)} min de deslocamento
          </strong>
          <p className="mt-1 text-xs text-muted-foreground">
            Tempo estimado, sem trânsito ao vivo e sem o tempo das coletas.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">
          {view === 'driver'
            ? 'Percurso indisponível no momento.'
            : trip.stops.length
              ? 'Calcule a rota após selecionar ou alterar as paradas.'
              : 'Selecione os locais que o caminhão visitará.'}
        </p>
      )}
    </div>
  );
  const tripSelector = (
    <select
      aria-label="Viagem selecionada"
      value={trip.id}
      onChange={(e) => tripSelect(e.target.value)}
      className="milk-input"
    >
      {state.trips
        .filter((t) => !t.deletedAt)
        .map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {date(t.date)}
          </option>
        ))}
    </select>
  );
  function collectionActions(point: Point) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          className="min-h-11 flex-auto"
          size="lg"
          onClick={() => {
            setError('');
            setConfirmation(point);
          }}
        >
          <Check />
          Confirmar coleta
        </Button>
        <Button
          className="min-h-11 flex-auto"
          size="lg"
          variant="outline"
          onClick={() => {
            setError('');
            setFailure(point);
          }}
        >
          <X />
          Não realizada
        </Button>
      </div>
    );
  }
  function stopList(driver = false) {
    return (
      <div className="divide-y">
        {trip.stops.map((p, i) => {
          const r = record(trip, p.id);
          return (
            <article
              key={p.id}
              id={driver ? `parada-${p.id}` : undefined}
              tabIndex={driver ? -1 : undefined}
              data-testid={`stop-${p.id}`}
              className={`py-4 ${selected === p.id ? 'bg-primary-soft' : ''}`}
            >
              <div className="flex items-start gap-3">
                <button
                  className="grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold"
                  aria-label={`Ver ${p.name} no mapa`}
                  onClick={() => setSelected(p.id)}
                >
                  {i + 1}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.address}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge status={r.status} />
                    <span className="text-xs text-muted-foreground">
                      {fmt(r.status === 'done' ? r.liters : p.liters)} L{' '}
                      {r.status === 'done' ? 'coletados' : 'previstos'}
                    </span>
                  </div>
                  {r.at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {timestamp(r.at)}
                    </p>
                  )}
                  {r.reason && (
                    <p className="mt-2 text-sm">Motivo: {r.reason}</p>
                  )}
                </div>
                {trip.stage === 'draft' && !driver && (
                  <div className="flex flex-col">
                    <Button
                      size="icon-lg"
                      variant="ghost"
                      disabled={i === 0}
                      aria-label={`Subir ${p.name}`}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-lg"
                      variant="ghost"
                      disabled={i === trip.stops.length - 1}
                      aria-label={`Descer ${p.name}`}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                )}
              </div>
              {trip.stage === 'active' && driver &&
                (r.status === 'pending' ? (
                  collectionActions(p)
                ) : (
                  <Button
                    className="mt-3 min-h-11"
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setError('');
                      setCorrection(p);
                    }}
                  >
                    <Undo2 />
                    Corrigir registro
                  </Button>
                ))}
            </article>
          );
        })}
        {!trip.stops.length && (
          <p className="py-6 text-sm text-muted-foreground">
            Nenhuma parada selecionada.
          </p>
        )}
      </div>
    );
  }

  let content: ReactNode;
  if (view === 'registry') content = <Registry />;
  else if (view === 'audit')
    content = (
      <PageFrame
        eyebrow="Rastreabilidade"
        title="Histórico de alterações"
        description="O registro original permanece visível quando uma operação é desfeita."
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {state.history.length} registros
          </span>
        </div>
        <Card>
          {[...state.history].reverse().map((e) => (
            <article key={e.id} className="border-b py-4 last:border-0">
              <p className="font-medium">
                {e.label}
                {state.undone.includes(e.id) && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (desfeito)
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {timestamp(e.at)} · {e.actor}
              </p>
            </article>
          ))}
          {!state.history.length && (
            <p className="text-muted-foreground">
              As alterações aparecerão aqui.
            </p>
          )}
        </Card>
      </PageFrame>
    );
  else if (
    view === 'history' ||
    view === 'tracking' ||
    (view === 'plan' && !planning)
  )
    content = (
      <TripsOverview
        mode={
          view === 'history'
            ? 'history'
            : view === 'tracking'
              ? 'tracking'
              : 'plan'
        }
        onNew={openNewTrip}
        onEdit={(t) => {
          setPlanning(true);
          tripSelect(t.id);
        }}
      />
    );
  else if (view === 'settings') content = <Settings />;
  else if (view === 'agenda')
    content = (
      <PageFrame
        eyebrow="Operação"
        title="Agenda de viagens"
        description="Cada viagem tem suas próprias paradas e registros de coleta."
        action={
          <Button size="lg" onClick={openNewTrip}>
            <Plus />
            Nova viagem
          </Button>
        }
      >
        <div className="mb-5 flex flex-wrap gap-3">
          <input
            className="milk-input max-w-sm"
            type="search"
            aria-label="Buscar viagem"
            placeholder="Buscar viagem…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="milk-input max-w-xs"
            aria-label="Filtrar situação da viagem"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todas as situações</option>
            {Object.entries(stageLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.trips
            .filter((t) => !t.deletedAt)
            .filter(
              (t) =>
                t.name.toLowerCase().includes(query.toLowerCase()) &&
                (filter === 'all' || t.stage === filter),
            )
            .map((t) => (
              <Card key={t.id}>
                <p className="text-xs font-semibold text-primary">
                  {stageLabels[t.stage]} · {date(t.date)}
                </p>
                <h2 className="mt-2 text-lg font-semibold">{t.name}</h2>
                <DeleteButton type="trip" entity={t} />
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.stops.length} locais ·{' '}
                  {state.drivers.find((d) => d.id === t.driverId)?.name}
                </p>
                <p className="mt-1 text-sm">
                  {summary(t).done} coletas realizadas
                </p>
                <Link
                  href="/rotas"
                  onClick={() => tripSelect(t.id)}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
                >
                  Abrir viagem
                  <ChevronRight className="size-4" />
                </Link>
              </Card>
            ))}
        </div>
        {!state.trips
          .filter((t) => !t.deletedAt)
          .some(
            (t) =>
              t.name.toLowerCase().includes(query.toLowerCase()) &&
              (filter === 'all' || t.stage === filter),
          ) && <Card>Nenhuma viagem corresponde aos filtros.</Card>}
      </PageFrame>
    );
  else if (view === 'driver') {
    const nextStopIndex = trip.stops.findIndex(
      (point) => record(trip, point.id).status === 'pending',
    );
    const nextStop = trip.stops[nextStopIndex];
    content = (
      <>
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Leitaria Cleiton · aplicativo de demonstração
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Minha rota de coleta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A passagem pelo local não confirma a coleta. Registre o resultado em
            cada parada.
          </p>
        </header>
        <div className="mb-5 grid gap-3">
          <Field label="Motorista da demonstração">
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
            >
              {state.drivers
                .filter((d) => d.active)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </Field>
          {driverTrips.length > 0 && (
            <Field label="Viagem atribuída">
              <select
                value={driverTrips.some((t) => t.id === trip.id) ? trip.id : ''}
                onChange={(e) => tripSelect(e.target.value)}
              >
                {driverTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {date(t.date)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {notices}
        {!driverTrips.length ? (
          <Card>
            <Truck className="mb-3 text-primary" />
            <h2 className="font-semibold">
              Nenhuma viagem liberada para este motorista
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O gestor precisa planejar e atribuir uma rota. O início é feito
              pelo motorista.
            </p>
          </Card>
        ) : (
          <>
            <Card className="mb-4">
              <h2 className="font-semibold">{trip.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {stageLabels[trip.stage]} · {date(trip.date)} ·{' '}
                {state.vehicles.find((v) => v.id === trip.vehicleId)?.plate}
              </p>
              {error && !confirmation && !failure && !correction && (
                <p className="milk-error mt-3" role="alert">
                  {error}
                </p>
              )}
              {trip.stage === 'assigned' && (
                <>
                  <Button
                    className="mt-4 min-h-11 w-full"
                    size="lg"
                    disabled={!validRoute || busy}
                    onClick={() =>
                      act(() => {
                        save(startTrip(state, trip.id, driverId));
                        notify('Viagem iniciada pelo motorista.');
                      })
                    }
                  >
                    Iniciar viagem
                  </Button>
                  {busy && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Preparando o percurso para iniciar a viagem.
                    </p>
                  )}
                  {!busy && !validRoute && error && (
                    <Button
                      className="mt-2 min-h-11 w-full"
                      size="lg"
                      variant="outline"
                      onClick={() => void generate()}
                    >
                      Tentar carregar percurso
                    </Button>
                  )}
                </>
              )}
              {trip.stage === 'active' &&
                (nextStop ? (
                  <div className="mt-4 rounded-lg border bg-primary-soft p-3">
                    <h3 className="text-sm font-semibold text-primary">
                      Próxima parada pendente · {nextStopIndex + 1} de{' '}
                      {trip.stops.length}
                    </h3>
                    <p className="mt-1 font-semibold">{nextStop.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {nextStop.address}
                    </p>
                    <a
                      className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
                      href={`#parada-${nextStop.id}`}
                    >
                      Ir para a parada na lista
                    </a>
                  </div>
                ) : (
                  <>
                    <p className="mt-4 text-sm">
                      Todas as paradas têm um resultado registrado.
                    </p>
                    <Button
                      className="mt-3 min-h-11 w-full"
                      size="lg"
                      onClick={() =>
                        act(() => {
                          save(
                            finishTrip(
                              state,
                              trip.id,
                              driverId,
                              validRoute || undefined,
                            ),
                          );
                          notify('Viagem finalizada.');
                        })
                      }
                    >
                      Finalizar viagem
                    </Button>
                  </>
                ))}
            </Card>
            <Stats trip={trip} />
            <div className="mt-4 overflow-hidden rounded-xl border">
              <div className="h-[340px]">
                <MilkMap
                  points={trip.stops}
                  trip={trip}
                  route={validRoute}
                  blocks={state.blocks}
                  selected={selected}
                  onPoint={(p) => setSelected(p.id)}
                />
              </div>
              <div className="bg-white p-3">
                <Legend />
              </div>
            </div>
            <div className="my-4">{routeInfo}</div>
            <Card>
              <h2 className="font-semibold">Paradas na ordem de visita</h2>
              {stopList(true)}
            </Card>
          </>
        )}
      </>
    );
  } else if (view === 'home' && !state.trips.some((t) => !t.deletedAt))
    content = (
      <PageFrame
        title="Nenhuma viagem cadastrada"
        description="Crie uma viagem para planejar as coletas."
      >
        <Link href="/rotas" className="milk-link-button">
          Planejar nova viagem
        </Link>
      </PageFrame>
    );
  else
    content = (
      <div className="flex min-h-[calc(100dvh-70px)] flex-col">
        <header className="shrink-0 border-b bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-.035em]">
                {view === 'plan' ? 'Planejar rota' : 'Mapa das rotas'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Leitaria Cleiton · coleta de leite em Inhumas/GO
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DeleteButton
                type="trip"
                entity={trip}
                onDeleted={() => setPlanning(false)}
              />
              <Link className="milk-link-button" href="/historico">
                <History className="size-4" />
                Histórico
              </Link>
              <Button size="lg" onClick={openNewTrip}>
                <Plus />
                Nova viagem
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(180px,1fr)_auto]">
            {tripSelector}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-primary">
                {stageLabels[trip.stage]}
              </span>
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  act(() => {
                    if (trip.stage !== 'draft')
                      throw Error(
                        'Somente o planejamento pode ser desfeito pelo gestor.',
                      );
                    const e = [...state.history]
                      .reverse()
                      .find(
                        (e) =>
                          e.target.type === 'trip' &&
                          e.target.id === trip.id &&
                          e.actor === 'Gestor' &&
                          !e.undoOf &&
                          !state.undone.includes(e.id),
                      );
                    if (!e)
                      throw Error(
                        'Não há alteração desta viagem para desfazer.',
                      );
                    save(undo(state, e.id));
                    notify('Alteração desfeita e preservada no histórico.');
                  })
                }
              >
                <Undo2 />
                Desfazer
              </Button>
            </div>
          </div>
          {view === 'plan' && trip.stage === 'draft' && (
            <div className="mt-4 max-w-md">
              <Field label="Motorista e caminhão">
                <select
                  value={
                    activeDrivers.some((driver) => driver.id === trip.driverId)
                      ? trip.driverId
                      : ''
                  }
                  onChange={(e) => {
                    const driverId = e.currentTarget.value;
                    act(() =>
                      changePlan(
                        {
                          ...trip,
                          driverId,
                          vehicleId: vehicleForDriver(driverId)?.id ?? '',
                        },
                        'Alterou motorista e caminhão',
                      ),
                    );
                  }}
                >
                  <option value="">Selecione um motorista</option>
                  {driverOptions}
                </select>
              </Field>
              {trip.driverId && !linkedVehicle && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Selecione um motorista com caminhão ativo ou ajuste o vínculo
                  em{' '}
                  <Link href="/cadastros" className="font-semibold text-primary underline">
                    Cadastros → Caminhões e vínculos
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
          <div className="mt-4">
            <Stats trip={trip} />
          </div>
          <div className="mt-3">
            <Legend />
          </div>
        </header>
        {notices}
        <div className="milk-workspace">
          <div className="milk-map-panel">
            <MilkMap
              points={
                view === 'plan'
                  ? state.points.filter((p) => p.active)
                  : trip.stops
              }
              trip={trip}
              route={validRoute}
              blocks={state.blocks}
              selected={selected}
              onPoint={(p) => setSelected(p.id)}
            />
            <div className="absolute left-3 top-3 z-[450] max-w-[calc(100%-70px)] rounded-xl border bg-white p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">
                Viagem selecionada
              </p>
              <p className="mt-1 font-semibold">{trip.name}</p>
              <p className="mt-1 text-xs">
                {date(trip.date)} ·{' '}
                {state.drivers.find((d) => d.id === trip.driverId)?.name}
              </p>
            </div>
          </div>
          <aside
            className="milk-route-panel"
            aria-label="Detalhes e planejamento da rota"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">
                {view === 'plan' ? 'Planejamento' : 'Detalhes da viagem'}
              </h2>
              {view !== 'plan' && trip.stage === 'draft' && (
                <Link
                  className="text-sm font-semibold text-primary underline"
                  href="/rotas"
                >
                  Editar rota
                </Link>
              )}
            </div>
            {view === 'plan' && trip.stage === 'draft' && (
              <>
                <div className="mt-4 grid gap-3">
                  <Endpoint
                    label="Partida"
                    value={trip.origin}
                    onChange={(p) =>
                      act(() =>
                        changePlan(
                          { ...trip, origin: p },
                          'Alterou o ponto de partida',
                        ),
                      )
                    }
                  />
                  <Endpoint
                    label="Chegada"
                    value={trip.destination}
                    onChange={(p) =>
                      act(() =>
                        changePlan(
                          { ...trip, destination: p },
                          'Alterou o ponto de chegada',
                        ),
                      )
                    }
                  />
                </div>
                <div className="mt-5 border-t pt-4">
                  <h3 className="text-sm font-semibold">Locais para visitar</h3>
                  <input
                    className="milk-input mt-3"
                    aria-label="Buscar local"
                    placeholder="Buscar local…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div className="mt-2 max-h-[210px] overflow-y-auto">
                    {activePoints
                      .filter(
                        (p) =>
                          p.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((p) => (
                        <label
                          key={p.id}
                          className="flex min-h-12 cursor-pointer items-center gap-3 border-b py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={trip.stops.some((s) => s.id === p.id)}
                            onChange={() => toggle(p)}
                          />
                          <span className="flex-1">{p.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {fmt(p.liters)} L
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              </>
            )}
            <div className="mt-4">{routeInfo}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="lg"
                disabled={busy || !trip.stops.length}
                onClick={() => void generate()}
              >
                <Route />
                Calcular rota
              </Button>
              {trip.stage === 'draft' && (
                <Button
                  size="lg"
                  variant="outline"
                  disabled={busy || trip.stops.length < 2}
                  onClick={() => void generate(true)}
                >
                  Otimizar ordem
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Volume previsto:{' '}
              {fmt(trip.stops.reduce((n, p) => n + p.liters, 0))} L ·{' '}
              {displayedVehicle
                ? `Capacidade do caminhão: ${fmt(displayedVehicle.capacity)} L`
                : 'Sem caminhão selecionado'}
            </p>
            {trip.stage === 'active' && (
              <Button
                className="mt-3"
                variant="outline"
                size="lg"
                onClick={() => {
                  setError('');
                  setTransferOpen(true);
                }}
              >
                Trocar responsável e caminhão
              </Button>
            )}
            <h3 className="mt-5 border-t pt-4 text-sm font-semibold">
              Paradas na ordem de visita
            </h3>
            {stopList()}
            {trip.stage === 'draft' && (
              <Button
                className="mt-4 h-auto min-h-9 w-full whitespace-normal py-2"
                size="lg"
                onClick={() => {
                  setError('');
                  setAssignmentDriverId('');
                  setAssignmentOpen(true);
                }}
              >
                <Truck />
                Escolher motorista e atribuir rota
              </Button>
            )}
            {trip.stage !== 'draft' && (
              <p className="mt-4 rounded-xl bg-primary-soft p-3 text-sm">
                {stageLabels[trip.stage]} · O motorista é responsável por
                iniciar, registrar coletas e finalizar a viagem.
              </p>
            )}
            {view === 'plan' && (
              <Button
                className="mt-3"
                variant="outline"
                size="lg"
                onClick={() => setPlanning(false)}
              >
                Voltar às viagens
              </Button>
            )}
            <details className="mt-5 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Sobre o percurso</summary>
              <p className="mt-2 leading-5">
                A* do repositório projetocleiton, com custo de tempo estimado
                nas vias. A otimização da ordem usa ILS com partida e chegada
                fixas; é uma melhoria heurística, sem garantia do melhor
                circuito global. Tracejado indica acesso aproximado do local até
                a rua. Bloqueios fecham o segmento mais próximo. Não há trânsito
                nem posição GPS ao vivo.
              </p>
            </details>
          </aside>
        </div>
      </div>
    );
  return shell(
    <>
      {view !== 'home' &&
        (view !== 'plan' || !planning) &&
        view !== 'driver' &&
        notices}
      {content}
      {assignmentOpen && (
        <Dialog
          title="Atribuir rota a um motorista"
          onClose={() => setAssignmentOpen(false)}
        >
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => {
                if (!assignmentVehicle || !validRoute || busy) return;
                const next =
                  trip.driverId === assignmentDriverId &&
                  trip.vehicleId === assignmentVehicle.id
                    ? state
                    : mutate(
                        state,
                        'trip',
                        {
                          ...trip,
                          driverId: assignmentDriverId,
                          vehicleId: assignmentVehicle.id,
                        },
                        'Definiu o motorista e o caminhão da rota',
                      );
                save(assignTrip(next, trip.id, validRoute));
                setAssignmentOpen(false);
                setPlanning(false);
                const driver = activeDrivers.find(
                  (person) => person.id === assignmentDriverId,
                );
                notify(
                  `Rota atribuída a ${driver?.name} · ${assignmentVehicle.plate}.`,
                );
              });
            }}
          >
            <p className="text-sm">
              <strong>{trip.name}</strong> · {date(trip.date)}
            </p>
            <Field label="Quem vai fazer esta rota?">
              <select
                required
                value={assignmentDriverId}
                onChange={(e) => {
                  setAssignmentDriverId(e.currentTarget.value);
                  setError('');
                }}
              >
                <option value="">Selecione um motorista</option>
                {driverOptions}
              </select>
            </Field>
            {(!availableVehicles.length ||
              (assignmentDriverId && !assignmentVehicle)) && (
              <p className="text-sm text-muted-foreground">
                O motorista precisa de um caminhão ativo. Ajuste o vínculo em{' '}
                <Link
                  href="/cadastros"
                  className="font-semibold text-primary underline"
                >
                  Cadastros → Caminhões e vínculos
                </Link>
                .
              </p>
            )}
            {error && (
              <p className="milk-error" role="alert">
                {error}
              </p>
            )}
            {!trip.stops.length ? (
              <p className="text-sm text-muted-foreground">
                Adicione pelo menos um local de coleta no planejamento.
              </p>
            ) : busy ? (
              <output className="text-sm">Calculando o percurso…</output>
            ) : validRoute ? (
              <p className="text-sm text-muted-foreground">
                Percurso calculado · {fmt(validRoute.distanceMeters / 1000)} km
              </p>
            ) : (
              <Button
                size="lg"
                type="button"
                variant="outline"
                onClick={() => void generate()}
              >
                Calcular percurso
              </Button>
            )}
            <Button
              size="lg"
              type="submit"
              disabled={!assignmentVehicle || !validRoute || busy}
            >
              Confirmar atribuição
            </Button>
          </form>
        </Dialog>
      )}
      {transferOpen && (
        <Dialog
          title="Trocar responsável da viagem"
          onClose={() => setTransferOpen(false)}
        >
          {error && (
            <p className="milk-error mb-4" role="alert">
              {error}
            </p>
          )}
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => {
                const vehicle = state.vehicles.find(
                  (v) => v.id === new FormData(e.currentTarget).get('vehicle'),
                )!;
                const next = {
                  ...trip,
                  vehicleId: vehicle.id,
                  driverId: vehicle.driverId,
                };
                validatePlan(state, next);
                if (summary(next).liters > vehicle.capacity)
                  throw Error(
                    'O leite já coletado ultrapassa a capacidade deste caminhão.',
                  );
                editTrip(next, 'Trocou responsável e caminhão da viagem');
                setTransferOpen(false);
              });
            }}
          >
            <Field label="Novo motorista e caminhão">
              <select name="vehicle" defaultValue={trip.vehicleId}>
                {vehicleOptions}
              </select>
            </Field>
            <p className="text-sm text-muted-foreground">
              As coletas já registradas serão preservadas. A troca ficará no
              histórico.
            </p>
            <Button size="lg" type="submit">
              Salvar responsável
            </Button>
          </form>
        </Dialog>
      )}
      {newOpen && (
        <Dialog title="Nova viagem de coleta" onClose={() => setNewOpen(false)}>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => {
                const f = new FormData(e.currentTarget),
                  t = createTrip(
                    state.base,
                    formText(f, 'name'),
                    formText(f, 'date'),
                  );
                if (!t.name.trim() || !t.date)
                  throw Error('Informe nome e data.');
                const driverId = formText(f, 'driver');
                if (driverId && !activeDrivers.some((driver) => driver.id === driverId))
                  throw Error('Escolha um motorista ativo.');
                const stopIds = new Set(f.getAll('stop'));
                t.stops = structuredClone(
                  activePoints.filter((point) => stopIds.has(point.id)),
                );
                t.vehicleId = vehicleForDriver(driverId)?.id ?? '';
                t.driverId = driverId;
                const next = mutate(
                  state,
                  'trip',
                  t,
                  'Criou a viagem · ' + t.name,
                );
                setPlanning(true);
                save({ ...next, selected: t.id });
                setNewOpen(false);
                notify('Nova viagem criada com todas as coletas pendentes.');
              });
            }}
          >
            {error && (
              <p role="alert" className="milk-error">
                {error}
              </p>
            )}
            <Field label="Nome da viagem">
              <input
                name="name"
                required
                maxLength={80}
                defaultValue="Coleta de leite"
              />
            </Field>
            <Field label="Data">
              <input name="date" type="date" required defaultValue={today()} />
            </Field>
            <Field label="Motorista e caminhão">
              <select name="driver" defaultValue="">
                <option value="">Escolher no planejamento</option>
                {driverOptions}
              </select>
            </Field>
            {!availableVehicles.length && (
              <p className="text-sm text-muted-foreground">
                Vincule um caminhão ativo a um motorista ativo em Cadastros para
                poder atribuir a rota.
              </p>
            )}
            <fieldset className="min-w-0">
              <legend className="text-sm font-semibold">Locais de coleta</legend>
              {activePoints.length ? (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border px-3">
                  {activePoints.map((point) => (
                    <label
                      key={point.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 border-b py-2 text-sm last:border-b-0"
                    >
                      <input type="checkbox" name="stop" value={point.id} />
                      <span className="flex-1">{point.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {fmt(point.liters)} L
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhum local de coleta ativo. Você pode adicioná-lo em Cadastros.
                </p>
              )}
            </fieldset>
            <p className="text-sm text-muted-foreground">
              Você poderá ajustar as paradas e o responsável antes de atribuir a rota.
            </p>
            <Button size="lg" type="submit">
              Criar viagem
            </Button>
          </form>
        </Dialog>
      )}
      {confirmation && (
        <Dialog title="Confirmar coleta" onClose={() => setConfirmation(null)}>
          {error && (
            <p role="alert" className="milk-error mb-4">
              {error}
            </p>
          )}
          <p className="mb-4 text-sm">
            {confirmation.name} · {date(trip.date)}
          </p>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              confirm(
                confirmation,
                'done',
                '',
                Number(new FormData(e.currentTarget).get('liters')),
              );
            }}
          >
            <Field label="Volume coletado (litros)">
              <input
                name="liters"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                required
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Volume previsto para esta parada: {fmt(confirmation.liters)} L.
            </p>
            <Button className="min-h-11" size="lg" type="submit">
              Salvar confirmação
            </Button>
          </form>
        </Dialog>
      )}
      {failure && (
        <Dialog title="Coleta não realizada" onClose={() => setFailure(null)}>
          {error && (
            <p role="alert" className="milk-error mb-4">
              {error}
            </p>
          )}
          <p className="mb-4 text-sm">{failure.name}</p>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              confirm(
                failure,
                'failed',
                formText(new FormData(e.currentTarget), 'reason'),
              );
            }}
          >
            <Field label="Motivo da coleta não realizada">
              <textarea
                name="reason"
                required
                rows={3}
                maxLength={500}
                placeholder="Ex.: local fechado, sem leite disponível…"
              />
            </Field>
            <Button className="min-h-11" size="lg" type="submit">
              Registrar motivo
            </Button>
          </form>
        </Dialog>
      )}
      {correction && (
        <Dialog
          title="Corrigir registro de coleta"
          onClose={() => setCorrection(null)}
        >
          {error && (
            <p role="alert" className="milk-error mb-4">
              {error}
            </p>
          )}
          <p className="text-sm">
            A confirmação de {correction.name} voltará para pendente. O registro
            anterior continuará no histórico.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              className="min-h-11"
              size="lg"
              onClick={() => confirm(correction, 'pending')}
            >
              Voltar para pendente
            </Button>
            <Button
              className="min-h-11"
              size="lg"
              variant="outline"
              onClick={() => setCorrection(null)}
            >
              Cancelar
            </Button>
          </div>
        </Dialog>
      )}
    </>,
  );
}

function Endpoint({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Point;
  onChange: (p: Point) => void;
}) {
  const { state } = useMilk();
  const base = state.base;
  const options = [
    { ...base, id: 'base' },
    ...state.points.filter((p) => p.active),
  ];
  return (
    <Field label={label}>
      <select
        value={
          options.find(
            (p) =>
              p.latitude === value.latitude && p.longitude === value.longitude,
          )?.id || 'custom'
        }
        onChange={(e) => {
          const p = options.find((p) => p.id === e.target.value);
          if (p) onChange(structuredClone(p));
        }}
      >
        {!options.some(
          (p) =>
            p.latitude === value.latitude && p.longitude === value.longitude,
        ) && <option value="custom">{value.name}</option>}
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Registry() {
  const { state, save, notify } = useMilk();
  const [tab, setTab] = useState('points'),
    [query, setQuery] = useState(''),
    [error, setError] = useState('');
  const [edit, setEdit] = useState<Point | Driver | Vehicle | Block | null>(
      null,
    ),
    [position, setPosition] = useState<{
      latitude: number;
      longitude: number;
    } | null>(null);
  const tabs = [
    ['points', 'Locais de coleta'],
    ['drivers', 'Motoristas'],
    ['vehicles', 'Caminhões e vínculos'],
    ['blocks', 'Vias bloqueadas'],
  ];
  function act(fn: () => void) {
    try {
      setError('');
      fn();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function open(value?: Point | Driver | Vehicle | Block) {
    setPosition(
      value && 'latitude' in value
        ? { latitude: value.latitude, longitude: value.longitude }
        : null,
    );
    setEdit(value || ({ id: id(), name: '', active: true } as Point));
  }
  function formSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    act(() => {
      const f = new FormData(e.currentTarget),
        name = formText(f, 'name').trim();
      if (!name) throw Error('Informe o nome.');
      let value: Point | Driver | Vehicle | Block;
      if (tab === 'points' || tab === 'blocks') {
        const lat = Number(f.get('latitude')),
          lng = Number(f.get('longitude'));
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        )
          throw Error('Informe coordenadas válidas.');
        if (tab === 'points') {
          const liters = Number(f.get('liters'));
          if (liters < 0 || !Number.isFinite(liters))
            throw Error('O volume previsto deve ser zero ou positivo.');
          value = {
            id: edit!.id,
            name,
            address: formText(f, 'address').trim(),
            latitude: lat,
            longitude: lng,
            liters,
            active: edit!.active,
          };
        } else
          value = {
            id: edit!.id,
            name,
            latitude: lat,
            longitude: lng,
            active: edit!.active,
          };
      } else if (tab === 'drivers') {
        const phone = formText(f, 'phone');
        if (phone && !/^[0-9]{10,11}$/.test(phone))
          throw Error('Informe o DDD e um telefone de 10 ou 11 dígitos.');
        value = {
          id: edit!.id,
          name,
          phone,
          active: edit!.active,
        };
      } else {
        const driverId = formText(f, 'driverId'),
          capacity = Number(f.get('capacity')),
          plate = formText(f, 'plate').trim().toUpperCase();
        if (!plate || capacity <= 0 || !Number.isFinite(capacity))
          throw Error('Informe placa e capacidade válida.');
        if (
          state.vehicles.some(
            (v) =>
              v.id !== edit!.id &&
              v.plate.replace(/\W/g, '') === plate.replace(/\W/g, ''),
          )
        )
          throw Error('Esta placa já está cadastrada.');
        if (
          driverId &&
          state.vehicles.some(
            (v) => v.id !== edit!.id && v.active && v.driverId === driverId,
          )
        )
          throw Error('Este motorista já está vinculado a outro caminhão.');
        if (
          state.trips.some(
            (t) =>
              t.stage === 'active' &&
              (t.vehicleId === edit!.id || t.driverId === driverId),
          )
        )
          throw Error(
            'Não altere o vínculo ou caminhão durante uma viagem em andamento.',
          );
        value = {
          id: edit!.id,
          name,
          plate,
          capacity,
          driverId,
          active: edit!.active,
        };
      }
      const type = {
        points: 'point',
        drivers: 'driver',
        vehicles: 'vehicle',
        blocks: 'block',
      }[tab] as 'point' | 'driver' | 'vehicle' | 'block';
      save(
        mutate(
          state,
          type,
          value,
          `Salvou ${tabs.find((t) => t[0] === tab)![1].toLowerCase()} · ${name}`,
        ),
      );
      setEdit(null);
      notify(
        'Cadastro salvo. Viagens existentes preservam os dados dos locais usados no planejamento.',
      );
    });
  }
  function toggle(value: Point | Driver | Vehicle | Block) {
    act(() => {
      if (
        !value.active &&
        'driverId' in value &&
        value.driverId &&
        state.vehicles.some(
          (v) => v.id !== value.id && v.active && v.driverId === value.driverId,
        )
      )
        throw Error(
          'Este motorista já está vinculado a outro caminhão ativo. Edite o vínculo antes de reativar.',
        );
      if (
        value.active &&
        state.trips.some(
          (t) =>
            t.stage === 'active' &&
            (tab === 'points'
              ? t.stops.some((p) => p.id === value.id)
              : tab === 'drivers'
                ? t.driverId === value.id
                : tab === 'vehicles'
                  ? t.vehicleId === value.id
                  : false),
        )
      )
        throw Error(
          'Este registro está em uso numa viagem em andamento. Conclua a viagem primeiro.',
        );
      const type = {
        points: 'point',
        drivers: 'driver',
        vehicles: 'vehicle',
        blocks: 'block',
      }[tab] as 'point' | 'driver' | 'vehicle' | 'block';
      save(
        mutate(
          state,
          type,
          { ...value, active: !value.active },
          `${value.active ? 'Desativou' : 'Reativou'} · ${value.name}`,
        ),
      );
      notify('Situação atualizada e registrada no histórico.');
    });
  }
  const items = state[
    tab as 'points' | 'drivers' | 'vehicles' | 'blocks'
  ].filter(
    (p) =>
      !('deletedAt' in p && p.deletedAt) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <PageFrame
      eyebrow="Cadastros"
      title="A base da operação"
      description="Locais, motoristas, caminhões e impedimentos usados no planejamento."
      action={
        <Button size="lg" onClick={() => open()}>
          <Plus />
          Novo cadastro
        </Button>
      }
    >
      <div
        className="mb-5 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Tipos de cadastro"
      >
        {tabs.map(([key, label]) => (
          <Button
            key={key}
            size="lg"
            role="tab"
            aria-selected={tab === key}
            variant={tab === key ? 'default' : 'outline'}
            onClick={() => {
              setTab(key);
              setQuery('');
              setError('');
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {error && (
        <p className="milk-error" role="alert">
          {error}
        </p>
      )}
      <input
        type="search"
        aria-label="Buscar cadastro"
        className="milk-input mb-5 max-w-md"
        placeholder="Buscar por nome…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {tab === 'blocks' && (
        <p className="mb-4 text-sm text-muted-foreground">
          Marque o impedimento no mapa. No protótipo, ele bloqueia o segmento de
          rua mais próximo nos dois sentidos. Recalcule a rota após mudar os
          bloqueios.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{p.name}</h2>
              <span
                className={`text-xs font-semibold ${p.active ? 'text-success' : 'text-muted-foreground'}`}
              >
                {p.active ? 'Ativo' : 'Desativado'}
              </span>
            </div>
            {'address' in p && (
              <p className="mt-3 text-sm text-muted-foreground">
                {p.address} · {fmt(p.liters)} L previstos
              </p>
            )}
            {'phone' in p && (
              <p className="mt-3 text-sm text-muted-foreground">
                {p.phone || 'Sem telefone'}
              </p>
            )}
            {'plate' in p && (
              <>
                <p className="mt-3 text-sm">
                  {p.plate} · {fmt(p.capacity)} L
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {state.drivers.find((d) => d.id === p.driverId)?.name ||
                    'Sem motorista vinculado'}
                </p>
              </>
            )}
            {'latitude' in p && (
              <p className="mt-2 text-xs text-muted-foreground">
                {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="lg" variant="outline" onClick={() => open(p)}>
                Editar
              </Button>
              <Button size="lg" variant="ghost" onClick={() => toggle(p)}>
                {p.active ? 'Desativar' : 'Reativar'}
              </Button>
              {(tab === 'points' || tab === 'drivers') && (
                <DeleteButton
                  type={tab === 'points' ? 'point' : 'driver'}
                  entity={p}
                />
              )}
            </div>
          </Card>
        ))}
      </div>
      {!items.length && <Card>Nenhum cadastro encontrado.</Card>}
      {edit && (
        <Dialog
          title={`Cadastro · ${tabs.find((t) => t[0] === tab)![1]}`}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={formSubmit} className="grid gap-4">
            {error && (
              <p className="milk-error" role="alert">
                {error}
              </p>
            )}
            <Field label="Nome">
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={edit.name}
              />
            </Field>
            {tab === 'points' && (
              <>
                <Field label="Endereço ou referência">
                  <input
                    name="address"
                    required
                    maxLength={200}
                    defaultValue={'address' in edit ? edit.address : ''}
                  />
                </Field>
                <Field label="Volume previsto de leite (L)">
                  <input
                    name="liters"
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    defaultValue={'liters' in edit ? edit.liters : 0}
                  />
                </Field>
              </>
            )}
            {(tab === 'points' || tab === 'blocks') && (
              <>
                {tab === 'blocks' && (
                  <div className="rounded-lg border bg-subtle p-3 text-sm">
                    <p className="font-semibold">Como marcar a via bloqueada</p>
                    <p className="mt-1">
                      Arraste o mapa e use os controles de zoom para encontrar
                      a rua. Clique ou toque sobre o trecho bloqueado. Para
                      mudar a marcação, clique ou toque em outro ponto.
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Ao salvar, o segmento de rua mais próximo será bloqueado
                      nos dois sentidos.
                    </p>
                  </div>
                )}
                <div className="h-[280px] overflow-hidden rounded-xl border">
                  <MilkMap
                    points={
                      position
                        ? [
                            {
                              ...position,
                              id: 'chosen',
                              name: 'Posição escolhida',
                              address: '',
                              liters: 0,
                              active: true,
                            },
                          ]
                        : state.points.filter((p) => !p.deletedAt)
                    }
                    onPick={(latitude, longitude) =>
                      setPosition({ latitude, longitude })
                    }
                  />
                </div>
                {tab === 'blocks' && (
                  <output className="text-sm text-muted-foreground">
                    {position
                      ? 'Ponto marcado. Confira o local antes de salvar.'
                      : 'Nenhum ponto marcado no mapa.'}
                  </output>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Latitude">
                    <input
                      name="latitude"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      required
                      value={position?.latitude ?? ''}
                      onChange={(e) =>
                        setPosition({
                          latitude: Number(e.target.value),
                          longitude: position?.longitude ?? -49.5,
                        })
                      }
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      name="longitude"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      required
                      value={position?.longitude ?? ''}
                      onChange={(e) =>
                        setPosition({
                          longitude: Number(e.target.value),
                          latitude: position?.latitude ?? -16.36,
                        })
                      }
                    />
                  </Field>
                </div>
              </>
            )}
            {tab === 'drivers' && (
              <div>
                <Field label="Telefone com DDD">
                  <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    pattern="[0-9]{10,11}"
                    title="Informe 10 ou 11 dígitos, incluindo o DDD."
                    aria-describedby="driver-phone-help"
                    defaultValue={'phone' in edit ? phoneDigits(edit.phone) : ''}
                    onChange={(e) => {
                      const input = e.currentTarget;
                      input.value = phoneDigits(input.value).slice(0, 11);
                    }}
                  />
                </Field>
                <p id="driver-phone-help" className="mt-1 text-sm text-muted-foreground">
                  Digite apenas números, com 10 dígitos para fixo ou 11 para celular.
                </p>
              </div>
            )}
            {tab === 'vehicles' && (
              <>
                <Field label="Placa">
                  <input
                    name="plate"
                    required
                    maxLength={10}
                    defaultValue={'plate' in edit ? edit.plate : ''}
                  />
                </Field>
                <Field label="Capacidade do tanque (L)">
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    step="1"
                    required
                    defaultValue={'capacity' in edit ? edit.capacity : 6000}
                  />
                </Field>
                <Field label="Motorista vinculado">
                  <select
                    name="driverId"
                    defaultValue={'driverId' in edit ? edit.driverId : ''}
                  >
                    <option value="">Sem vínculo</option>
                    {state.drivers
                      .filter((d) => d.active)
                      .map((d) => (
                        <option value={d.id} key={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <p className="text-xs text-muted-foreground">
                  Cada motorista ativo pode estar vinculado a apenas um
                  caminhão. As trocas ficam no histórico.
                </p>
              </>
            )}
            <Button size="lg" type="submit">
              Salvar cadastro
            </Button>
          </form>
        </Dialog>
      )}
    </PageFrame>
  );
}

function TripsOverview({
  mode,
  onNew,
  onEdit,
}: {
  mode: 'plan' | 'tracking' | 'history';
  onNew: () => void;
  onEdit: (t: Trip) => void;
}) {
  const { state } = useMilk();
  const [detail, setDetail] = useState<Trip | null>(null),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const searchTerm = query.trim().toLowerCase();
  const hasFilters = searchTerm !== '' || filter !== 'all';
  const routes = state.trips
    .filter((t) => !t.deletedAt)
    .filter((t) =>
      mode === 'history'
        ? t.stage === 'finished'
        : mode === 'tracking'
          ? t.stage !== 'draft'
          : t.stage !== 'finished',
    )
    .filter(
      (t) =>
        (filter === 'all' || t.stage === filter) &&
        `${t.name} ${state.drivers.find((d) => d.id === t.driverId)?.name || ''}`
          .toLowerCase()
          .includes(searchTerm),
    );
  function tile(t: Trip) {
    const counts = summary(t);
    return (
      <div key={t.id} className="relative">
        <button
          className="w-full rounded-xl border bg-white p-5 pr-16 text-left transition hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() =>
            mode === 'plan' && t.stage === 'draft' ? onEdit(t) : setDetail(t)
          }
        >
          <span className="text-xs font-semibold text-primary">
            {stageLabels[t.stage]}
          </span>
          <h3 className="mt-2 font-semibold">{t.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {date(t.date)} ·{' '}
            {state.drivers.find((d) => d.id === t.driverId)?.name ||
              'Motorista não informado'}
          </p>
          <p className="mt-2 text-sm">
            {counts.total} locais · {counts.done} realizadas · {counts.failed}{' '}
            não realizadas · {fmt(counts.liters)} L coletados
          </p>
          <span className="mt-4 inline-flex min-h-8 items-center text-sm font-semibold text-primary">
            {mode === 'plan' && t.stage === 'draft'
              ? 'Continuar planejamento'
              : 'Ver detalhes da rota'}
            <ChevronRight className="ml-1 size-4" />
          </span>
        </button>
        <div className="absolute right-3 top-3">
          <DeleteButton type="trip" entity={t} />
        </div>
      </div>
    );
  }
  return (
    <PageFrame
      eyebrow="Leitaria Cleiton"
      title={
        mode === 'plan'
          ? 'Planejar rota'
          : mode === 'tracking'
            ? 'Acompanhar motoristas'
            : 'Histórico de viagens'
      }
      description={
        mode === 'plan'
          ? 'Crie uma viagem para abrir o mapa e planejar as paradas.'
          : mode === 'tracking'
            ? 'Consulte as rotas atribuídas, em andamento e finalizadas de cada motorista.'
            : 'Viagens finalizadas, com motorista, percurso e resultados das coletas.'
      }
      action={
        mode === 'plan' ? (
          <Button size="lg" onClick={onNew}>
            <Plus />
            Criar nova viagem
          </Button>
        ) : undefined
      }
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Buscar rotas ou motoristas"
          className="milk-input max-w-md"
          placeholder="Buscar rota ou motorista…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {mode !== 'history' && (
          <select
            className="milk-input max-w-xs"
            aria-label="Situação da rota"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todas as situações</option>
            {(mode === 'plan'
              ? ['draft', 'assigned', 'active']
              : ['assigned', 'active', 'finished']
            ).map((stage) => (
              <option key={stage} value={stage}>
                {stageLabels[stage as Trip['stage']]}
              </option>
            ))}
          </select>
        )}
      </div>
      {mode === 'tracking' ? (
        <div className="space-y-6">
          {state.drivers
            .filter((d) => !d.deletedAt)
            .filter(
              (d) =>
                !searchTerm ||
                d.name.toLowerCase().includes(searchTerm) ||
                routes.some((t) => t.driverId === d.id),
            )
            .map((d) => (
              <Card key={d.id}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Truck className="size-5 text-primary" />
                  {d.name}
                </h2>
                <div className="grid gap-3 xl:grid-cols-2">
                  {routes.filter((t) => t.driverId === d.id).map(tile)}
                </div>
                {!routes.some((t) => t.driverId === d.id) && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma rota nesta situação.
                  </p>
                )}
              </Card>
            ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{routes.map(tile)}</div>
      )}
      {mode !== 'tracking' && !routes.length && (
        <Card>
          {hasFilters ? (
            <>
              <p>Nenhuma viagem corresponde à busca ou aos filtros.</p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                Limpar filtros
              </Button>
            </>
          ) : mode === 'history' ? (
            'Ainda não há viagens finalizadas.'
          ) : (
            'Nenhuma viagem em planejamento ou aberta. Crie uma nova viagem para começar.'
          )}
        </Card>
      )}
      {detail && <TripDetails trip={detail} onClose={() => setDetail(null)} />}
    </PageFrame>
  );
}
function TripDetails({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { state, calculate } = useMilk();
  const [route, setRoute] = useState<RoadRoute | null>(
      trip.routeSnapshot || null,
    ),
    [error, setError] = useState('');
  const load = useEffectEvent(() => {
    let live = true;
    if (!trip.routeSnapshot)
      void calculate(trip)
        .then((r) => {
          if (live) setRoute(r);
        })
        .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  });
  useEffect(() => load(), [trip.id]);
  return (
    <Dialog title={trip.name} onClose={onClose}>
      <p className="mb-2 text-sm">
        {date(trip.date)} · {stageLabels[trip.stage]}
      </p>
      <p className="mb-4 text-sm">
        <strong>Motorista:</strong>{' '}
        {trip.stage === 'finished' && trip.driverName
          ? trip.driverName
          : state.drivers.find((d) => d.id === trip.driverId)?.name}{' '}
        ·{' '}
        {trip.stage === 'finished' && trip.vehiclePlate
          ? trip.vehiclePlate
          : state.vehicles.find((v) => v.id === trip.vehicleId)?.plate}
      </p>
      {trip.startedAt && (
        <p className="mb-2 text-xs text-muted-foreground">
          Início: {timestamp(trip.startedAt)}
          {trip.finishedAt && ` · Fim: ${timestamp(trip.finishedAt)}`}
        </p>
      )}
      <Stats trip={trip} />
      <div className="my-4 h-[300px] overflow-hidden rounded-xl border">
        <MilkMap points={trip.stops} trip={trip} route={route} />
      </div>
      {error && (
        <p className="milk-error" role="alert">
          {error}
        </p>
      )}
      <Legend />
      <p className="my-4 font-semibold">
        Total coletado: {fmt(summary(trip).liters)} L
      </p>
      {trip.stops.map((p, i) => {
        const r = record(trip, p.id);
        return (
          <article key={p.id} className="border-t py-3">
            <h3 className="font-semibold">
              {i + 1}. {p.name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge status={r.status} />
              <span className="text-sm">{fmt(r.liters)} L coletados</span>
            </div>
            {r.at && (
              <p className="mt-2 text-xs text-muted-foreground">
                {timestamp(r.at)}
              </p>
            )}
            {r.reason && <p className="mt-2 text-sm">Motivo: {r.reason}</p>}
          </article>
        );
      })}
    </Dialog>
  );
}
function Settings() {
  const { state } = useMilk();
  function download() {
    const data = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json',
      }),
      url = URL.createObjectURL(data),
      a = document.createElement('a');
    a.href = url;
    a.download = `leitaria-cleiton-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <PageFrame
      eyebrow="Demonstração"
      title="Sobre este protótipo"
      description="Um ambiente para experimentar a coleta de leite e discutir a experiência com a equipe."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Dados e histórico</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            As alterações ficam neste navegador e não são sincronizadas entre
            celulares ou computadores. Gestor e motorista são modos de
            demonstração, sem autenticação real.
          </p>
          <Button className="mt-4" size="lg" onClick={download}>
            <Download />
            Exportar backup dos dados
          </Button>
          <Link
            href="/auditoria"
            className="mt-4 block text-sm font-semibold text-primary underline"
          >
            Abrir histórico de alterações
          </Link>
        </Card>
        <Card>
          <h2 className="font-semibold">O que validar com as pessoas</h2>
          <ol className="mt-3 list-inside list-decimal space-y-3 text-sm leading-6 text-muted-foreground">
            <li>
              O gestor consegue selecionar locais e ajustar a ordem sem ajuda?
            </li>
            <li>
              O motorista entende que precisa confirmar a coleta manualmente?
            </li>
            <li>
              Ele consegue registrar uma falha e corrigir um engano com
              facilidade?
            </li>
            <li>O mapa, a legenda e os volumes ajudam a tomar decisões?</li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Hipóteses para a próxima rodada de Lean UX; testes com pessoas ainda
            precisam ser realizados.
          </p>
        </Card>
      </div>
    </PageFrame>
  );
}
