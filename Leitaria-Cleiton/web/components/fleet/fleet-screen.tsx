'use client';

import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Link2,
  Phone,
  Plus,
  Route,
  Search,
  Truck,
  Unlink,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { StatusPill } from '@/components/system/status-pill';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FleetAssignment } from '@/lib/domain';
import { cn } from '@/lib/utils';

type FleetResult = {
  items: FleetAssignment[];
  total: number;
  page: number;
  pageSize: number;
  unassignedVehicles: number;
  unassignedDrivers: number;
};

const emptyResult: FleetResult = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  unassignedVehicles: 0,
  unassignedDrivers: 0,
};

const filterKeys = ['busca', 'situacao', 'motorista', 'veiculo', 'base', 'inicio', 'fim'] as const;

export function FleetScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get('visao') === 'historico' ? 'historico' : 'atuais';
  const queryString = searchParams.toString();
  const [result, setResult] = useState<FleetResult>(emptyResult);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [unlinking, setUnlinking] = useState<FleetAssignment | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetch(`/api/fleet?${queryString}`)
      .then(async (response) => {
        const data = (await response.json()) as FleetResult & { message?: string };
        if (!response.ok) throw new Error(data.message ?? 'Não foi possível carregar a frota.');
        return data;
      })
      .then((data) => { if (active) setResult(data); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a frota.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryString, revision]);

  function setParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    if (!Object.prototype.hasOwnProperty.call(changes, 'pagina')) next.delete('pagina');
    const nextQuery = next.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  function clearFilters() {
    setParams(Object.fromEntries(filterKeys.map((key) => [key, null])));
  }

  async function unlink() {
    if (!unlinking) return;
    try {
      const response = await fetch(`/api/fleet/${unlinking.id}`, { method: 'DELETE' });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? 'Não foi possível desvincular.');
      setUnlinking(null);
      setRevision((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível desvincular.');
      setUnlinking(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const activeFilters = getActiveFilters(searchParams, view);
  const savedMessage = getSavedMessage(searchParams.get('salvo'));

  return (
    <ManagerShell>
      <PageFrame
        eyebrow="Cadastros"
        title="Frota"
        description="Veja quem está responsável por cada veículo e consulte todas as trocas anteriores."
        backHref="/cadastros"
        action={(
          <Link
            href="/cadastros/frota/novo"
            className={cn(buttonVariants({ size: 'lg' }), 'h-11 w-full rounded-none bg-[#245f0a] sm:w-auto')}
          >
            <Plus aria-hidden="true" /> Novo vínculo
          </Link>
        )}
        wide
      >
        {savedMessage ? (
          <output className="mb-4 flex min-h-12 items-center gap-3 border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">
            <Link2 aria-hidden="true" className="size-5 shrink-0" />
            <strong>{savedMessage}</strong>
          </output>
        ) : null}

        <section className="border bg-white">
          <nav aria-label="Visões da frota" className="flex border-b px-4 sm:px-5">
            <ViewButton active={view === 'atuais'} label="Vínculos atuais" count={view === 'atuais' ? result.total : undefined} onClick={() => setParams({ visao: null })} />
            <ViewButton active={view === 'historico'} label="Histórico" count={view === 'historico' ? result.total : undefined} onClick={() => setParams({ visao: 'historico' })} />
          </nav>

          {view === 'atuais' ? (
            <div className="grid border-b bg-subtle sm:grid-cols-2">
              <Summary icon={Truck} value={result.unassignedVehicles} label="veículos sem motorista" />
              <Summary icon={UserRound} value={result.unassignedDrivers} label="motoristas sem veículo" />
            </div>
          ) : null}

          <div className="border-b p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4 md:hidden">
              <div>
                <p className="font-semibold">Busca e filtros</p>
                <p className="mt-1 text-sm text-muted-foreground">{activeFilters.length} {activeFilters.length === 1 ? 'filtro ativo' : 'filtros ativos'}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setFiltersOpen((current) => !current)} className="h-11 cursor-pointer rounded-none">
                <Filter aria-hidden="true" /> {filtersOpen ? 'Ocultar' : 'Filtrar'}
              </Button>
            </div>

            <div className={cn('mt-4 grid gap-4 md:mt-0 md:grid md:grid-cols-2 xl:grid-cols-4', !filtersOpen && 'hidden md:grid')}>
              <TextFilter
                label="Busca geral"
                value={searchParams.get('busca') ?? ''}
                placeholder="Motorista, telefone, placa, modelo ou rota"
                icon={Search}
                className="md:col-span-2"
                onChange={(value) => setParams({ busca: value || null })}
              />
              <SelectFilter label="Situação" value={searchParams.get('situacao') ?? ''} onChange={(value) => setParams({ situacao: value || null })}>
                <option value="">Todas</option>
                <option value="NO_ROUTE">Sem rota</option>
                <option value="ON_ROUTE">Em rota</option>
              </SelectFilter>
              <SelectFilter label="Por página" value={searchParams.get('porPagina') ?? '10'} onChange={(value) => setParams({ porPagina: value })}>
                <option value="10">10 registros</option>
                <option value="25">25 registros</option>
                <option value="50">50 registros</option>
              </SelectFilter>
              <TextFilter label="Motorista" value={searchParams.get('motorista') ?? ''} placeholder="Buscar pelo nome" onChange={(value) => setParams({ motorista: value || null })} />
              <TextFilter label="Veículo" value={searchParams.get('veiculo') ?? ''} placeholder="Placa ou modelo" onChange={(value) => setParams({ veiculo: value || null })} />
              <TextFilter label="Base" value={searchParams.get('base') ?? ''} placeholder="Nome da base" onChange={(value) => setParams({ base: value || null })} />
              {view === 'historico' ? (
                <>
                  <TextFilter label="Data inicial" type="date" value={searchParams.get('inicio') ?? ''} onChange={(value) => setParams({ inicio: value || null })} />
                  <TextFilter label="Data final" type="date" value={searchParams.get('fim') ?? ''} onChange={(value) => setParams({ fim: value || null })} />
                </>
              ) : <div className="hidden xl:block" aria-hidden="true" />}
            </div>

            {activeFilters.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {activeFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setParams({ [filter.key]: null })}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 border bg-subtle px-3 text-sm font-medium hover:border-primary"
                    aria-label={`Remover filtro ${filter.label}`}
                  >
                    {filter.label}: {filter.value}<X aria-hidden="true" className="size-3.5" />
                  </button>
                ))}
                <button type="button" onClick={clearFilters} className="min-h-9 cursor-pointer px-2 text-sm font-semibold text-primary hover:underline">
                  Limpar filtros
                </button>
              </div>
            ) : null}
          </div>

          {error ? <div role="alert" className="border-b border-alert/25 bg-alert-soft p-5 text-sm font-medium text-alert">{error}</div> : null}
          {loading ? <div className="p-8 text-sm text-muted-foreground">Carregando frota…</div> : null}
          {!loading && !error && result.items.length === 0 ? (
            <div className="p-8 text-center">
              <Link2 aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-semibold">Nenhum vínculo encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">Crie um vínculo ou revise os filtros.</p>
            </div>
          ) : null}

          {!loading && result.items.length > 0 ? (
            <>
              <div className="hidden min-[1400px]:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead className="border-b bg-subtle text-sm text-muted-foreground">
                    <tr>
                      <Th className="w-[19%]">Veículo</Th>
                      <Th className="w-[19%]">Motorista</Th>
                      <Th className="w-[21%]">Bases</Th>
                      <Th className="w-[19%]">Vínculo e rota</Th>
                      <Th className="w-[10%]">Situação</Th>
                      <Th className="w-[12%] text-right">Ações</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.items.map((assignment) => (
                      <FleetTableRow key={assignment.id} assignment={assignment} onUnlink={setUnlinking} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y min-[1400px]:hidden">
                {result.items.map((assignment) => (
                  <FleetCard key={assignment.id} assignment={assignment} onUnlink={setUnlinking} />
                ))}
              </div>
            </>
          ) : null}

          <footer className="flex flex-col gap-3 border-t bg-subtle px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">{result.total} {result.total === 1 ? 'registro' : 'registros'}</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={result.page <= 1} onClick={() => setParams({ pagina: String(result.page - 1) })} className="grid size-11 cursor-pointer place-items-center border bg-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior"><ChevronLeft aria-hidden="true" className="size-5" /></button>
              <span className="px-2 font-medium">Página {result.page} de {pageCount}</span>
              <button type="button" disabled={result.page >= pageCount} onClick={() => setParams({ pagina: String(result.page + 1) })} className="grid size-11 cursor-pointer place-items-center border bg-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Próxima página"><ChevronRight aria-hidden="true" className="size-5" /></button>
            </div>
          </footer>
        </section>

        <AlertDialog open={Boolean(unlinking)} onOpenChange={(open) => { if (!open) setUnlinking(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desvincular motorista e veículo?</AlertDialogTitle>
              <AlertDialogDescription>{unlinking ? `${unlinking.driverName} deixará de ser responsável pelo veículo ${unlinking.vehiclePlate}. O vínculo continuará no histórico.` : ''}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => void unlink()} className="bg-alert hover:bg-alert/90">Desvincular</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageFrame>
    </ManagerShell>
  );
}

function FleetTableRow({ assignment, onUnlink }: { assignment: FleetAssignment; onUnlink: (assignment: FleetAssignment) => void }) {
  const active = !assignment.endedAt;
  return (
    <tr className="align-top hover:bg-[#fafcfa]">
      <Td><strong className="block break-words">{assignment.vehicleLabel}</strong><span className="mt-1 block text-sm font-medium text-primary">{assignment.vehiclePlate}</span></Td>
      <Td><strong className="block break-words">{assignment.driverName}</strong><span className="mt-1 flex items-center gap-1.5 break-words text-sm text-muted-foreground"><Phone aria-hidden="true" className="size-3.5 shrink-0" />{assignment.driverPhone ?? 'Telefone não informado'}</span></Td>
      <Td><p className="flex items-start gap-2 text-sm"><Truck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="break-words">{assignment.vehicleBase}</span></p><p className="mt-2 flex items-start gap-2 text-sm"><UserRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="break-words">{assignment.driverBase}</span></p>{assignment.distanceKm != null ? <p className="mt-2 text-xs text-muted-foreground">{formatNumber(assignment.distanceKm)} km entre as bases</p> : null}</Td>
      <Td><p className="flex items-start gap-2 text-sm"><CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{assignment.endedAt ? `Encerrado em ${formatDateTime(assignment.endedAt)}` : `Desde ${formatDateTime(assignment.startedAt)}`}</span></p>{assignment.activeRouteName ? <p className="mt-3 flex items-start gap-2 break-words text-sm font-medium text-primary"><Route aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{assignment.activeRouteName}</p> : <p className="mt-3 text-sm text-muted-foreground">Sem rota em andamento</p>}</Td>
      <Td><FleetStatus assignment={assignment} /></Td>
      <Td className="text-right">{active ? <div className="inline-flex flex-col items-stretch gap-2"><Link href={`/cadastros/frota/${assignment.id}`} className={cn(buttonVariants({ variant: 'outline' }), 'h-10 rounded-none px-3')}>{assignment.activeRouteId ? 'Transferir' : 'Trocar'}</Link><button type="button" onClick={() => onUnlink(assignment)} className="min-h-10 cursor-pointer px-2 text-sm font-semibold text-alert hover:underline"><Unlink aria-hidden="true" className="mr-1.5 inline size-4" />Desvincular</button></div> : <span className="text-sm text-muted-foreground">—</span>}</Td>
    </tr>
  );
}

function FleetCard({ assignment, onUnlink }: { assignment: FleetAssignment; onUnlink: (assignment: FleetAssignment) => void }) {
  const active = !assignment.endedAt;
  return (
    <article className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center bg-primary-soft text-primary"><Truck aria-hidden="true" className="size-5" /></span><div className="min-w-0"><p className="font-semibold break-words">{assignment.vehicleLabel}</p><p className="mt-1 text-sm font-medium text-primary">{assignment.vehiclePlate}</p></div></div>
        <FleetStatus assignment={assignment} />
      </div>
      <div className="mt-5 grid gap-5 border-y py-5 sm:grid-cols-2 lg:grid-cols-3">
        <Info title="Motorista"><p className="font-medium">{assignment.driverName}</p><p className="mt-1 text-sm text-muted-foreground">{assignment.driverPhone ?? 'Telefone não informado'}</p></Info>
        <Info title="Bases"><p className="break-words">{assignment.vehicleBase}</p><p className="mt-1 break-words text-sm text-muted-foreground">Motorista: {assignment.driverBase}</p>{assignment.distanceKm != null ? <p className="mt-1 text-xs text-muted-foreground">{formatNumber(assignment.distanceKm)} km de distância</p> : null}</Info>
        <Info title="Vínculo e rota"><p>{assignment.endedAt ? `Encerrado em ${formatDateTime(assignment.endedAt)}` : `Desde ${formatDateTime(assignment.startedAt)}`}</p><p className={cn('mt-1 break-words text-sm', assignment.activeRouteName ? 'font-medium text-primary' : 'text-muted-foreground')}>{assignment.activeRouteName ?? 'Sem rota em andamento'}</p></Info>
      </div>
      {active ? <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><Link href={`/cadastros/frota/${assignment.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-none')}>{assignment.activeRouteId ? 'Transferir responsabilidade' : 'Trocar vínculo'}</Link><Button type="button" variant="ghost" onClick={() => onUnlink(assignment)} className="h-11 cursor-pointer rounded-none text-alert"><Unlink aria-hidden="true" />Desvincular</Button></div> : null}
    </article>
  );
}

function FleetStatus({ assignment }: { assignment: FleetAssignment }) {
  if (assignment.endedAt) return <StatusPill tone="neutral">Encerrado</StatusPill>;
  return <StatusPill tone={assignment.activeRouteId ? 'warning' : 'success'}>{assignment.activeRouteId ? 'Em rota' : 'Sem rota'}</StatusPill>;
}

function FilterField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={cn('flex min-w-0 flex-col', className)}><span className="flex min-h-6 items-end text-sm font-semibold">{label}</span><span className="mt-2 block">{children}</span></label>;
}

function TextFilter({ label, value, onChange, placeholder = '', type = 'text', icon: Icon, className }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; icon?: typeof Search; className?: string }) {
  return <FilterField label={label} className={className}><span className="relative block">{Icon ? <Icon aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /> : null}<Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cn('h-11 rounded-none', Icon && 'pl-10')} /></span></FilterField>;
}

function SelectFilter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <FilterField label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full cursor-pointer border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">{children}</select></FilterField>;
}

function ViewButton({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn('relative flex min-h-14 cursor-pointer items-center gap-2 px-3 text-sm font-semibold sm:px-4', active ? 'text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary' : 'text-muted-foreground hover:text-foreground')}>{label}{count != null ? <span className="inline-grid min-w-6 place-items-center bg-subtle px-1.5 py-0.5 text-xs tabular-nums">{count}</span> : null}</button>;
}

function Summary({ icon: Icon, value, label }: { icon: typeof Truck; value: number; label: string }) {
  return <div className="flex min-h-16 items-center gap-3 border-b px-5 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /><p><strong className="mr-1.5 text-lg tabular-nums">{value}</strong><span className="text-sm text-muted-foreground">{label}</span></p></div>;
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p><div className="text-sm">{children}</div></div>;
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) { return <th className={cn('px-5 py-3 font-semibold', className)}>{children}</th>; }
function Td({ children, className }: { children: React.ReactNode; className?: string }) { return <td className={cn('px-5 py-5', className)}>{children}</td>; }

function getActiveFilters(searchParams: URLSearchParams, view: string) {
  const labels: Record<string, string> = { busca: 'Busca', situacao: 'Situação', motorista: 'Motorista', veiculo: 'Veículo', base: 'Base', inicio: 'Desde', fim: 'Até' };
  const statusLabels: Record<string, string> = { NO_ROUTE: 'Sem rota', ON_ROUTE: 'Em rota' };
  return filterKeys.flatMap((key) => {
    if (view !== 'historico' && (key === 'inicio' || key === 'fim')) return [];
    const value = searchParams.get(key);
    return value ? [{ key, label: labels[key], value: key === 'situacao' ? statusLabels[value] ?? value : value }] : [];
  });
}

function getSavedMessage(value: string | null) {
  if (value === 'criado') return 'Vínculo criado com sucesso.';
  if (value === 'transferido') return 'Responsabilidade da rota transferida com sucesso.';
  if (value === 'alterado') return 'Vínculo atualizado com sucesso.';
  return '';
}

function formatDateTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
function formatNumber(value: number) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value); }
