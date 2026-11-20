'use client';

import { Archive, ChevronLeft, ChevronRight, Plus, Search, Truck, UserRound, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { StatusPill } from '@/components/system/status-pill';
import { buttonVariants } from '@/components/ui/button';
import type { Vehicle } from '@/lib/domain';
import { cn } from '@/lib/utils';

type VehicleResult = { items: Vehicle[]; total: number; activeTotal?: number; page: number; pageSize: number };

export function VehicleListScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<VehicleResult>({ items: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const queryString = searchParams.toString();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetch(`/api/vehicles${queryString ? `?${queryString}` : ''}`)
      .then(async (response) => {
        const data = (await response.json()) as VehicleResult & { message?: string };
        if (!response.ok) throw new Error(data.message ?? 'Não foi possível carregar os veículos.');
        return data;
      })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os veículos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [queryString]);

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value); else next.delete(name);
    if (name !== 'pagina') next.delete('pagina');
    const nextQuery = next.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <ManagerShell>
      <PageFrame
        eyebrow="Cadastros"
        title="Veículos"
        description="Consulte capacidade, situação, motorista e base dos veículos usados nas rotas."
        backHref="/cadastros"
        action={<Link href="/cadastros/veiculos/novo" className={cn(buttonVariants({ size: 'lg' }), 'h-11 w-full rounded-none bg-[#245f0a] sm:w-auto')}><Plus aria-hidden="true" /> Novo veículo</Link>}
        wide
      >
        <section className="border bg-white">
          <header className="grid gap-3 border-b p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(250px,1.5fr)_repeat(4,minmax(140px,1fr))] md:p-5">
            <label className="relative">
              <span className="sr-only">Buscar veículos</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <input value={searchParams.get('busca') ?? ''} onChange={(event) => setParam('busca', event.target.value)} placeholder="Buscar placa, modelo, motorista ou base" className="h-11 w-full border bg-white pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            </label>
            <Filter label="Tipo" value={searchParams.get('categoria') ?? ''} onChange={(value) => setParam('categoria', value)} options={[['', 'Todos os tipos'], ['CAR', 'Carro'], ['UTILITY', 'Utilitário / picape'], ['VAN', 'Van'], ['TRUCK', 'Caminhão']]} />
            <Filter label="Tração" value={searchParams.get('tracao') ?? ''} onChange={(value) => setParam('tracao', value)} options={[['', 'Todas as trações'], ['4X2', '4x2'], ['4X4', '4x4'], ['6X2', '6x2'], ['6X4', '6x4'], ['OTHER', 'Outra']]} />
            <Filter label="Situação" value={searchParams.get('situacao') ?? ''} onChange={(value) => setParam('situacao', value)} options={[['', 'Todas as situações'], ['AVAILABLE', 'Disponível'], ['ON_ROUTE', 'Em rota'], ['MAINTENANCE', 'Em manutenção'], ['INACTIVE', 'Arquivado']]} />
            <label><span className="sr-only">Filtrar por base</span><input value={searchParams.get('base') ?? ''} onChange={(event) => setParam('base', event.target.value)} placeholder="Qualquer base" className="h-11 w-full border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
          </header>

          {error ? <div role="alert" className="border-b border-alert/25 bg-alert-soft p-5 text-sm font-medium text-alert">{error}</div> : null}
          {loading ? <div className="p-8 text-sm text-muted-foreground">Carregando veículos…</div> : null}
          {!loading && !error && result.items.length === 0 ? <div className="p-8 text-center"><Truck aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-semibold">Nenhum veículo encontrado</p><p className="mt-1 text-sm text-muted-foreground">Revise a busca ou cadastre um novo veículo.</p></div> : null}

          {!loading && result.items.length ? (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-subtle text-muted-foreground"><tr><Th>Veículo</Th><Th>Tipo e capacidade</Th><Th>Motorista atual</Th><Th>Base</Th><Th>Situação</Th><Th><span className="sr-only">Ações</span></Th></tr></thead>
                  <tbody className="divide-y">
                    {result.items.map((vehicle) => <VehicleRow key={vehicle.id} vehicle={vehicle} />)}
                  </tbody>
                </table>
              </div>
              <div className="divide-y lg:hidden">
                {result.items.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
              </div>
            </>
          ) : null}

          <footer className="flex flex-col gap-3 border-t bg-subtle px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">{result.total} {result.total === 1 ? 'veículo encontrado' : 'veículos encontrados'}</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={result.page <= 1} onClick={() => setParam('pagina', String(result.page - 1))} className="grid size-11 cursor-pointer place-items-center border bg-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior"><ChevronLeft aria-hidden="true" className="size-5" /></button>
              <span className="px-2 font-medium">Página {result.page} de {pageCount}</span>
              <button type="button" disabled={result.page >= pageCount} onClick={() => setParam('pagina', String(result.page + 1))} className="grid size-11 cursor-pointer place-items-center border bg-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Próxima página"><ChevronRight aria-hidden="true" className="size-5" /></button>
            </div>
          </footer>
        </section>
      </PageFrame>
    </ManagerShell>
  );
}

function VehicleRow({ vehicle }: { vehicle: Vehicle }) {
  const status = getStatus(vehicle);
  return <tr className="hover:bg-[#fafcfa]"><Td><Link href={`/cadastros/veiculos/${vehicle.id}`} className="block min-h-11 cursor-pointer py-1 font-semibold text-primary hover:underline">{vehicle.manufacturer} {vehicle.model}<span className="mt-1 block text-sm font-normal text-muted-foreground">{vehicle.plate}{vehicle.internalCode ? ` · ${vehicle.internalCode}` : ''}</span></Link></Td><Td>{categoryLabel[vehicle.category]} · {vehicle.traction}<span className="mt-1 block text-muted-foreground">{formatNumber(vehicle.capacityKg)} kg · {formatNumber(vehicle.capacityM3)} m³</span></Td><Td>{vehicle.currentDriverName ? <><span className="font-medium">{vehicle.currentDriverName}</span><span className="mt-1 block text-muted-foreground">{vehicle.currentDriverPhone}</span></> : <span className="text-muted-foreground">Sem motorista</span>}</Td><Td><span className="block max-w-56 break-words">{vehicle.baseName ?? 'Não informada'}</span></Td><Td><StatusPill tone={status.tone}>{status.label}</StatusPill>{vehicle.activeRouteName ? <span className="mt-2 block max-w-48 text-xs text-muted-foreground">{vehicle.activeRouteName}</span> : null}</Td><Td><Link href={`/cadastros/veiculos/${vehicle.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 cursor-pointer rounded-none')}>Ver detalhes</Link></Td></tr>;
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const status = getStatus(vehicle);
  return <article className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{vehicle.manufacturer} {vehicle.model}</h2><p className="mt-1 text-sm text-muted-foreground">{vehicle.plate} · {categoryLabel[vehicle.category]}</p></div><StatusPill tone={status.tone}>{status.label}</StatusPill></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><Info icon={UserRound} label="Motorista" value={vehicle.currentDriverName ?? 'Sem motorista'} /><Info icon={Truck} label="Capacidade" value={`${formatNumber(vehicle.capacityKg)} kg · ${formatNumber(vehicle.capacityM3)} m³`} /><Info icon={Wrench} label="Tração" value={vehicle.traction} /><Info icon={Archive} label="Base" value={vehicle.baseName ?? 'Não informada'} /></dl><Link href={`/cadastros/veiculos/${vehicle.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'mt-5 h-11 w-full cursor-pointer rounded-none')}>Ver detalhes</Link></article>;
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full cursor-pointer border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
function Th({ children }: { children: React.ReactNode }) { return <th className="px-5 py-3 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-5 py-4 align-middle">{children}</td>; }
function Info({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) { return <div className="flex items-start gap-2"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words font-medium">{value}</dd></div></div>; }
function formatNumber(value: number) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value); }

const categoryLabel = { CAR: 'Carro', UTILITY: 'Utilitário / picape', VAN: 'Van', TRUCK: 'Caminhão' } as const;
function getStatus(vehicle: Vehicle): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (!vehicle.active) return { label: 'Arquivado', tone: 'neutral' };
  if (vehicle.activeRouteId) return { label: 'Em rota', tone: 'warning' };
  if (vehicle.operationalStatus === 'MAINTENANCE') return { label: 'Em manutenção', tone: 'danger' };
  return { label: 'Disponível', tone: 'success' };
}
