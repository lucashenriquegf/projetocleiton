import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  History,
  PackageCheck,
  Route as RouteIcon,
  Truck,
} from 'lucide-react';
import Link from 'next/link';

import { PageFrame } from '@/components/layout/page-frame';
import { StatusPill } from '@/components/system/status-pill';
import { buttonVariants } from '@/components/ui/button';
import type { DemandRecord, DemandStatus } from '@/lib/mocks/demands';
import { isHistoricalDemand } from '@/lib/mocks/demands';
import { cn } from '@/lib/utils';

export function DemandDetailView({ demand }: { demand: DemandRecord }) {
  const backHref = isHistoricalDemand(demand)
    ? '/demandas?visao=historico'
    : '/demandas';
  const action = detailAction(demand);

  return (
    <PageFrame
      wide
      backHref={backHref}
      eyebrow={
        demand.id.startsWith('hist-')
          ? `Demanda #${demand.id.replace('hist-', '')}`
          : 'Demanda atual'
      }
      title={demand.school}
      description={`${demand.dateLabel} · necessária até ${demand.deadline}`}
      action={
        action ? (
          <Link
            href={action.href}
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-11 rounded-xl bg-[#245f0a] px-4',
            )}
          >
            {action.label}
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : undefined
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">Resumo da demanda</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {demand.menuLabel} · {demand.productCount} produtos
                </p>
              </div>
              <StatusPill tone={toneForStatus(demand.status)}>
                {demand.status}
              </StatusPill>
            </header>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem
                icon={CalendarDays}
                label="Data"
                value={demand.dateLabel}
              />
              <SummaryItem
                icon={Clock3}
                label="Prazo"
                value={demand.deadline}
              />
              <SummaryItem
                icon={PackageCheck}
                label="Quantidade atendida"
                value={`${demand.coverage}%`}
              />
              <SummaryItem
                icon={RouteIcon}
                label="Rotas"
                value={String(demand.routes.length)}
              />
            </dl>
          </section>

          {demand.issue ? (
            <section className="rounded-2xl border border-alert/20 bg-alert-soft/60 p-5">
              <div className="flex gap-3">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-alert"
                />
                <div>
                  <h2 className="font-semibold">{demand.issue.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {demand.issue.description}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-2xl border bg-white">
            <header className="border-b px-5 py-4">
              <h2 className="font-semibold">Produtos e quantidades</h2>
            </header>
            <ul className="divide-y">
              {demand.products.map((product) => (
                <li
                  key={product.name}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {product.quantity}
                  </span>
                </li>
              ))}
            </ul>
            {demand.productCount > demand.products.length ? (
              <p className="border-t bg-subtle px-5 py-3 text-sm text-muted-foreground">
                E mais {demand.productCount - demand.products.length}{' '}
                {demand.productCount - demand.products.length === 1
                  ? 'produto'
                  : 'produtos'}
                .
              </p>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white">
            <header className="border-b px-5 py-4">
              <h2 className="font-semibold">Rotas e caminhoneiros</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A demanda continua sendo um único registro mesmo quando é
                dividida.
              </p>
            </header>
            {demand.routes.length > 0 ? (
              <ul className="divide-y">
                {demand.routes.map((route, index) => (
                  <li
                    key={`${route.id}-${route.driver}`}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                      <Truck aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{route.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {route.driver}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {index === 0
                        ? 'Coleta principal'
                        : 'Complemento da demanda'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center">
                <RouteIcon
                  aria-hidden="true"
                  className="mx-auto size-7 text-muted-foreground"
                />
                <p className="mt-3 font-medium">Nenhuma rota definida</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  As rotas serão escolhidas durante o planejamento.
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-2xl border bg-white xl:sticky xl:top-6">
          <header className="flex items-center gap-2 border-b px-5 py-4">
            <History aria-hidden="true" className="size-5 text-primary" />
            <h2 className="font-semibold">Histórico da demanda</h2>
          </header>
          <ol className="p-5">
            {demandEvents(demand).map((event, index, events) => (
              <li
                key={event.title}
                className="relative flex gap-3 pb-6 last:pb-0"
              >
                {index < events.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-[9px] top-5 h-[calc(100%-8px)] w-px bg-border"
                  />
                ) : null}
                <span className="relative z-10 mt-1 size-[19px] shrink-0 rounded-full border-4 border-white bg-primary" />
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {event.when}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </PageFrame>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="border-b p-5 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0">
      <Icon aria-hidden="true" className="size-4 text-primary" />
      <dt className="mt-3 text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function detailAction(demand: DemandRecord) {
  if (demand.issue) {
    return {
      label: demand.issue.actionLabel,
      href: `/demandas/${demand.id}/planejar`,
    };
  }
  if (demand.routes[0] && !isHistoricalDemand(demand)) {
    return {
      label: 'Ver no mapa',
      href: `/gestor?rota=${demand.routes[0].id}`,
    };
  }
  return null;
}

function demandEvents(demand: DemandRecord) {
  const events = [
    {
      title: 'Demanda gerada pelo cardápio do dia',
      when: `${demand.dateLabel} · Escola`,
    },
  ];
  if (demand.menuChangeCount) {
    events.push({
      title: `${demand.menuChangeCount} ${demand.menuChangeCount === 1 ? 'substituição aplicada' : 'substituições aplicadas'} neste dia`,
      when: 'Somente os produtos afetados foram recalculados',
    });
  }
  if (demand.issue) {
    events.push({
      title: demand.issue.title,
      when: 'Aguardando decisão do gestor',
    });
  } else if (demand.routes.length > 0) {
    events.push({
      title:
        demand.routes.length === 1
          ? 'Planejamento aprovado'
          : `Planejamento dividido em ${demand.routes.length} rotas`,
      when: demand.routes.map((route) => route.driver).join(' e '),
    });
  }
  if (demand.status === 'Em coleta') {
    events.push({
      title: 'Coleta iniciada',
      when: 'Acompanhamento disponível no mapa',
    });
  }
  if (demand.status === 'Em entrega') {
    events.push({
      title: 'Produtos coletados',
      when: 'Caminhoneiro a caminho da escola',
    });
  }
  if (demand.status === 'Concluída') {
    events.push({
      title: 'Entrega concluída',
      when: `${demand.dateLabel} · dentro do prazo`,
    });
  }
  if (demand.status === 'Cancelada') {
    events.push({
      title: 'Demanda cancelada',
      when: `${demand.dateLabel} · registro encerrado`,
    });
  }
  return events;
}

function toneForStatus(status: DemandStatus) {
  if (status === 'Concluída' || status === 'Planejada')
    return 'success' as const;
  if (status === 'Em coleta' || status === 'Em entrega') return 'live' as const;
  if (status === 'Precisa planejar' || status === 'Precisa de revisão')
    return 'danger' as const;
  return 'neutral' as const;
}
