'use client';

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  Navigation,
  Route,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { OperationsMap } from '@/components/dashboard/operations-map';
import { buttonVariants } from '@/components/ui/button';
import { logisticsRoutes } from '@/lib/mocks/operations';
import {
  getDeadlineHealth,
  getRemainingDeliveryCount,
  getRouteProgress,
} from '@/lib/route-visuals';
import { cn } from '@/lib/utils';

const currentRoute = logisticsRoutes[0];
const currentRoutes = [currentRoute];

export function DriverNavigationMap() {
  const [muted, setMuted] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const keepCurrentRoute = useCallback(() => undefined, []);
  const progress = getRouteProgress(currentRoute);
  const deadlineHealth = getDeadlineHealth(currentRoute);
  const remainingDeliveries = getRemainingDeliveryCount(currentRoute);

  return (
    <section
      className="driver-navigation-map relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#dce7df]"
      aria-label="Navegação da rota atual"
    >
      <div className="absolute inset-0">
        <OperationsMap
          routes={currentRoutes}
          selectedRoute={currentRoute}
          onSelectRoute={keepCurrentRoute}
          showChrome={false}
          ariaLabel={`Mapa interativo da ${currentRoute.name} até ${currentRoute.nextStop}`}
        />
      </div>

      <div className="absolute inset-x-3 top-3 z-[500] flex items-start gap-3 sm:inset-x-5 sm:top-5">
        <Link
          href="/coletor"
          aria-label="Sair do mapa"
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#101510] text-white shadow-lg"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-4 rounded-xl bg-[#101510] px-4 py-3 text-white shadow-lg sm:max-w-xl">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#245f0a]">
            <Navigation aria-hidden="true" className="size-6 -rotate-45" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/55">Em 600 metros</p>
            <p className="mt-0.5 break-words text-base font-semibold leading-5 sm:text-lg sm:leading-6">
              Vire à esquerda no acesso 14
            </p>
          </div>
        </div>
        <span className="hidden min-h-12 items-center gap-2 rounded-xl bg-white px-3 text-xs font-medium text-success shadow-lg sm:inline-flex">
          <span className="size-2 rounded-full bg-success" /> GPS ativo
        </span>
      </div>

      <button
        type="button"
        aria-label={
          muted ? 'Ativar instruções por voz' : 'Silenciar instruções por voz'
        }
        aria-pressed={muted}
        onClick={() => setMuted((value) => !value)}
        className="absolute right-3 top-[13.25rem] z-[500] grid size-11 place-items-center rounded-xl border border-white/85 bg-white text-foreground shadow-md sm:right-5"
      >
        {muted ? (
          <VolumeX aria-hidden="true" className="size-5" />
        ) : (
          <Volume2 aria-hidden="true" className="size-5" />
        )}
      </button>

      <aside className="absolute inset-x-0 bottom-0 z-[500] bg-white shadow-[0_-12px_32px_rgba(16,21,16,.16)] sm:bottom-5 sm:left-auto sm:right-5 sm:w-[390px] sm:rounded-2xl">
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-between gap-3 border-b px-5 text-left"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((value) => !value)}
        >
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">
              Próxima parada · 5 de 7
            </span>
            <span className="mt-1 block font-semibold">
              {currentRoute.nextStop}
            </span>
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-3">
            <span className="text-right text-xs font-medium">
              <span className="block tabular-nums">{progress}% percorrido</span>
              <span
                className="mt-0.5 flex items-center justify-end gap-1.5"
                style={{ color: deadlineHealth.color }}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: deadlineHealth.color }}
                />
                {deadlineHealth.label}
              </span>
            </span>
            {detailsOpen ? (
              <ChevronDown aria-hidden="true" className="size-5" />
            ) : (
              <ChevronUp aria-hidden="true" className="size-5" />
            )}
          </span>
        </button>

        {detailsOpen ? (
          <div className="p-5">
            <div className="grid grid-cols-3 divide-x border-y py-4 text-center">
              <MapFact icon={Clock3} label="Chegada" value="08h46" />
              <MapFact icon={Route} label="Distância" value="3,2 km" />
              <MapFact icon={MapPin} label="Tempo" value="6 min" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Coletar{' '}
              <strong className="font-semibold text-foreground">
                160 unidades de alface
              </strong>
              .
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {remainingDeliveries}{' '}
              {remainingDeliveries === 1
                ? 'escola ainda será atendida.'
                : 'escolas ainda serão atendidas.'}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/coletor/parada"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'h-13 rounded-xl bg-[#245f0a] px-4 text-base',
                )}
              >
                Cheguei ao local
              </Link>
              <Link
                href="/coletor"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'h-13 rounded-xl px-4',
                )}
              >
                Ver roteiro
              </Link>
            </div>
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function MapFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="px-2">
      <Icon aria-hidden="true" className="mx-auto size-4 text-primary" />
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
