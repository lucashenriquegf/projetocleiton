'use client';

import { Filter, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import { ManagerAlerts } from '@/components/dashboard/manager-alerts';
import { OperationsMap } from '@/components/dashboard/operations-map';
import {
  RouteFilters,
  countActiveFilters,
  initialRouteFilters,
  type RouteFilterState,
} from '@/components/dashboard/route-filters';
import { RouteList } from '@/components/dashboard/route-list';
import { SelectedRoutePanel } from '@/components/dashboard/selected-route-panel';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ManagerAlert } from '@/lib/mocks/dashboard';
import type { LogisticsRoute } from '@/lib/mocks/operations';
import { cn } from '@/lib/utils';

export function ManagerOperationsHub({
  routes,
  alerts,
  initialRouteId,
}: {
  routes: LogisticsRoute[];
  alerts: ManagerAlert[];
  initialRouteId?: string;
}) {
  const operationalRoutes = useMemo(
    () => routes.filter(isOperationalRoute),
    [routes],
  );
  const initialRoute = operationalRoutes.find(
    (route) => route.id === initialRouteId,
  );
  const [filters, setFilters] = useState<RouteFilterState>(() =>
    initialRoute
      ? { ...initialRouteFilters, status: initialRoute.status }
      : initialRouteFilters,
  );
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(
    initialRoute?.id,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );

  const filteredRoutes = useMemo(() => {
    const query = normalize(filters.query);
    return operationalRoutes.filter((route) => {
      const searchable = normalize(
        [
          route.name,
          route.driver,
          route.region,
          route.currentLocation,
          route.destination,
          route.nextStop,
        ].join(' '),
      );
      return (
        (!query || searchable.includes(query)) &&
        (filters.status === 'Todas' || route.status === filters.status)
      );
    });
  }, [filters, operationalRoutes]);

  const selectedRoute = operationalRoutes.find(
    (route) => route.id === selectedRouteId,
  );
  const activeFilterCount = countActiveFilters(filters);

  const changeFilters = useCallback(
    (nextFilters: RouteFilterState) => {
      setFilters(nextFilters);
      const selected = operationalRoutes.find(
        (route) => route.id === selectedRouteId,
      );
      if (!selected || routeMatchesFilters(selected, nextFilters)) return;
      setSelectedRouteId(undefined);
      updateRouteInUrl();
      setLiveMessage('A rota selecionada não aparece com estes filtros.');
    },
    [operationalRoutes, selectedRouteId],
  );

  const selectRoute = useCallback(
    (routeId: string) => {
      const route = operationalRoutes.find((item) => item.id === routeId);
      if (!route) return;

      const alreadyVisible = filteredRoutes.some((item) => item.id === routeId);
      if (!alreadyVisible) {
        setFilters({
          query: '',
          status: route.status,
        });
      }
      setSelectedRouteId(routeId);
      updateRouteInUrl(routeId);
      setLiveMessage(`${route.name}, de ${route.driver}, selecionada.`);
    },
    [filteredRoutes, operationalRoutes],
  );

  const clearSelection = useCallback(() => {
    setSelectedRouteId(undefined);
    updateRouteInUrl();
    setLiveMessage('Seleção de rota removida.');
  }, []);

  const resultLabel = describeResults(filteredRoutes.length, filters);

  return (
    <div className="flex min-h-[calc(100dvh-70px)] flex-col bg-background lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <header className="shrink-0 border-b bg-white px-4 py-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-[-0.035em] sm:text-2xl">
              Mapa das rotas
            </h1>
            <p
              className="mt-0.5 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {resultLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ManagerAlerts alerts={alerts} onSelectRoute={selectRoute} />
            <Link
              href="/cadastros/caminhoneiros/novo"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'h-11 rounded-xl bg-[#245f0a] px-3 hover:bg-[#1c4d07]',
              )}
            >
              <Plus aria-hidden="true" />
              <span className="hidden md:inline">Cadastrar caminhoneiro</span>
              <span className="sr-only md:hidden">Cadastrar caminhoneiro</span>
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersOpen(true)}
              aria-label="Filtrar rotas"
              className="relative h-11 rounded-xl bg-white px-3 lg:hidden"
            >
              <Filter aria-hidden="true" />
              <span className="hidden sm:inline">Filtrar</span>
              {activeFilterCount > 0 ? (
                <span className="grid min-w-5 place-items-center rounded-md bg-[#17241f] px-1 py-0.5 text-[11px] text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        <RouteFilters
          filters={filters}
          onChange={changeFilters}
          className="mt-3 hidden lg:flex"
        />
      </header>

      <section
        className="flex min-h-[460px] flex-1 overflow-hidden"
        aria-label="Acompanhamento das rotas"
      >
        <div className="relative isolate min-w-0 flex-1 overflow-hidden">
          <OperationsMap
            routes={filteredRoutes}
            selectedRoute={selectedRoute}
            onSelectRoute={selectRoute}
          />

          <div className="absolute bottom-4 left-3 z-[440] sm:left-4">
            <RouteList
              routes={filteredRoutes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={selectRoute}
              onClearFilters={() => changeFilters(initialRouteFilters)}
              side={isDesktop ? 'left' : 'bottom'}
            />
          </div>
        </div>

        {selectedRoute && isDesktop ? (
          <aside
            className="w-[360px] shrink-0 border-l bg-white xl:w-[380px]"
            aria-label="Detalhes da rota selecionada"
          >
            <SelectedRoutePanel
              route={selectedRoute}
              onClose={clearSelection}
              className="h-full max-h-none rounded-none border-0 bg-white shadow-none backdrop-blur-none"
            />
          </aside>
        ) : null}
      </section>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] gap-0 rounded-t-2xl"
          showCloseButton
        >
          <SheetHeader className="border-b px-5 py-5 pr-14">
            <SheetTitle className="text-xl font-semibold">
              Filtrar rotas
            </SheetTitle>
            <SheetDescription>
              Escolha quais caminhões devem aparecer no mapa.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto p-5">
            <RouteFilters filters={filters} onChange={changeFilters} />
            <Button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-5 h-12 w-full rounded-xl bg-[#245f0a] text-base hover:bg-[#1c4d07]"
            >
              Mostrar {filteredRoutes.length}{' '}
              {filteredRoutes.length === 1 ? 'rota' : 'rotas'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!isDesktop && Boolean(selectedRoute)}
        onOpenChange={(open) => !open && clearSelection()}
      >
        <SheetContent
          side="bottom"
          className="max-h-[88dvh] gap-0 rounded-t-2xl p-0"
          showCloseButton={false}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Detalhes da rota selecionada</SheetTitle>
            <SheetDescription>
              Informações do caminhoneiro, do trajeto e da coleta.
            </SheetDescription>
          </SheetHeader>
          {selectedRoute ? (
            <SelectedRoutePanel
              route={selectedRoute}
              onClose={clearSelection}
              className="rounded-none border-0 shadow-none"
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>
    </div>
  );
}

function describeResults(count: number, filters: RouteFilterState) {
  if (filters.status === 'Em andamento') {
    return `${count} ${count === 1 ? 'rota em andamento' : 'rotas em andamento'}`;
  }
  return `${count} ${count === 1 ? 'rota no mapa' : 'rotas no mapa'}`;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function routeMatchesFilters(route: LogisticsRoute, filters: RouteFilterState) {
  const query = normalize(filters.query);
  const searchable = normalize(
    [
      route.name,
      route.driver,
      route.region,
      route.currentLocation,
      route.destination,
      route.nextStop,
    ].join(' '),
  );
  return (
    (!query || searchable.includes(query)) &&
    (filters.status === 'Todas' || route.status === filters.status)
  );
}

function isOperationalRoute(route: LogisticsRoute): route is LogisticsRoute & {
  status: Exclude<LogisticsRoute['status'], 'Concluída'>;
} {
  return route.status !== 'Concluída';
}

function subscribeToDesktop(callback: () => void) {
  const media = window.matchMedia('(min-width: 1024px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getDesktopSnapshot() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

function getDesktopServerSnapshot() {
  return true;
}

function updateRouteInUrl(routeId?: string) {
  const url = new URL(window.location.href);
  if (routeId) url.searchParams.set('rota', routeId);
  else url.searchParams.delete('rota');
  window.history.replaceState(window.history.state, '', url);
}
