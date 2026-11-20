'use client';

import { Clock3, ListFilter, MapPin, Navigation, Truck } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { LogisticsRoute } from '@/lib/mocks/operations';
import {
  formatRouteDateTime,
  getDeadlineHealth,
  getLastDelivery,
  getNextDelivery,
  getRouteProgress,
} from '@/lib/route-visuals';
import { cn } from '@/lib/utils';

export function RouteList({
  routes,
  selectedRouteId,
  onSelectRoute,
  onClearFilters,
  side,
}: {
  routes: LogisticsRoute[];
  selectedRouteId?: string;
  onSelectRoute: (routeId: string) => void;
  onClearFilters: () => void;
  side: 'left' | 'bottom';
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-11 rounded-xl border-white/85 bg-white/96 px-3.5 shadow-[0_8px_24px_rgba(18,40,30,.17)] backdrop-blur hover:bg-white"
      >
        <ListFilter aria-hidden="true" className="size-4" />
        Rotas
        <span className="grid min-w-6 place-items-center rounded-md bg-[#17241f] px-1.5 py-0.5 text-xs font-semibold text-white">
          {routes.length}
        </span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={side}
          className={cn(
            'gap-0 p-0',
            side === 'left'
              ? 'w-[min(92vw,390px)] max-w-none'
              : 'max-h-[82dvh] rounded-t-2xl',
          )}
          showCloseButton
        >
          <SheetHeader className="border-b px-5 py-5 pr-14">
            <SheetTitle className="text-xl font-semibold tracking-[-0.025em]">
              Rotas no mapa
            </SheetTitle>
            <SheetDescription>
              Escolha uma rota para localizar o caminhão e ver o trajeto.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {routes.length > 0 ? (
              <ul className="space-y-2">
                {routes.map((route) => {
                  const selected = route.id === selectedRouteId;
                  const progress = getRouteProgress(route);
                  const deadlineHealth = getDeadlineHealth(route);
                  const nextDelivery = getNextDelivery(route);
                  const lastDelivery = getLastDelivery(route);
                  return (
                    <li key={route.id}>
                      <button
                        type="button"
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => {
                          onSelectRoute(route.id);
                          setOpen(false);
                        }}
                        className={cn(
                          'w-full rounded-xl border p-3.5 text-left transition-colors',
                          selected
                            ? 'border-primary/45 bg-primary-soft/75'
                            : 'border-transparent bg-subtle hover:border-border hover:bg-white',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg text-white"
                            style={{ backgroundColor: deadlineHealth.color }}
                            title={deadlineHealth.label}
                          >
                            <Truck aria-hidden="true" className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <strong className="min-w-0 break-words text-sm font-semibold">
                                {route.driver}
                              </strong>
                              <span className="shrink-0 text-right text-xs font-medium tabular-nums">
                                <span className="block text-foreground">{progress}%</span>
                                <span
                                  className="mt-0.5 block"
                                  style={{ color: deadlineHealth.color }}
                                >
                                  {deadlineHealth.label}
                                </span>
                              </span>
                            </span>
                            <span className="mt-0.5 block break-words text-sm text-muted-foreground">
                              {route.name} · {route.region}
                            </span>
                            <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                              {route.vehiclePlate ?? 'Veículo não registrado'}
                            </span>
                          </span>
                        </div>

                        <span className="mt-3 flex items-start gap-2 text-sm">
                          <Navigation aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          <span className="min-w-0 break-words leading-5">
                            <span className="text-muted-foreground">Próxima entrega: </span>
                            {nextDelivery?.stop.name ?? 'Nenhuma entrega pendente'}
                          </span>
                        </span>

                        <span className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-xs text-muted-foreground">
                          <span className="flex min-w-0 items-start gap-1.5 break-words leading-5">
                            <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                            {lastDelivery?.stop.name ?? route.destination}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 tabular-nums">
                            <Clock3 aria-hidden="true" className="size-3.5" />
                            {formatRouteDateTime(
                              lastDelivery?.stop.estimatedArrivalAt,
                            )}
                          </span>
                        </span>

                        <span aria-hidden="true" className="mt-3 block h-1 overflow-hidden rounded-full bg-border">
                          <span
                            className="block h-full rounded-full bg-[#0f766e]"
                            style={{ width: `${progress}%` }}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid min-h-56 place-items-center rounded-xl border bg-subtle px-5 text-center">
                <div>
                  <p className="font-semibold">Nenhuma rota encontrada</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Limpe os filtros para mostrar novamente todos os caminhões.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onClearFilters();
                      setOpen(false);
                    }}
                    className="mt-4 h-11 rounded-xl bg-white"
                  >
                    Limpar filtros
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
