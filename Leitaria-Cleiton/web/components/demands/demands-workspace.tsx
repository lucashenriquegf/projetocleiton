'use client';

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Filter,
  MapPin,
  Route as RouteIcon,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';

import { StatusPill } from '@/components/system/status-pill';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DemandRecord, DemandStatus } from '@/lib/mocks/demands';
import { isHistoricalDemand } from '@/lib/mocks/demands';
import {
  getServerDemandDemoOverrides,
  readDemandDemoOverrides,
  subscribeToDemandDemoOverrides,
} from '@/lib/mocks/demand-demo-state';
import { cn } from '@/lib/utils';

type DemandView = 'atuais' | 'historico';
type DemandFilters = {
  status: 'Todas' | DemandStatus;
  startDate: string;
  endDate: string;
};

const emptyFilters: DemandFilters = {
  status: 'Todas',
  startDate: '',
  endDate: '',
};

const historyPageSize = 20;

export function DemandsWorkspace({
  demands,
  initialView,
}: {
  demands: DemandRecord[];
  initialView: DemandView;
}) {
  const [view, setView] = useState<DemandView>(initialView);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<DemandFilters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const demoOverrides = useSyncExternalStore(
    subscribeToDemandDemoOverrides,
    readDemandDemoOverrides,
    getServerDemandDemoOverrides,
  );

  const displayedDemands = useMemo(
    () =>
      demands.map((demand) => ({
        ...demand,
        ...demoOverrides[demand.id],
      })),
    [demands, demoOverrides],
  );

  const currentDemands = useMemo(
    () => displayedDemands.filter((demand) => !isHistoricalDemand(demand)),
    [displayedDemands],
  );
  const historicalDemands = useMemo(
    () => displayedDemands.filter(isHistoricalDemand),
    [displayedDemands],
  );

  const filteredCurrent = useMemo(
    () =>
      currentDemands.filter((demand) => matchesFilters(demand, query, filters)),
    [currentDemands, filters, query],
  );
  const filteredHistory = useMemo(
    () =>
      historicalDemands.filter((demand) =>
        matchesFilters(demand, query, filters),
      ),
    [filters, historicalDemands, query],
  );

  const planningDemands = sortByDeadline(
    filteredCurrent.filter((demand) => demand.status === 'Precisa planejar'),
  );
  const reviewDemands = sortByDeadline(
    filteredCurrent.filter((demand) => demand.status === 'Precisa de revisão'),
  );
  const regularGroups = groupByDate(
    filteredCurrent.filter(
      (demand) =>
        demand.status !== 'Precisa planejar' &&
        demand.status !== 'Precisa de revisão',
    ),
  );
  const totalHistoryPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / historyPageSize),
  );
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const paginatedHistory = filteredHistory.slice(
    (safeHistoryPage - 1) * historyPageSize,
    safeHistoryPage * historyPageSize,
  );
  const activeFilterCount = countFilters(filters);

  const changeView = (nextView: DemandView) => {
    setView(nextView);
    setFilters(emptyFilters);
    setHistoryPage(1);
    const url = new URL(window.location.href);
    if (nextView === 'historico') url.searchParams.set('visao', 'historico');
    else url.searchParams.delete('visao');
    window.history.replaceState(window.history.state, '', url);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setQuery('');
    setHistoryPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-[1420px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <header>
        <h1 className="text-[1.8rem] font-semibold leading-tight tracking-[-0.04em] sm:text-[2rem]">
          Demandas
        </h1>
      </header>

      <Tabs
        value={view}
        onValueChange={(value) => changeView(value as DemandView)}
        className="mt-5 gap-0"
      >
        <TabsList
          variant="line"
          className="h-11 w-full justify-start gap-6 p-0"
        >
          <TabsTrigger
            value="atuais"
            className="h-11 flex-none rounded-none px-0 text-base after:hidden data-active:font-semibold data-active:[&>span]:border-[#245f0a]"
          >
            <span className="inline-flex items-center gap-2 border-b-2 border-transparent pb-1.5 leading-none">
              <span>Atuais</span>
              <span className="inline-grid h-5 min-w-5 place-items-center rounded-md bg-muted px-1.5 text-xs leading-none tabular-nums text-muted-foreground">
                {currentDemands.length}
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="h-11 flex-none rounded-none px-0 text-base after:hidden data-active:font-semibold data-active:[&>span]:border-[#245f0a]"
          >
            <span className="inline-flex items-center border-b-2 border-transparent pb-1.5 leading-none">
              Histórico
            </span>
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col gap-3 border-b py-4 md:flex-row md:items-center">
          <label
            htmlFor="demand-search"
            className="relative block w-full md:max-w-xl"
          >
            <span className="sr-only">
              Buscar por escola, rota ou caminhoneiro
            </span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="demand-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHistoryPage(1);
              }}
              placeholder="Buscar escola, rota ou caminhoneiro"
              className="h-11 rounded-xl bg-white pl-10 text-base md:text-sm"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFiltersOpen(true)}
            className="h-11 justify-center rounded-xl bg-white px-4 md:ml-auto"
          >
            <Filter aria-hidden="true" />
            Filtros
            {activeFilterCount > 0 ? (
              <span className="grid min-w-5 place-items-center rounded-md bg-[#17241f] px-1 py-0.5 text-[11px] text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>

        {query || activeFilterCount > 0 ? (
          <ActiveFilters
            query={query}
            filters={filters}
            onQueryChange={setQuery}
            onFiltersChange={(next) => {
              setFilters(next);
              setHistoryPage(1);
            }}
            onClear={clearFilters}
          />
        ) : null}

        <TabsContent value="atuais" className="pt-6">
          <CurrentDemands
            planningDemands={planningDemands}
            reviewDemands={reviewDemands}
            regularGroups={regularGroups}
            hasFilters={Boolean(query || activeFilterCount)}
            onClearFilters={clearFilters}
          />
        </TabsContent>

        <TabsContent value="historico" className="pt-6">
          <DemandHistory
            demands={paginatedHistory}
            totalResults={filteredHistory.length}
            currentPage={safeHistoryPage}
            totalPages={totalHistoryPages}
            onPageChange={setHistoryPage}
            hasFilters={Boolean(query || activeFilterCount)}
            onClearFilters={clearFilters}
          />
        </TabsContent>
      </Tabs>

      <DemandFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        view={view}
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setHistoryPage(1);
        }}
        onClear={() => {
          setFilters(emptyFilters);
          setHistoryPage(1);
        }}
      />
    </div>
  );
}

