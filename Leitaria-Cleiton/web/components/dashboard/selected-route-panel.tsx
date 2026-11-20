import {
  ArrowRight,
  Clock3,
  Flag,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Truck,
  X,
} from 'lucide-react';
import Link from 'next/link';

import { StatusPill } from '@/components/system/status-pill';
import { buttonVariants } from '@/components/ui/button';
import type { LogisticsRoute } from '@/lib/mocks/operations';
import {
  getDeadlineHealth,
  getLastDelivery,
  getNextDelivery,
  getRemainingDeliveryCount,
  getRouteProgress,
} from '@/lib/route-visuals';
import { cn } from '@/lib/utils';

export function SelectedRoutePanel({
  route,
  onClose,
  className,
}: {
  route: LogisticsRoute;
  onClose: () => void;
  className?: string;
}) {
  const progress = getRouteProgress(route);
  const deadlineHealth = getDeadlineHealth(route);
  const nextDelivery = getNextDelivery(route);
  const lastDelivery = getLastDelivery(route);
  const remainingDeliveries = getRemainingDeliveryCount(route);
  const actionLabel =
    route.status === 'Em andamento'
      ? 'Ver detalhes da rota'
      : route.status === 'Precisa de revisão'
        ? 'Revisar rota'
        : route.status === 'Concluída'
          ? 'Ver no histórico'
          : 'Ver demanda';

  return (
    <article
      className={cn(
        'flex max-h-full flex-col overflow-hidden rounded-2xl border border-white/85 bg-white/97 shadow-[0_22px_70px_rgba(12,24,15,.24)] backdrop-blur',
        className,
      )}
    >
      <header className="relative border-b px-4 py-3.5 pr-14">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={statusTone(route.status)}>
            {route.status}
          </StatusPill>
          <span className="text-xs text-muted-foreground">
            {route.lastUpdate}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em]">
          {route.name}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{route.region}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes da rota"
          className="absolute right-2.5 top-2.5 grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        <section
          className="flex items-center gap-3"
          aria-labelledby="driver-title"
        >
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl border-2"
            style={{
              borderColor: deadlineHealth.color,
              backgroundColor: deadlineHealth.softColor,
              color: deadlineHealth.color,
            }}
          >
            <Truck aria-hidden="true" className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p id="driver-title" className="text-xs text-muted-foreground">
              Caminhoneiro
            </p>
            <p className="break-words text-sm font-semibold">{route.driver}</p>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">
              {route.vehicle
                ? `${route.vehicle} · ${route.vehiclePlate}`
                : 'Veículo não registrado'}
            </p>
            <StatusPill
              tone={deadlineTone(deadlineHealth.tone)}
              className="mt-1 min-h-6 px-2 py-0"
            >
              {deadlineHealth.label}
            </StatusPill>
          </div>
          <a
            href={`tel:${route.phone.replace(/\D/g, '')}`}
            aria-label={`Ligar para ${route.driver}: ${route.phone}`}
            title={route.phone}
            className="grid size-10 shrink-0 place-items-center rounded-xl border text-primary transition-colors hover:bg-primary-soft"
          >
            <Phone aria-hidden="true" className="size-4" />
          </a>
        </section>

        <dl className="mt-3 rounded-xl border bg-subtle px-3">
          <RouteLocation
            icon={MapPin}
            label="Agora"
            value={route.currentLocation}
          />
          <RouteLocation
            icon={Navigation}
            label="Próxima parada"
            value={route.nextStop}
            emphasize
          />
          {nextDelivery && nextDelivery.index !== lastDelivery?.index ? (
            <RouteLocation
              icon={Flag}
              label="Próxima entrega"
              value={nextDelivery.stop.name}
            />
          ) : null}
          <RouteLocation
            icon={Flag}
            label="Última entrega"
            value={lastDelivery?.stop.name ?? route.destination}
          />
        </dl>

        <section className="mt-3" aria-labelledby="route-progress-title">
          <div className="flex items-center justify-between gap-3 text-sm">
            <h3 id="route-progress-title" className="font-semibold">
              {progress}% do percurso
            </h3>
            <span className="flex shrink-0 items-center gap-1 font-medium tabular-nums text-muted-foreground">
              <Clock3 aria-hidden="true" className="size-3.5" />
              {remainingDeliveries}{' '}
              {remainingDeliveries === 1 ? 'escola restante' : 'escolas restantes'}
            </span>
          </div>
          <progress
            max={100}
            value={progress}
            aria-label={`${progress}% da rota concluída`}
            className="mt-2 block h-2 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[#0f766e] [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-border [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#0f766e]"
          />
        </section>

        <section
          className="mt-3 border-t pt-3"
          aria-labelledby="collected-title"
        >
          <div className="flex items-center justify-between gap-3">
            <h3
              id="collected-title"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <PackageCheck
                aria-hidden="true"
                className="size-4 text-primary"
              />
              Já coletado
            </h3>
            <span className="text-xs text-muted-foreground">
              {route.collected.length}{' '}
              {route.collected.length === 1 ? 'produto' : 'produtos'}
            </span>
          </div>
          {route.collected.length > 0 ? (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {route.collected.slice(0, 4).map((item) => (
                <li
                  key={item.product}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-primary-soft px-2.5 py-2 text-xs"
                >
                  <span className="min-w-0 break-words text-muted-foreground">
                    {item.product}
                  </span>
                  <strong className="shrink-0 font-semibold tabular-nums text-foreground">
                    {item.quantity}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-lg bg-subtle px-3 py-2 text-sm text-muted-foreground">
              A coleta ainda não começou.
            </p>
          )}
        </section>
      </div>

      <footer className="border-t bg-subtle p-3">
        <Link
          href={route.detailHref}
          className={cn(
            buttonVariants({ size: 'lg' }),
            'h-11 w-full rounded-xl bg-[#245f0a] text-sm hover:bg-[#1c4d07]',
          )}
        >
          {actionLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </footer>
    </article>
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

function RouteLocation({
  icon: Icon,
  label,
  value,
  emphasize = false,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 border-b py-2.5 last:border-b-0">
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-4 shrink-0',
          emphasize ? 'text-primary' : 'text-muted-foreground',
        )}
      />
      <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[94px_minmax(0,1fr)] sm:items-start sm:gap-2">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            'min-w-0 break-words text-sm leading-5',
            emphasize ? 'font-semibold' : 'font-medium',
          )}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

function statusTone(
  status: LogisticsRoute['status'],
): 'live' | 'success' | 'danger' | 'neutral' {
  if (status === 'Em andamento') return 'live';
  if (status === 'Precisa de revisão') return 'danger';
  if (status === 'Planejada') return 'success';
  return 'neutral';
}
