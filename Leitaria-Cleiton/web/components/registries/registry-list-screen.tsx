'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  MapPinned,
  PackageCheck,
  Plus,
  RouteOff,
  Search,
  SlidersHorizontal,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { StatusPill } from '@/components/system/status-pill';
import { buttonVariants } from '@/components/ui/button';
import {
  matchesRegistrySearch,
  registryCategoryMeta,
  registryItems,
  type RegistryCategory,
  type RegistryItem,
} from '@/lib/mocks/registries';
import { cn } from '@/lib/utils';

const pageSizeOptions = [25, 50, 100];

const iconByCategory = {
  produtos: PackageCheck,
  locais: MapPinned,
  caminhoneiros: Truck,
  'vias-bloqueadas': RouteOff,
};

type SelectFilter = {
  param: string;
  label: string;
  field: string;
  options: string[];
};

type TextFilter = {
  param: string;
  label: string;
  field: string;
  placeholder: string;
};

const selectFilters: Record<RegistryCategory, SelectFilter[]> = {
  produtos: [
    {
      param: 'categoria',
      label: 'Categoria',
      field: 'Categoria',
      options: [
        'Hortaliças',
        'Frutas',
        'Tubérculos',
        'Grãos',
        'Proteínas',
        'Laticínios',
      ],
    },
    {
      param: 'unidade',
      label: 'Unidade',
      field: 'Unidade',
      options: ['Quilograma', 'Unidade', 'Litro', 'Dúzia', 'Caixa'],
    },
  ],
  locais: [
    {
      param: 'tipo',
      label: 'Tipo de local',
      field: 'Tipo',
      options: [
        'Produtor / fazenda',
        'Escola / destino',
        'Estoque',
        'Base operacional',
      ],
    },
  ],
  caminhoneiros: [
    {
      param: 'disponibilidade',
      label: 'Disponibilidade',
      field: 'Disponibilidade',
      options: ['Disponível', 'Em rota', 'Indisponível'],
    },
  ],
  'vias-bloqueadas': [],
};

const textFilters: Partial<Record<RegistryCategory, TextFilter>> = {
  locais: {
    param: 'municipio',
    label: 'Município',
    field: 'Município',
    placeholder: 'Digite qualquer município',
  },
  caminhoneiros: {
    param: 'base',
    label: 'Base',
    field: 'Base',
    placeholder: 'Digite a cidade ou base',
  },
  'vias-bloqueadas': {
    param: 'municipio',
    label: 'Município',
    field: 'Município',
    placeholder: 'Digite qualquer município',
  },
};

