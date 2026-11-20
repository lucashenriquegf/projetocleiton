'use client';

import {
  AlertTriangle,
  Check,
  Clock3,
  MapPin,
  PackageCheck,
  Phone,
  Radio,
  RefreshCw,
  SignalLow,
  Truck,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { RouteMap } from '@/components/routes/route-map';
import { StatusPill } from '@/components/system/status-pill';
import { Button } from '@/components/ui/button';
import type { LogisticsRoute } from '@/lib/mocks/operations';
import {
  getDeadlineHealth,
  getDeliveryStops,
  getLastDelivery,
  getRouteProgress,
  getRouteStops,
} from '@/lib/route-visuals';

const states = [
  'Atualizada',
  'Sinal atrasado',
  'Sem localização',
  'Em revisão',
] as const;

export function TrackingView({ route }: { route: LogisticsRoute }) {
  const [state, setState] = useState<(typeof states)[number]>('Atualizada');
  const stops = getRouteStops(route);
  const deliveries = getDeliveryStops(route);
  const lastDelivery = getLastDelivery(route);
  const progress = getRouteProgress(route);
  const deadlineHealth = getDeadlineHealth(route);
  const mapRoutes = useMemo(() => [route], [route]);

  return (
    <ManagerShell>
      <PageFrame
        wide
        backHref={`/gestor?rota=${route.id}`}
        eyebrow="Acompanhamento da rota"
        title={route.name}
        description={`${route.driver} · ${deliveries.length} ${deliveries.length === 1 ? 'escola' : 'escolas'} · última entrega em ${lastDelivery?.stop.name ?? route.destination}`}
        action={
          <Button variant="outline" className="h-11 rounded-none">
            <RefreshCw aria-hidden="true" /> Atualizar
          </Button>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <StatusPill
            tone={
              state === 'Atualizada'
                ? 'live'
                : state === 'Em revisão'
                  ? 'danger'
                  : 'warning'
            }
          >
            {state === 'Atualizada'
              ? 'Posição atualizada agora'
              : state === 'Sinal atrasado'
                ? 'Último sinal há 18 minutos'
                : state === 'Sem localização'
                  ? 'Localização não autorizada'
                  : 'Rota marcada para revisão'}
          </StatusPill>
          <StatusPill tone={deadlineTone(deadlineHealth.tone)}>
            {deadlineHealth.label}
          </StatusPill>
          <div
            className="ml-auto flex gap-1 overflow-x-auto"
            aria-label="Cenários de demonstração"
          >
            {states.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={state === item ? 'default' : 'ghost'}
                className={`rounded-none ${state === item ? 'bg-[#101510]' : ''}`}
                onClick={() => setState(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>

        {state !== 'Atualizada' ? (
          <div className="mb-5 flex items-start gap-3 border border-[#ecdcae] bg-[#fff8df] p-4 text-sm">
            <SignalLow
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-[#765d12]"
            />
            <div>
              <p className="font-medium">O roteiro continua disponível</p>
              <p className="mt-1 text-muted-foreground">
                A última posição conhecida permanece no mapa e as confirmações
                do caminhoneiro continuam sendo registradas.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_390px]">
          <div className="border bg-white">
            <RouteMap
              routes={mapRoutes}
              showCompletedPath
              label={route.name}
              currentStopLabel={
                stops[Math.min(route.completedStops, stops.length - 1)]?.name
              }
              totalStops={route.totalStops}
              className="min-h-[540px]"
            />
            <dl className="grid grid-cols-3 divide-x border-t py-4">
              <Metric
                icon={PackageCheck}
                label="Coletado"
                value={`${route.collected.length} produtos`}
              />
              <Metric
                icon={MapPin}
                label="Progresso"
                value={`${progress}% percorrido`}
              />
              <Metric icon={Clock3} label="Chegada" value={route.eta} />
            </dl>
            <section className="border-t p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Coletado até agora</h2>
                <span className="text-xs text-muted-foreground">
                  Atualizado agora
                </span>
              </div>
              {route.collected.length > 0 ? (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {route.collected.map((item) => (
                    <CollectedProduct
                      key={item.product}
                      name={item.product}
                      value={item.quantity}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  A coleta ainda não começou.
                </p>
              )}
            </section>
          </div>

          <aside className="border bg-white p-5">
            <div className="flex items-start gap-3 border-b pb-4">
              <span className="grid size-10 shrink-0 place-items-center bg-primary-soft text-primary">
                <Truck aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{route.driver}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Radio aria-hidden="true" className="size-3" />
                  {state === 'Atualizada'
                    ? 'Atualizado agora'
                    : 'Usando última posição'}
                </p>
                <a
                  href={`tel:${route.phone.replace(/\D/g, '')}`}
                  className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-primary"
                >
                  <Phone aria-hidden="true" className="size-3.5" />
                  {route.phone}
                </a>
              </div>
            </div>
            <div className="border-b py-4 text-sm">
              <p className="text-xs text-muted-foreground">Posição atual</p>
              <p className="mt-1 flex items-start gap-2 font-medium">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                {route.currentLocation}
              </p>
            </div>
            <h2 className="mt-5 font-semibold">Sequência da rota</h2>
            <ol className="mt-3 max-h-[520px] space-y-1 overflow-y-auto pr-1">
              {stops.map((stop, index) => {
                const status =
                  index < route.completedStops
                    ? 'Concluída'
                    : index === route.completedStops
                      ? 'Atual'
                      : 'Próxima';
                return (
                  <li
                    key={`${stop.name}-${index}`}
                    className={`flex gap-3 border p-3 ${status === 'Atual' ? 'border-primary/35 bg-primary-soft/50' : 'bg-subtle'}`}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center text-xs font-semibold ${status === 'Concluída' ? 'bg-[#245f0a] text-white' : status === 'Atual' ? 'bg-[#101510] text-white' : 'border bg-white text-muted-foreground'}`}
                    >
                      {status === 'Concluída' ? (
                        <Check aria-hidden="true" className="size-4" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{stop.name}</p>
                        {stop.kind === 'delivery' ? (
                          <span className="border border-[#ddd0fb] bg-[#f4efff] px-1.5 py-0.5 text-xs font-medium text-[#5b21b6]">
                            {index === lastDelivery?.index
                              ? 'Última entrega'
                              : `Entrega ${stops
                                  .slice(0, index + 1)
                                  .filter((candidate) => candidate.kind === 'delivery').length}`}
                          </span>
                        ) : stop.kind === 'origin' ? (
                          <span className="border border-[#bfdbfe] bg-[#eff6ff] px-1.5 py-0.5 text-xs font-medium text-[#1d4ed8]">
                            Saída
                          </span>
                        ) : stop.kind === 'return' ? (
                          <span className="border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            Após as entregas
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stop.address}
                      </p>
                      <p className="mt-1 text-xs text-foreground">
                        {stop.items}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>

        <div className="mt-5 flex items-start gap-3 border border-success/25 bg-success-soft/65 p-4 text-sm">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-success"
          />
          <div>
            <p className="font-medium">Trajeto somente por vias liberadas</p>
            <p className="mt-1 text-muted-foreground">
              Trechos cadastrados como bloqueados foram excluídos antes do
              cálculo e não aparecem neste mapa.
            </p>
          </div>
        </div>
      </PageFrame>
    </ManagerShell>
  );
}

function deadlineTone(
  tone: ReturnType<typeof getDeadlineHealth>['tone'],
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (tone === 'safe') return 'success';
  if (tone === 'warning') return 'warning';
  if (tone === 'late') return 'danger';
  return 'neutral';
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-3 sm:px-4">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium leading-5 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function CollectedProduct({ name, value }: { name: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border bg-subtle px-3 py-3 text-sm">
      <span className="text-muted-foreground">{name}</span>
      <strong className="font-semibold tabular-nums">{value}</strong>
    </li>
  );
}
