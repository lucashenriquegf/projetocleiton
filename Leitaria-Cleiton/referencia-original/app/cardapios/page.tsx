'use client';

import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Plus,
  Replace,
  Search,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { StatusPill } from '@/components/system/status-pill';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { schoolMenus } from '@/lib/mocks/menus';
import { cn } from '@/lib/utils';

export default function MenusPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const visible = useMemo(
    () =>
      schoolMenus.filter(
        (menu) =>
          menu.school.toLowerCase().includes(query.toLowerCase()) &&
          (status === 'Todos' || menu.status === status),
      ),
    [query, status],
  );

  return (
    <ManagerShell>
      <PageFrame
        eyebrow="Planejamento das escolas"
        title="Cardápios"
        description="Consulte o cardápio de cada dia e as substituições cadastradas pela nutricionista."
        action={
          <Link
            href="/cardapios/novo"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-11 rounded-none bg-[#245f0a] px-4',
            )}
          >
            <Plus aria-hidden="true" /> Novo cardápio
          </Link>
        }
      >
        <div className="grid gap-3 border-b pb-5 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative max-w-md">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar escola"
              aria-label="Buscar cardápio por escola"
              className="h-11 rounded-none bg-white pl-10"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filtrar por situação"
            className="h-11 border border-input bg-white px-3 text-sm"
          >
            <option>Todos</option>
            <option>Aprovado</option>
            <option>Em revisão</option>
            <option>Rascunho</option>
          </select>
        </div>
        <section className="mt-5 border bg-white">
          <header className="border-b px-5 py-4">
            <h2 className="font-semibold">Cardápios por escola e mês</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {visible.length} resultados
            </p>
          </header>
          <ul className="divide-y">
            {visible.map((menu) => (
              <li key={menu.id}>
                <Link
                  href="/cardapios/joao-paulo"
                  className="group grid gap-4 p-5 hover:bg-subtle lg:grid-cols-[minmax(0,1.35fr)_1fr_190px_150px_auto] lg:items-center"
                >
                  <div>
                    <h3 className="font-semibold">{menu.school}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {menu.city} · {menu.month}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserRound aria-hidden="true" className="size-3.5" />
                      Nutricionista
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {menu.nutritionist}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays aria-hidden="true" className="size-3.5" />
                      Preenchimento
                    </p>
                    <p className="mt-1 text-sm font-medium tabular-nums">
                      {menu.filledDays} de {menu.totalDays} dias
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Replace aria-hidden="true" className="size-3.5" />
                      {menu.substitutionCount} substituições
                    </p>
                  </div>
                  <div className="space-y-2">
                    <StatusPill
                      tone={
                        menu.status === 'Aprovado'
                          ? 'success'
                          : menu.status === 'Em revisão'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {menu.status}
                    </StatusPill>
                    {menu.pendingChanges ? (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-[#765d12]">
                        <AlertTriangle
                          aria-hidden="true"
                          className="size-3.5"
                        />
                        {menu.pendingChanges} troca aguardando
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </PageFrame>
    </ManagerShell>
  );
}
