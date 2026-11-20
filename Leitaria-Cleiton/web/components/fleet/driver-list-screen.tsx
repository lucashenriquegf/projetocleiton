'use client';

import { MapPin, Phone, Plus, Search, Truck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { StatusPill } from '@/components/system/status-pill';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DriverRecord } from '@/lib/domain';
import { cn } from '@/lib/utils';

export function DriverListScreen() {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let mounted = true; void fetch('/api/drivers').then(async (response) => { const body = await response.json() as { items: DriverRecord[]; message?: string }; if (!response.ok) throw new Error(body.message); return body; }).then((body) => { if (mounted) setDrivers(body.items); }).catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os motoristas.'); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase('pt-BR'); return drivers.filter((driver) => (!needle || `${driver.name} ${driver.phone} ${driver.baseName} ${driver.currentVehiclePlate}`.toLocaleLowerCase('pt-BR').includes(needle)) && (!status || (status === 'ACTIVE' ? driver.active : !driver.active))); }, [drivers, query, status]);
  return <ManagerShell><PageFrame eyebrow="Cadastros" title="Caminhoneiros" description="Contatos, bases de referência e veículos atualmente sob responsabilidade de cada motorista." backHref="/cadastros" action={<Link href="/cadastros/caminhoneiros/novo" className={cn(buttonVariants({ size: 'lg' }), 'h-11 w-full rounded-none bg-[#245f0a] sm:w-auto')}><Plus aria-hidden="true" /> Novo caminhoneiro</Link>} wide>
    <section className="border bg-white"><header className="grid gap-3 border-b p-4 sm:grid-cols-[minmax(240px,1fr)_220px] sm:p-5"><label className="relative"><span className="sr-only">Buscar motoristas</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, telefone, base ou placa" className="h-11 rounded-none pl-10" /></label><label><span className="sr-only">Filtrar situação</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 w-full cursor-pointer border bg-white px-3 text-sm"><option value="">Todos</option><option value="ACTIVE">Ativos</option><option value="INACTIVE">Inativos</option></select></label></header>
      {error ? <div role="alert" className="p-5 text-sm font-medium text-alert">{error}</div> : null}{loading ? <div className="p-8 text-sm text-muted-foreground">Carregando motoristas…</div> : null}
      {!loading ? <div className="divide-y">{filtered.map((driver) => <article key={driver.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center bg-primary-soft text-primary"><UserRound aria-hidden="true" className="size-5" /></span><div><Link href={`/cadastros/caminhoneiros/${driver.id}`} className="font-semibold text-primary hover:underline">{driver.name}</Link><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Phone aria-hidden="true" className="size-4" />{driver.phone}</p><p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{driver.baseName ?? 'Base não informada'}</p></div></div><div className="flex items-start gap-3"><Truck aria-hidden="true" className="mt-0.5 size-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Veículo atual</p><p className="mt-1 font-medium">{driver.currentVehicleLabel ?? 'Sem veículo'}</p>{driver.currentVehiclePlate ? <p className="mt-1 text-sm text-muted-foreground">{driver.currentVehiclePlate}</p> : null}</div></div><div className="flex items-center gap-3"><StatusPill tone={driver.active ? driver.activeRouteId ? 'warning' : 'success' : 'neutral'}>{driver.active ? driver.activeRouteId ? 'Em rota' : 'Ativo' : 'Inativo'}</StatusPill><Link href={`/cadastros/caminhoneiros/${driver.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-none')}>Ver cadastro</Link></div></article>)}</div> : null}
      {!loading && filtered.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum motorista encontrado.</div> : null}
    </section>
  </PageFrame></ManagerShell>;
}