function CurrentDemands({
  planningDemands,
  reviewDemands,
  regularGroups,
  hasFilters,
  onClearFilters,
}: {
  planningDemands: DemandRecord[];
  reviewDemands: DemandRecord[];
  regularGroups: Array<[string, DemandRecord[]]>;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  const hasResults =
    planningDemands.length > 0 ||
    reviewDemands.length > 0 ||
    regularGroups.length > 0;

  if (!hasResults) {
    return (
      <EmptyDemands
        title="Nenhuma demanda encontrada"
        description="Não há demandas abertas que correspondam à sua busca."
        actionLabel={hasFilters ? 'Limpar filtros' : undefined}
        onAction={hasFilters ? onClearFilters : undefined}
      />
    );
  }

  return (
    <div className="space-y-8">
      {planningDemands.length > 0 ? (
        <section aria-labelledby="planning-title">
          <div className="overflow-hidden rounded-2xl border border-[#294738] bg-white shadow-[0_12px_35px_rgba(19,38,28,.08)]">
            <header className="flex flex-col gap-3 bg-[#17241f] px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#8fd266]">
                  <CalendarClock aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="planning-title" className="text-lg font-semibold">
                      Para planejar
                    </h2>
                    <span className="rounded-md bg-[#75b94d] px-2 py-0.5 text-xs font-semibold text-[#101510] tabular-nums">
                      {planningDemands.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/65">
                    Demandas dos cardápios que ainda precisam de rotas e
                    motoristas.
                  </p>
                </div>
              </div>
            </header>
            <div>
              {planningDemands.map((demand) => (
                <PlanningDemandItem key={demand.id} demand={demand} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {reviewDemands.length > 0 ? (
        <section aria-labelledby="review-title">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-5 text-alert" />
            <h2 id="review-title" className="text-lg font-semibold">
              Para revisar
            </h2>
            <span className="rounded-md bg-alert-soft px-2 py-0.5 text-xs font-semibold text-alert tabular-nums">
              {reviewDemands.length}
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-alert/20 bg-white">
            {reviewDemands.map((demand) => (
              <AttentionDemandItem key={demand.id} demand={demand} />
            ))}
          </div>
        </section>
      ) : null}

      {regularGroups.length > 0 ? (
        <section aria-labelledby="regular-title">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="size-5 text-primary" />
            <h2 id="regular-title" className="text-lg font-semibold">
              Planejadas e em andamento
            </h2>
          </div>
          <div className="space-y-5">
            {regularGroups.map(([label, demands]) => (
              <div key={label}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {label}
                </h3>
                <div className="overflow-hidden rounded-2xl border bg-white">
                  {demands.map((demand) => (
                    <RegularDemandItem key={demand.id} demand={demand} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PlanningDemandItem({ demand }: { demand: DemandRecord }) {
  return (
    <article className="grid gap-4 border-b p-4 last:border-b-0 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,.75fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{demand.school}</h3>
          <StatusPill tone="warning">Precisa planejar</StatusPill>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          {demand.dateGroup} · precisa chegar até {demand.deadline}
        </p>
        {demand.issue ? (
          <p className="mt-2 text-sm font-medium text-alert">
            {demand.issue.title}
          </p>
        ) : null}
      </div>
      <div className="rounded-xl bg-subtle px-4 py-3 text-sm">
        <p className="font-medium">{demand.menuLabel}</p>
        <p className="mt-1 text-muted-foreground">
          {demand.productCount}{' '}
          {demand.productCount === 1 ? 'produto' : 'produtos'} para buscar
        </p>
      </div>
      <Link
        href={`/demandas/${demand.id}/planejar`}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'h-11 w-full rounded-xl bg-[#245f0a] px-4 lg:w-auto',
        )}
      >
        Planejar demanda
        <ArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}

function AttentionDemandItem({ demand }: { demand: DemandRecord }) {
  const action = demandAction(demand);

  return (
    <article className="grid gap-4 border-b border-alert/15 p-4 last:border-b-0 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,.9fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{demand.school}</h3>
          <StatusPill tone="danger">{demand.status}</StatusPill>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          {demand.dateGroup} · até {demand.deadline}
        </p>
        <p className="mt-3 font-medium text-foreground">
          {demand.issue?.title}
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
          {demand.issue?.description}
        </p>
      </div>
      <DemandCoverage demand={demand} />
      <Link
        href={action.href}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'h-11 w-full rounded-xl bg-[#245f0a] px-4 lg:w-auto',
        )}
      >
        {demand.issue?.actionLabel ?? action.label}
        <ArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}

function RegularDemandItem({ demand }: { demand: DemandRecord }) {
  const action = demandAction(demand);
  const drivers = demand.routes.map((route) => route.driver).join(' e ');

  return (
    <article className="grid gap-4 border-b p-4 last:border-b-0 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(190px,.8fr)_minmax(180px,.8fr)_auto] lg:items-center">
      <div className="min-w-0">
        <h4 className="font-semibold">{demand.school}</h4>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          Até {demand.deadline} · {demand.menuLabel.toLowerCase()}
        </p>
      </div>
      <div>
        <StatusPill tone={toneForStatus(demand.status)}>
          {demand.status}
        </StatusPill>
        <p className="mt-2 text-sm text-muted-foreground">
          {demand.coverage}% atendida
        </p>
      </div>
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <RouteIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-primary"
          />
          {demand.routes.length} {demand.routes.length === 1 ? 'rota' : 'rotas'}
        </p>
        <p className="mt-1 truncate text-muted-foreground">{drivers}</p>
      </div>
      <Link
        href={action.href}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'lg' }),
          'h-11 w-full rounded-xl px-4 lg:w-auto',
        )}
      >
        {action.icon === 'map' ? <MapPin aria-hidden="true" /> : null}
        {action.label}
        {action.icon !== 'map' ? <ArrowRight aria-hidden="true" /> : null}
      </Link>
    </article>
  );
}

function DemandCoverage({ demand }: { demand: DemandRecord }) {
  return (
    <div className="rounded-xl bg-subtle p-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Quantidade atendida</span>
        <strong className="tabular-nums">{demand.coverage}%</strong>
      </div>
      <progress
        className="mt-2 block h-2 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[#dfe6e2] [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
        aria-label={`${demand.coverage}% da demanda atendida`}
        max={100}
        value={demand.coverage}
      />
    </div>
  );
}

function DemandHistory({
  demands,
  totalResults,
  currentPage,
  totalPages,
  onPageChange,
  hasFilters,
  onClearFilters,
}: {
  demands: DemandRecord[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  if (demands.length === 0) {
    return (
      <EmptyDemands
        title="Nenhum registro encontrado"
        description="Não há demandas encerradas que correspondam à sua busca."
        actionLabel={hasFilters ? 'Limpar filtros' : undefined}
        onAction={hasFilters ? onClearFilters : undefined}
      />
    );
  }

  return (
    <section aria-labelledby="history-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="history-title" className="text-lg font-semibold">
            Histórico de demandas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalResults}{' '}
            {totalResults === 1
              ? 'registro encontrado'
              : 'registros encontrados'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Mais recentes primeiro</p>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-subtle text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Escola</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 font-medium">Cardápio</th>
              <th className="px-4 py-3 font-medium">Caminhoneiro</th>
              <th className="px-5 py-3">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {demands.map((demand) => (
              <tr key={demand.id} className="hover:bg-subtle/70">
                <td className="whitespace-nowrap px-5 py-4 font-medium">
                  {demand.dateLabel}
                </td>
                <td className="px-4 py-4 font-medium">{demand.school}</td>
                <td className="px-4 py-4">
                  <StatusPill tone={toneForStatus(demand.status)}>
                    {demand.status}
                  </StatusPill>
                </td>
                <td className="px-4 py-4">{demand.menuLabel}</td>
                <td className="px-4 py-4 text-muted-foreground">
                  {demand.routes.map((route) => route.driver).join(' e ') ||
                    '—'}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/demandas/${demand.id}`}
                    className="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Ver registro{' '}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {demands.map((demand) => (
          <article key={demand.id} className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{demand.school}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {demand.dateLabel}
                </p>
              </div>
              <StatusPill tone={toneForStatus(demand.status)}>
                {demand.status}
              </StatusPill>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-y py-3 text-sm">
              <div>
                <p className="text-muted-foreground">Cardápio</p>
                <p className="mt-1 font-medium">{demand.menuLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Caminhoneiro</p>
                <p className="mt-1 font-medium">
                  {demand.routes.map((route) => route.driver).join(' e ') ||
                    '—'}
                </p>
              </div>
            </div>
            <Link
              href={`/demandas/${demand.id}`}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 font-medium text-primary"
            >
              Ver registro <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </article>
        ))}
      </div>

      <HistoryPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </section>
  );
}

function HistoryPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginação do histórico"
      className="mt-4 flex items-center justify-end gap-2"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label="Página anterior"
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        className="rounded-xl bg-white"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span className="px-2 text-sm text-muted-foreground">
        Página <strong className="text-foreground">{currentPage}</strong> de{' '}
        {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label="Próxima página"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        className="rounded-xl bg-white"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

function ActiveFilters({
  query,
  filters,
  onQueryChange,
  onFiltersChange,
  onClear,
}: {
  query: string;
  filters: DemandFilters;
  onQueryChange: (value: string) => void;
  onFiltersChange: (filters: DemandFilters) => void;
  onClear: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b py-3"
      aria-label="Filtros ativos"
    >
      {query ? (
        <FilterChip
          label={`Busca: ${query}`}
          onRemove={() => onQueryChange('')}
        />
      ) : null}
      {filters.status !== 'Todas' ? (
        <FilterChip
          label={filters.status}
          onRemove={() => onFiltersChange({ ...filters, status: 'Todas' })}
        />
      ) : null}
      {filters.startDate ? (
        <FilterChip
          label={`A partir de ${formatShortDate(filters.startDate)}`}
          onRemove={() => onFiltersChange({ ...filters, startDate: '' })}
        />
      ) : null}
      {filters.endDate ? (
        <FilterChip
          label={`Até ${formatShortDate(filters.endDate)}`}
          onRemove={() => onFiltersChange({ ...filters, endDate: '' })}
        />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        onClick={onClear}
        className="h-9 rounded-lg px-3"
      >
        Limpar tudo
      </Button>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#e8eeea] pl-3 pr-1 text-sm font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-white hover:text-foreground"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </span>
  );
}

function DemandFiltersSheet({
  open,
  onOpenChange,
  view,
  filters,
  onChange,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: DemandView;
  filters: DemandFilters;
  onChange: (filters: DemandFilters) => void;
  onClear: () => void;
}) {
  const statusOptions: DemandStatus[] =
    view === 'atuais'
      ? [
          'Precisa planejar',
          'Precisa de revisão',
          'Planejada',
          'Em coleta',
          'Em entrega',
        ]
      : ['Concluída', 'Cancelada'];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(92vw,390px)] gap-0"
        showCloseButton
      >
        <SheetHeader className="border-b px-5 py-5 pr-14">
          <SheetTitle className="text-xl font-semibold">
            Filtrar demandas
          </SheetTitle>
          <SheetDescription>
            Use apenas os filtros necessários para esta consulta.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <Label htmlFor="demand-status">Situação</Label>
            <NativeSelect
              id="demand-status"
              value={filters.status}
              onChange={(event) =>
                onChange({
                  ...filters,
                  status: event.target.value as DemandFilters['status'],
                })
              }
              className="mt-2 w-full"
            >
              <NativeSelectOption value="Todas">Todas</NativeSelectOption>
              {statusOptions.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {status}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="demand-start-date">Data inicial</Label>
            <Input
              id="demand-start-date"
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                onChange({ ...filters, startDate: event.target.value })
              }
              className="mt-2 h-11 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="demand-end-date">Data final</Label>
            <Input
              id="demand-end-date"
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                onChange({ ...filters, endDate: event.target.value })
              }
              className="mt-2 h-11 rounded-xl"
            />
          </div>
        </div>
        <SheetFooter className="border-t p-5">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-xl bg-[#245f0a]"
          >
            Mostrar resultados
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-11 rounded-xl"
          >
            Limpar filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function EmptyDemands({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border bg-white p-6 text-center">
      <div className="max-w-sm">
        <ClipboardCheck
          aria-hidden="true"
          className="mx-auto size-9 text-primary"
        />
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {actionLabel && onAction ? (
          <Button
            type="button"
            variant="outline"
            onClick={onAction}
            className="mt-4 h-11 rounded-xl"
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function matchesFilters(
  demand: DemandRecord,
  query: string,
  filters: DemandFilters,
) {
  const normalizedQuery = normalize(query);
  const searchable = normalize(
    [
      demand.school,
      demand.status,
      demand.issue?.title,
      demand.issue?.description,
      ...demand.routes.flatMap((route) => [route.name, route.driver]),
    ]
      .filter(Boolean)
      .join(' '),
  );

  return (
    (!normalizedQuery || searchable.includes(normalizedQuery)) &&
    (filters.status === 'Todas' || demand.status === filters.status) &&
    (!filters.startDate || demand.date >= filters.startDate) &&
    (!filters.endDate || demand.date <= filters.endDate)
  );
}

function groupByDate(demands: DemandRecord[]) {
  const groups = new Map<string, DemandRecord[]>();
  demands.forEach((demand) => {
    const current = groups.get(demand.dateGroup) ?? [];
    current.push(demand);
    groups.set(demand.dateGroup, current);
  });
  return Array.from(groups.entries());
}

function sortByDeadline(demands: DemandRecord[]) {
  return [...demands].sort((first, second) =>
    `${first.date}T${first.deadline}`.localeCompare(
      `${second.date}T${second.deadline}`,
    ),
  );
}

function demandAction(demand: DemandRecord) {
  if (demand.issue) {
    return {
      label: demand.issue.actionLabel,
      href: `/demandas/${demand.id}/planejar`,
      icon: 'arrow' as const,
    };
  }
  if (demand.status === 'Em coleta' || demand.status === 'Em entrega') {
    return {
      label: 'Ver no mapa',
      href: demand.routes[0]
        ? `/gestor?rota=${demand.routes[0].id}`
        : '/gestor',
      icon: 'map' as const,
    };
  }
  return {
    label: 'Ver planejamento',
    href: `/demandas/${demand.id}`,
    icon: 'arrow' as const,
  };
}

function toneForStatus(status: DemandStatus) {
  if (status === 'Concluída' || status === 'Planejada')
    return 'success' as const;
  if (status === 'Em coleta' || status === 'Em entrega') return 'live' as const;
  if (status === 'Precisa planejar' || status === 'Precisa de revisão') {
    return 'danger' as const;
  }
  return 'neutral' as const;
}

function countFilters(filters: DemandFilters) {
  return (
    Number(filters.status !== 'Todas') +
    Number(Boolean(filters.startDate)) +
    Number(Boolean(filters.endDate))
  );
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
