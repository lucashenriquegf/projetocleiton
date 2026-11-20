'use client';

import { ChevronLeft, ChevronRight, PackageSearch, Plus, Search, Scale } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { StatusPill } from '@/components/system/status-pill';
import { buttonVariants } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import type { Product } from '@/lib/domain';
import { getPackagingLabel, getProductUnitLabel, getProductUnitShortLabel, packagingOptions, productUnits } from '@/lib/product-catalog';
import { cn } from '@/lib/utils';

type ProductResult = { items: Product[]; total: number; page: number; pageSize: number };

const unitOptions = productUnits.map((unit) => ({ code: unit.code, label: `${unit.label} · ${unit.shortLabel}` }));
const packageOptions = packagingOptions.map((packaging) => ({ code: packaging.code, label: packaging.label }));

export function ProductListScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [result, setResult] = useState<ProductResult>({ items: [], total: 0, page: 1, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetch(`/api/products${queryString ? `?${queryString}` : ''}`)
      .then(async (response) => {
        const data = (await response.json()) as ProductResult & { message?: string };
        if (!response.ok) throw new Error(data.message ?? 'Não foi possível carregar os produtos.');
        return data;
      })
      .then((data) => { if (active) setResult(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os produtos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryString]);

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value); else next.delete(name);
    if (name !== 'pagina') next.delete('pagina');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <ManagerShell>
      <PageFrame
        eyebrow="Cadastros"
        title="Produtos"
        description="Consulte como cada produto é medido, embalado e convertido em peso para as rotas."
        backHref="/cadastros"
        action={<Link href="/cadastros/produtos/novo" className={cn(buttonVariants({ size: 'lg' }), 'h-11 w-full rounded-none bg-[#245f0a] sm:w-auto')}><Plus aria-hidden="true" /> Novo produto</Link>}
        wide
      >
        <section className="border bg-white">
          <header className="grid items-end gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(150px,1fr))] md:p-5">
            <label className="min-w-0"><span className="mb-2 block min-h-5 text-sm font-medium">Nome</span><span className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><input value={searchParams.get('busca') ?? ''} onChange={(event) => setParam('busca', event.target.value)} placeholder="Buscar pelo nome" className="h-11 w-full border bg-white pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" /></span></label>
            <FilterSelect label="Situação" value={searchParams.get('situacao') ?? ''} onChange={(value) => setParam('situacao', value)} options={[['', 'Todos'], ['ACTIVE', 'Ativos'], ['INACTIVE', 'Arquivados']]} />
            <SearchFilter label="Unidade" value={searchParams.get('unidade') ?? ''} placeholder="Qualquer unidade" options={unitOptions} onChange={(value) => setParam('unidade', value)} />
            <SearchFilter label="Embalagem" value={searchParams.get('embalagem') ?? ''} placeholder="Qualquer embalagem" options={packageOptions} onChange={(value) => setParam('embalagem', value)} />
            <FilterSelect label="Por página" value={searchParams.get('porPagina') ?? '25'} onChange={(value) => setParam('porPagina', value)} options={[['10', '10 por página'], ['25', '25 por página'], ['50', '50 por página']]} />
          </header>

          {error ? <div role="alert" className="border-b border-alert/25 bg-alert-soft p-5 text-sm font-medium text-alert">{error}</div> : null}
          {loading ? <div className="p-8 text-sm text-muted-foreground">Carregando produtos…</div> : null}
          {!loading && !error && result.items.length === 0 ? <div className="p-8 text-center"><PackageSearch aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-semibold">Nenhum produto encontrado</p><p className="mt-1 text-sm text-muted-foreground">Revise os filtros ou cadastre um novo produto.</p></div> : null}

          {!loading && !error && result.items.length > 0 ? (
            <>
              <div className="hidden lg:block"><table className="w-full border-collapse text-left text-sm"><thead className="bg-subtle text-muted-foreground"><tr><Th>Produto</Th><Th>Unidade</Th><Th>Embalagem</Th><Th>Peso usado na rota</Th><Th>Situação</Th><Th><span className="sr-only">Ações</span></Th></tr></thead><tbody className="divide-y">{result.items.map((product) => <ProductRow key={product.id} product={product} />)}</tbody></table></div>
              <div className="divide-y lg:hidden">{result.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>
            </>
          ) : null}

          <footer className="flex flex-col gap-3 border-t bg-subtle px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">{result.total} {result.total === 1 ? 'produto encontrado' : 'produtos encontrados'}</p><div className="flex items-center gap-2"><button type="button" disabled={result.page <= 1} onClick={() => setParam('pagina', String(result.page - 1))} className="grid size-11 cursor-pointer place-items-center border bg-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior"><ChevronLeft aria-hidden="true" className="size-5" /></button><span className="px-2 font-medium">Página {result.page} de {pageCount}</span><button type="button" disabled={result.page >= pageCount} onClick={() => setParam('pagina', String(result.page + 1))} className="grid size-11 cursor-pointer place-items-center border bg-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Próxima página"><ChevronRight aria-hidden="true" className="size-5" /></button></div></footer>
        </section>
      </PageFrame>
    </ManagerShell>
  );
}

function ProductRow({ product }: { product: Product }) {
  const packageLabel = getPackagingLabel(product.packagingCode, product.packagingLabel);
  return <tr className="hover:bg-[#fafcfa]"><Td><Link href={`/cadastros/produtos/${product.id}`} className="block min-h-11 cursor-pointer py-1 font-semibold text-primary hover:underline">{product.name}<span className="mt-1 block font-normal text-muted-foreground">{product.perishable ? 'Perecível' : 'Não perecível'}</span></Link></Td><Td>{getProductUnitLabel(product.unit)}<span className="mt-1 block text-muted-foreground">{getProductUnitShortLabel(product.unit)}</span></Td><Td>{packageLabel}<span className="mt-1 block text-muted-foreground">{formatNumber(product.packageContentQuantity)} {getProductUnitShortLabel(product.unit)} por embalagem</span></Td><Td><span className="inline-flex items-center gap-2 font-medium"><Scale aria-hidden="true" className="size-4 text-muted-foreground" />{formatNumber(product.averageUnitWeightKg)} kg por {getProductUnitShortLabel(product.unit)}</span><span className="mt-1 block text-muted-foreground">{formatNumber(product.packageContentQuantity * product.averageUnitWeightKg)} kg de produto por embalagem</span></Td><Td><StatusPill tone={product.active ? 'success' : 'neutral'}>{product.active ? 'Ativo' : 'Arquivado'}</StatusPill></Td><Td><Link href={`/cadastros/produtos/${product.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 cursor-pointer rounded-none')}>Ver detalhes</Link></Td></tr>;
}

function ProductCard({ product }: { product: Product }) {
  return <article className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{product.name}</h2><p className="mt-1 text-sm text-muted-foreground">{getProductUnitLabel(product.unit)} · {getPackagingLabel(product.packagingCode, product.packagingLabel)}</p></div><StatusPill tone={product.active ? 'success' : 'neutral'}>{product.active ? 'Ativo' : 'Arquivado'}</StatusPill></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><Info label="Conteúdo por embalagem" value={`${formatNumber(product.packageContentQuantity)} ${getProductUnitShortLabel(product.unit)}`} /><Info label="Peso médio" value={`${formatNumber(product.averageUnitWeightKg)} kg por ${getProductUnitShortLabel(product.unit)}`} /></dl><Link href={`/cadastros/produtos/${product.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'mt-5 h-11 w-full cursor-pointer rounded-none')}>Ver detalhes</Link></article>;
}

function SearchFilter({ label, value, placeholder, options, onChange }: { label: string; value: string; placeholder: string; options: Array<{ code: string; label: string }>; onChange: (value: string) => void }) {
  const selected = options.find((option) => option.code === value) ?? null;
  return <label className="min-w-0"><span className="mb-2 block min-h-5 text-sm font-medium">{label}</span><Combobox items={options} value={selected} onValueChange={(option) => onChange(option?.code ?? '')} itemToStringLabel={(option) => option.label} isItemEqualToValue={(option, current) => option.code === current.code}><ComboboxInput placeholder={placeholder} showClear className="h-11 w-full rounded-none bg-white" /><ComboboxContent className="rounded-none"><ComboboxEmpty>Nenhuma opção encontrada.</ComboboxEmpty><ComboboxList>{(option) => <ComboboxItem key={option.code} value={option} className="min-h-11 cursor-pointer rounded-none px-3 py-2">{option.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></label>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) { return <label className="min-w-0"><span className="mb-2 block min-h-5 text-sm font-medium">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full cursor-pointer border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-5 py-3 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-5 py-4 align-middle">{children}</td>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>; }
function formatNumber(value: number) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value); }
