'use client';

import { useCallback, useMemo, useState } from 'react';

import { OperationsMap } from '@/components/dashboard/operations-map';
import type { LogisticsRoute } from '@/lib/mocks/operations';
import { logisticsRoutes } from '@/lib/mocks/operations';
import { cn } from '@/lib/utils';

const defaultRoutes = [logisticsRoutes[0]];

export function RouteMap({
  className,
  showCompletedPath = false,
  label = 'Rota selecionada',
  currentStopLabel = 'Parada atual',
  totalStops,
  routes,
}: {
  className?: string;
  showCompletedPath?: boolean;
  label?: string;
  currentStopLabel?: string;
  totalStops?: number;
  routes?: LogisticsRoute[];
}) {
  const visibleRoutes = useMemo(
    () =>
      (routes?.length ? routes : defaultRoutes).map((route) =>
        showCompletedPath
          ? route
          : {
              ...route,
              status: 'Planejada' as const,
              completedStops: 0,
              collected: [],
              currentLocation: 'Aguardando início',
              lastUpdate: 'Proposta de rota',
            },
      ),
    [routes, showCompletedPath],
  );
  const [selectedId, setSelectedId] = useState(visibleRoutes[0].id);
  const selectedRoute =
    visibleRoutes.find((route) => route.id === selectedId) ?? visibleRoutes[0];
  const resolvedTotalStops = totalStops ?? selectedRoute.totalStops;
  const selectRoute = useCallback((routeId: string) => {
    setSelectedId(routeId);
  }, []);

  return (
    <div
      className={cn(
        'relative min-h-[380px] overflow-hidden bg-[#dce7df]',
        className,
      )}
    >
      <OperationsMap
        routes={visibleRoutes}
        selectedRoute={selectedRoute}
        onSelectRoute={selectRoute}
        ariaLabel={`${label}, ${currentStopLabel}, ${resolvedTotalStops} paradas`}
      />

      {visibleRoutes.length > 1 ? (
        <div
          className="absolute bottom-4 left-4 z-[450] flex max-w-[calc(100%-2rem)] gap-2 overflow-x-auto rounded-xl border border-white/85 bg-white/94 p-1.5 shadow-[0_8px_24px_rgba(18,40,30,.16)] backdrop-blur"
          aria-label="Escolher rota para visualizar"
        >
          {visibleRoutes.map((route) => (
            <button
              key={route.id}
              type="button"
              aria-pressed={selectedRoute.id === route.id}
              onClick={() => selectRoute(route.id)}
              className={cn(
                'min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors',
                selectedRoute.id === route.id
                  ? 'bg-[#17241f] text-white'
                  : 'text-muted-foreground hover:bg-subtle hover:text-foreground',
              )}
            >
              {route.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