export function RegistryListScreen({
  category,
}: {
  category: RegistryCategory;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const meta = registryCategoryMeta[category];
  const Icon = iconByCategory[category];

  const query = searchParams.get('busca') ?? '';
  const status = searchParams.get('status') ?? '';
  const sort = searchParams.get('ordenar') ?? 'nome-asc';
  const pageSize = getSafeNumber(
    searchParams.get('porPagina'),
    25,
    pageSizeOptions,
  );
  const requestedPage = Math.max(1, Number(searchParams.get('pagina')) || 1);

  function setParams(changes: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(searchParams.toString());

    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

    if (resetPage && !Object.prototype.hasOwnProperty.call(changes, 'pagina')) {
      next.delete('pagina');
    }

    const nextQuery = next.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }

  const filteredItems = useMemo(() => {
    const textFilter = textFilters[category];
    const filtered = registryItems[category].filter((item) => {
      if (!matchesRegistrySearch(item, query)) return false;
      if (status === 'ativos' && !item.active) return false;
      if (status === 'inativos' && item.active) return false;
      if (status === 'bloqueados' && !item.active) return false;
      if (status === 'liberados' && item.active) return false;

      const matchesSelects = selectFilters[category].every((filter) => {
        const selected = searchParams.get(filter.param);
        return !selected || item.fields[filter.field] === selected;
      });
      if (!matchesSelects) return false;

      if (textFilter) {
        const typedValue = searchParams.get(textFilter.param)?.trim();
        if (
          typedValue &&
          !matchesText(item.fields[textFilter.field] ?? '', typedValue)
        ) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'nome-desc') return b.name.localeCompare(a.name, 'pt-BR');
      if (sort === 'recentes') return b.updatedAt.localeCompare(a.updatedAt);
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [category, query, searchParams, sort, status]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const visibleItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const activeFilters = collectActiveFilters(category, searchParams);

  return (
    <ManagerShell>
      <PageFrame
        eyebrow="Cadastros"
        title={meta.label}
        description={meta.description}
        backHref="/cadastros"
        action={
          <Link
            href={meta.newHref}
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-11 w-full rounded-none bg-[#245f0a] px-4 sm:w-auto',
            )}
          >
            <Plus aria-hidden="true" /> {meta.newLabel}
          </Link>
        }
        wide
      >
        <section className="border bg-white">
          <header className="border-b p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center bg-[#edf6e8] text-[#35691c]">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">
                  Encontrar {meta.label.toLowerCase()}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Pesquise por nome, código, contato, telefone ou endereço.
                </p>
              </div>
            </div>

            <div className="mt-5 grid items-end gap-3 lg:grid-cols-12">
              <label className="min-w-0 lg:col-span-4">
                <span className="mb-2 block min-h-5 text-sm font-medium">
                  Buscar
                </span>
                <span className="relative block">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) =>
                      setParams({ busca: event.target.value })
                    }
                    placeholder={`Buscar ${meta.label.toLowerCase()}...`}
                    className="h-11 w-full border border-input bg-white pl-10 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
                  />
                </span>
              </label>

              <FilterSelect
                className="lg:col-span-2"
                label="Situação"
                value={status}
                onChange={(value) => setParams({ status: value })}
                options={
                  category === 'vias-bloqueadas'
                    ? [
                        ['bloqueados', 'Bloqueio ativo'],
                        ['liberados', 'Liberada'],
                      ]
                    : [
                        ['ativos', 'Ativos'],
                        ['inativos', 'Inativos'],
                      ]
                }
              />

              {selectFilters[category].map((filter) => (
                <FilterSelect
                  key={filter.param}
                  className="lg:col-span-2"
                  label={filter.label}
                  value={searchParams.get(filter.param) ?? ''}
                  onChange={(value) => setParams({ [filter.param]: value })}
                  options={filter.options.map((option) => [option, option])}
                />
              ))}

              {textFilters[category] ? (
                <label className="min-w-0 lg:col-span-2">
                  <span className="mb-2 block min-h-5 text-sm font-medium">
                    {textFilters[category]?.label}
                  </span>
                  <input
                    value={
                      searchParams.get(textFilters[category]?.param ?? '') ?? ''
                    }
                    onChange={(event) =>
                      setParams({
                        [textFilters[category]?.param ?? '']:
                          event.target.value,
                      })
                    }
                    placeholder={textFilters[category]?.placeholder}
                    className="h-11 w-full border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
                  />
                </label>
              ) : null}

              <FilterSelect
                className={cn(
                  'lg:col-span-2',
                  category === 'produtos' && 'lg:col-start-11',
                )}
                label="Ordenar"
                value={sort}
                onChange={(value) => setParams({ ordenar: value })}
                options={[
                  ['nome-asc', 'Nome: A–Z'],
                  ['nome-desc', 'Nome: Z–A'],
                  ['recentes', 'Atualizados recentemente'],
                ]}
              />
            </div>

            {activeFilters.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                <span className="mr-1 inline-flex items-center gap-2 text-sm font-medium">
                  <SlidersHorizontal aria-hidden="true" className="size-4" />
                  Filtros ativos
                </span>
                {activeFilters.map((filter) => (
                  <button
                    key={filter.param}
                    type="button"
                    onClick={() => setParams({ [filter.param]: null })}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 border bg-subtle px-3 text-xs font-medium hover:bg-muted"
                    aria-label={`Remover filtro ${filter.label}`}
                  >
                    {filter.label}
                    <CircleX aria-hidden="true" className="size-3.5" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => router.replace(pathname, { scroll: false })}
                  className="min-h-9 cursor-pointer px-2 text-xs font-semibold text-primary hover:underline"
                >
                  Limpar tudo
                </button>
              </div>
            ) : null}
          </header>

          <div className="flex flex-col gap-3 border-b bg-subtle px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p aria-live="polite">
              <strong>{filteredItems.length}</strong>{' '}
              {filteredItems.length === 1
                ? 'resultado encontrado'
                : 'resultados encontrados'}
            </p>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Mostrar</span>
              <select
                value={pageSize}
                onChange={(event) =>
                  setParams({ porPagina: event.target.value, pagina: null })
                }
                className="h-9 cursor-pointer border border-input bg-white px-2 text-sm"
                aria-label="Resultados por página"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">por página</span>
            </label>
          </div>

          {visibleItems.length > 0 ? (
            <>
              <RegistryTable category={category} items={visibleItems} />
              <RegistryCards category={category} items={visibleItems} />
              <RegistryPagination
                page={page}
                pageCount={pageCount}
                onPageChange={(nextPage) =>
                  setParams({ pagina: String(nextPage) }, false)
                }
              />
            </>
          ) : (
            <RegistryEmptyState
              category={category}
              onClear={() => router.replace(pathname, { scroll: false })}
            />
          )}
        </section>
      </PageFrame>
    </ManagerShell>
  );
}

function RegistryTable({
  category,
  items,
}: {
  category: RegistryCategory;
  items: RegistryItem[];
}) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[840px] border-collapse text-left text-sm">
        <thead className="bg-white text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            <th className="px-5 py-3 font-semibold">Cadastro</th>
            <th className="px-5 py-3 font-semibold">Informações</th>
            <th className="px-5 py-3 font-semibold">Situação</th>
            <th className="px-5 py-3 font-semibold">Atualizado</th>
            <th className="px-5 py-3 text-right font-semibold">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-subtle/65">
              <td className="px-5 py-4">
                <p className="font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.secondary}
                </p>
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {item.summary}
              </td>
              <td className="px-5 py-4">
                <StatusPill tone={item.statusTone}>{item.status}</StatusPill>
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatDate(item.updatedAt)}
              </td>
              <td className="px-5 py-4 text-right">
                <Link
                  href={`/cadastros/${category}/${item.id}`}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'lg' }),
                    'h-11 rounded-none px-4',
                  )}
                >
                  Ver cadastro
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegistryCards({
  category,
  items,
}: {
  category: RegistryCategory;
  items: RegistryItem[];
}) {
  return (
    <ul className="divide-y md:hidden">
      {items.map((item) => (
        <li key={item.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{item.name}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {item.summary}
              </p>
            </div>
            <StatusPill tone={item.statusTone} className="shrink-0">
              {item.status}
            </StatusPill>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{item.secondary}</p>
          <Link
            href={`/cadastros/${category}/${item.id}`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'mt-4 h-11 w-full rounded-none',
            )}
          >
            Ver cadastro
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RegistryPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const pages = getVisiblePages(page, pageCount);

  return (
    <footer className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-muted-foreground">
        Página <strong className="text-foreground">{page}</strong> de{' '}
        <strong className="text-foreground">{pageCount}</strong>
      </p>
      <nav aria-label="Paginação" className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="grid size-11 cursor-pointer place-items-center border bg-white hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        {pages.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPageChange(value)}
            aria-current={value === page ? 'page' : undefined}
            className={cn(
              'size-11 cursor-pointer border text-sm font-semibold hover:bg-muted',
              value === page
                ? 'border-[#245f0a] bg-[#245f0a] text-white hover:bg-[#245f0a]'
                : 'bg-white',
            )}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          className="grid size-11 cursor-pointer place-items-center border bg-white hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="Próxima página"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </nav>
    </footer>
  );
}

function RegistryEmptyState({
  category,
  onClear,
}: {
  category: RegistryCategory;
  onClear: () => void;
}) {
  const meta = registryCategoryMeta[category];
  return (
    <div className="grid min-h-80 place-items-center p-6 text-center">
      <div className="max-w-md">
        <Search
          aria-hidden="true"
          className="mx-auto size-8 text-muted-foreground"
        />
        <h3 className="mt-4 text-lg font-semibold">
          Nenhum cadastro encontrado
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Revise o que foi digitado ou limpe os filtros para ver todos os
          {` ${meta.label.toLowerCase()}`}.
        </p>
        <button
          type="button"
          onClick={onClear}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'mt-5 h-11 cursor-pointer rounded-none px-5',
          )}
        >
          Limpar busca e filtros
        </button>
      </div>
    </div>
  );
}

function FilterSelect({
  className,
  label,
  value,
  onChange,
  options,
}: {
  className?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className={cn('min-w-0', className)}>
      <span className="mb-2 block min-h-5 text-sm font-medium">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full cursor-pointer appearance-none border border-input bg-white px-3 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          <option value="">Todos</option>
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    </label>
  );
}

function collectActiveFilters(
  category: RegistryCategory,
  params: URLSearchParams,
) {
  const filters: Array<{ param: string; label: string }> = [];
  const status = params.get('status');
  if (status) {
    const statusLabels: Record<string, string> = {
      ativos: 'Ativos',
      inativos: 'Inativos',
      bloqueados: 'Bloqueio ativo',
      liberados: 'Liberada',
    };
    filters.push({ param: 'status', label: statusLabels[status] ?? status });
  }

  selectFilters[category].forEach((filter) => {
    const value = params.get(filter.param);
    if (value) filters.push({ param: filter.param, label: value });
  });

  const textFilter = textFilters[category];
  if (textFilter) {
    const value = params.get(textFilter.param);
    if (value) {
      filters.push({
        param: textFilter.param,
        label: `${textFilter.label}: ${value}`,
      });
    }
  }

  return filters;
}

function getVisiblePages(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function getSafeNumber(
  value: string | null,
  fallback: number,
  allowed: number[],
) {
  const parsed = Number(value);
  return allowed.includes(parsed) ? parsed : fallback;
}

function matchesText(value: string, query: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .includes(
      query
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR'),
    );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${date}T12:00:00`));
}
