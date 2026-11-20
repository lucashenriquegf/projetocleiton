'use client';

import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { LogisticsRoute } from '@/lib/mocks/operations';
import { cn } from '@/lib/utils';

export type RouteStatusFilter =
  | Exclude<LogisticsRoute['status'], 'Concluída'>
  | 'Todas';

export type RouteFilterState = {
  query: string;
  status: RouteStatusFilter;
};

export const initialRouteFilters: RouteFilterState = {
  query: '',
  status: 'Em andamento',
};

const statusOptions: Array<{ value: RouteStatusFilter; label: string }> = [
  { value: 'Todas', label: 'Todas' },
  { value: 'Em andamento', label: 'Em andamento' },
  { value: 'Planejada', label: 'Planejadas' },
  { value: 'Precisa de revisão', label: 'Precisam de revisão' },
];

export function RouteFilters({
  filters,
  onChange,
  className = '',
}: {
  filters: RouteFilterState;
  onChange: (filters: RouteFilterState) => void;
  className?: string;
}) {
  const hasFilters =
    filters.query !== '' || filters.status !== initialRouteFilters.status;

  return (
    <div className={cn('flex flex-col gap-2 lg:flex-row lg:items-center', className)}>
      <label className="relative block min-w-0 lg:w-[min(31vw,390px)] lg:shrink-0">
        <span className="sr-only">Buscar caminhoneiro, rota ou local</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Buscar caminhoneiro, rota ou local"
          className="h-11 w-full rounded-xl border border-input bg-white pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15"
        />
      </label>

      <div
        className="flex min-w-0 flex-wrap gap-1 rounded-xl border bg-[#f2f5f3] p-1 lg:shrink-0 lg:flex-nowrap lg:gap-0.5"
        role="group"
        aria-label="Filtrar rotas por situação"
      >
        {statusOptions.map((option) => {
          const selected = filters.status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ ...filters, status: option.value })}
              className={cn(
                'h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors',
                selected
                  ? 'bg-[#17241f] text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-white hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChange(initialRouteFilters)}
          className="h-11 rounded-xl px-3 lg:ml-auto"
        >
          <X aria-hidden="true" />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}

export function countActiveFilters(filters: RouteFilterState) {
  return (
    Number(Boolean(filters.query)) +
    Number(filters.status !== initialRouteFilters.status)
  );
}
