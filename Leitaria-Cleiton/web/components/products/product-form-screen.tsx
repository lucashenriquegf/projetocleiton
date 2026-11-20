'use client';

import { AlertTriangle, Archive, CheckCircle2, RotateCcw, Save, Scale } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Product } from '@/lib/domain';
import {
  findProductUnit,
  getPackagingLabel,
  getProductUnitShortLabel,
  packagingOptions,
  productUnits,
} from '@/lib/product-catalog';
import { cn } from '@/lib/utils';

type ProductDraft = {
  name: string;
  unit: string;
  packagingCode: string;
  packagingLabel: string;
  packageContentQuantity: string;
  averageUnitWeightKg: string;
  perishable: boolean;
  active: boolean;
};

type SimilarProduct = {
  id: string;
  name: string;
  unit: string;
  packaging: string;
  active: boolean;
  exact: boolean;
  similarity: number;
};

const emptyDraft: ProductDraft = {
  name: '',
  unit: '',
  packagingCode: '',
  packagingLabel: '',
  packageContentQuantity: '1',
  averageUnitWeightKg: '',
  perishable: false,
  active: true,
};

const unitOptions = productUnits.map((unit) => ({
  code: unit.code,
  label: `${unit.label} · ${unit.shortLabel}`,
  description: unit.group,
  searchText: [unit.label, unit.shortLabel, unit.group, ...unit.aliases].join(' '),
}));

const packageOptions = packagingOptions.map((packaging) => ({
  code: packaging.code,
  label: packaging.label,
  description: packaging.compatibleUnit === 'l' ? 'Para produtos medidos em litros' : 'Tipo de embalagem',
  searchText: packaging.label,
}));

export function ProductFormScreen({ productId }: { productId?: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<SimilarProduct[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarAcknowledged, setSimilarAcknowledged] = useState(false);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    void fetch(`/api/products/${productId}`)
      .then(async (response) => {
        const result = (await response.json()) as Product & { message?: string };
        if (!response.ok) throw new Error(result.message ?? 'Produto não encontrado.');
        return result;
      })
      .then((result) => {
        if (!active) return;
        setProduct(result);
        setDraft(toDraft(result));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o produto.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  useEffect(() => {
    const name = draft.name.trim();
    setSimilarAcknowledged(false);
    if (name.length < 2) {
      setSimilar([]);
      setSimilarLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSimilarLoading(true);
      const search = new URLSearchParams({ nome: name });
      if (productId) search.set('excludeId', productId);
      void fetch(`/api/products/similar?${search}`)
        .then(async (response) => {
          const result = (await response.json()) as { items?: SimilarProduct[]; message?: string };
          if (!response.ok) throw new Error(result.message ?? 'Não foi possível verificar nomes semelhantes.');
          return result.items ?? [];
        })
        .then((items) => { if (active) setSimilar(items); })
        .catch(() => { if (active) setSimilar([]); })
        .finally(() => { if (active) setSimilarLoading(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [draft.name, productId]);

  const exactDuplicate = similar.find((candidate) => candidate.exact) ?? null;
  const fuzzyMatches = similar.filter((candidate) => !candidate.exact);
  const unit = findProductUnit(draft.unit);
  const asksForAverageWeight = unit?.weightFactorKg == null;
  const packagingName = draft.packagingCode
    ? getPackagingLabel(draft.packagingCode, draft.packagingLabel)
    : 'embalagem';
  const canSaveSimilar = fuzzyMatches.length === 0 || similarAcknowledged;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (exactDuplicate || !canSaveSimilar) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const response = await fetch(productId ? `/api/products/${productId}` : '/api/products', {
        method: productId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          unit: draft.unit,
          packagingCode: draft.packagingCode,
          packagingLabel: draft.packagingCode === 'OUTRO' ? draft.packagingLabel : null,
          packageContentQuantity: parseDecimal(draft.packageContentQuantity),
          averageUnitWeightKg: parseDecimal(draft.averageUnitWeightKg),
          perishable: draft.perishable,
          active: draft.active,
        }),
      });
      const result = (await response.json()) as Product & { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Não foi possível salvar o produto.');
      if (!productId) {
        router.replace(`/cadastros/produtos/${result.id}`);
        return;
      }
      setProduct(result);
      setDraft(toDraft(result));
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o produto.');
    } finally {
      setSaving(false);
    }
  }

  async function changeArchived(archived: boolean) {
    if (!productId) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archived }),
      });
      const result = (await response.json()) as Product & { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Não foi possível alterar o produto.');
      setProduct(result);
      setDraft(toDraft(result));
      setSaved(true);
      setConfirmArchive(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível alterar o produto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ManagerShell>
      <PageFrame
        eyebrow="Produtos"
        title={productId ? product?.name ?? 'Produto' : 'Cadastrar produto'}
        description="Informe somente o necessário para medir o produto e calcular o peso da coleta."
        backHref="/cadastros/produtos"
        action={product ? <Status active={product.active} /> : undefined}
      >
        {loading ? <div className="max-w-5xl border bg-white p-8 text-sm text-muted-foreground">Carregando produto…</div> : null}
        {!loading ? (
          <form className="max-w-5xl border bg-white" onSubmit={save}>
            {error ? <div role="alert" className="border-b border-alert/25 bg-alert-soft px-5 py-4 text-sm font-medium text-alert">{error}</div> : null}
            {saved ? <output className="flex items-center gap-3 border-b border-success/25 bg-success-soft px-5 py-4 text-sm"><CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-success" /><span><strong className="text-success">Alterações salvas.</strong> O produto já pode ser usado no planejamento.</span></output> : null}

            <div className="space-y-8 p-5 sm:p-7">
              <section>
                <SectionTitle title="Produto" description="O nome continuará com acentos; a comparação sem acentos acontece automaticamente." />
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field id="product-name" label="Nome do produto" required>
                    <Input id="product-name" value={draft.name} onChange={(event) => patchDraft(setDraft, { name: event.target.value })} placeholder="Ex.: Cenoura" required className="h-11 rounded-none" />
                  </Field>
                  <Field id="product-unit" label="Unidade de medida" required hint={product?.referenced ? 'Não pode ser alterada' : undefined}>
                    <CatalogCombobox id="product-unit" value={draft.unit} options={unitOptions} placeholder="Buscar unidade…" disabled={Boolean(product?.referenced)} onChange={(value) => {
                      const selected = findProductUnit(value);
                      const previous = findProductUnit(draft.unit);
                      const selectedPackaging = packagingOptions.find((option) => option.code === draft.packagingCode);
                      patchDraft(setDraft, {
                        unit: value,
                        averageUnitWeightKg: selected?.weightFactorKg == null
                          ? previous?.weightFactorKg == null ? draft.averageUnitWeightKg : ''
                          : formatInputNumber(selected.weightFactorKg),
                        packageContentQuantity: selectedPackaging?.suggestedContent && (!selectedPackaging.compatibleUnit || selectedPackaging.compatibleUnit === value)
                          ? formatInputNumber(selectedPackaging.suggestedContent)
                          : draft.packageContentQuantity,
                      });
                    }} />
                  </Field>
                </div>
              </section>

              <section className="border-t pt-7">
                <SectionTitle title="Como será transportado" description="Esses três dados permitem estimar o número de embalagens e o peso total da coleta." />
                <div className={cn('mt-5 grid gap-5', asksForAverageWeight ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                  <Field id="product-package" label="Tipo de embalagem" required>
                    <CatalogCombobox id="product-package" value={draft.packagingCode} options={packageOptions} placeholder="Buscar embalagem…" onChange={(value) => {
                      const selected = packagingOptions.find((option) => option.code === value);
                      patchDraft(setDraft, {
                        packagingCode: value,
                        packageContentQuantity: selected?.suggestedContent && (!selected.compatibleUnit || selected.compatibleUnit === draft.unit)
                          ? formatInputNumber(selected.suggestedContent)
                          : draft.packageContentQuantity,
                      });
                    }} />
                  </Field>
                  <Field id="product-package-content" label="Quanto cabe na embalagem" required hint={unit?.shortLabel ?? 'unidade escolhida'}>
                    <Input id="product-package-content" value={draft.packageContentQuantity} onChange={(event) => patchDraft(setDraft, { packageContentQuantity: event.target.value })} inputMode="decimal" placeholder="Ex.: 10" required className="h-11 rounded-none" />
                  </Field>
                  {asksForAverageWeight ? (
                    <Field id="product-weight" label={`Peso médio de 1 ${unit?.shortLabel ?? 'unidade'}`} required hint="kg">
                      <Input id="product-weight" value={draft.averageUnitWeightKg} onChange={(event) => patchDraft(setDraft, { averageUnitWeightKg: event.target.value })} inputMode="decimal" placeholder="Ex.: 0,22" required className="h-11 rounded-none" />
                    </Field>
                  ) : null}
                  {draft.packagingCode === 'OUTRO' ? (
                    <Field id="product-package-other" label="Nome da embalagem" required className="sm:col-span-3">
                      <Input id="product-package-other" value={draft.packagingLabel} onChange={(event) => patchDraft(setDraft, { packagingLabel: event.target.value })} placeholder="Ex.: Caixa retornável do produtor" required className="h-11 rounded-none" />
                    </Field>
                  ) : null}
                </div>

                {draft.unit && draft.packagingCode && parseDecimal(draft.packageContentQuantity) > 0 && parseDecimal(draft.averageUnitWeightKg) > 0 ? (
                  <div className="mt-5 flex items-start gap-3 border bg-subtle p-4 text-sm">
                    <Scale aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                    <p className="leading-6"><strong>Estimativa:</strong> cada {packagingName.toLocaleLowerCase('pt-BR')} leva {formatNumber(parseDecimal(draft.packageContentQuantity))} {getProductUnitShortLabel(draft.unit)}. O peso do produto será calculado usando {formatNumber(parseDecimal(draft.averageUnitWeightKg))} kg por {getProductUnitShortLabel(draft.unit)}.</p>
                  </div>
                ) : null}
              </section>

              {similarLoading ? <p className="text-sm text-muted-foreground">Verificando produtos semelhantes…</p> : null}
              {exactDuplicate ? <DuplicateNotice product={exactDuplicate} exact /> : null}
              {!exactDuplicate && fuzzyMatches.length > 0 ? (
                <section className="border border-warning/30 bg-warning-soft p-5">
                  <div className="flex items-start gap-3"><AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" /><div><h2 className="font-semibold">Encontramos produtos com nome parecido</h2><p className="mt-1 text-sm text-muted-foreground">Confira antes de criar outro cadastro.</p></div></div>
                  <div className="mt-4 divide-y border bg-white">{fuzzyMatches.map((item) => <DuplicateRow key={item.id} product={item} />)}</div>
                  {!similarAcknowledged ? <Button type="button" variant="outline" onClick={() => setSimilarAcknowledged(true)} className="mt-4 h-11 cursor-pointer rounded-none bg-white">Cadastrar mesmo assim</Button> : <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 aria-hidden="true" className="size-4" /> Nome revisado. O cadastro pode continuar.</p>}
                </section>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Toggle id="product-perishable" label="Produto perecível" description="Ajuda a priorizar coletas que não podem esperar." checked={draft.perishable} onChange={(perishable) => patchDraft(setDraft, { perishable })} />
                <Toggle id="product-active" label="Produto ativo" description="Produtos inativos não aparecem em novas demandas." checked={draft.active} onChange={(active) => patchDraft(setDraft, { active })} />
              </div>
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t bg-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>{product ? product.active ? <Button type="button" variant="outline" onClick={() => setConfirmArchive(true)} className="h-11 cursor-pointer rounded-none text-alert"><Archive aria-hidden="true" /> Arquivar produto</Button> : <Button type="button" variant="outline" disabled={saving} onClick={() => void changeArchived(false)} className="h-11 cursor-pointer rounded-none"><RotateCcw aria-hidden="true" /> Reativar produto</Button> : null}</div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Link href="/cadastros/produtos" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-none')}>Cancelar</Link>
                <Button type="submit" size="lg" disabled={saving || Boolean(exactDuplicate) || !canSaveSimilar || product?.active === false} className="h-11 cursor-pointer rounded-none bg-[#245f0a] px-5"><Save aria-hidden="true" /> {saving ? 'Salvando…' : 'Salvar produto'}</Button>
              </div>
            </footer>
          </form>
        ) : null}

        <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Arquivar este produto?</AlertDialogTitle><AlertDialogDescription>Ele deixará de aparecer em novas demandas, mas estoques, rotas e históricos serão preservados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => void changeArchived(true)} className="bg-alert hover:bg-alert/90">Arquivar produto</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      </PageFrame>
    </ManagerShell>
  );
}

function CatalogCombobox({ id, value, options, placeholder, disabled, onChange }: { id: string; value: string; options: Array<{ code: string; label: string; description: string; searchText: string }>; placeholder: string; disabled?: boolean; onChange: (value: string) => void }) {
  const selected = options.find((option) => option.code === value) ?? null;
  return <Combobox items={options} value={selected} onValueChange={(option) => { if (option) onChange(option.code); }} itemToStringLabel={(option) => option.searchText} itemToStringValue={(option) => option.label} isItemEqualToValue={(option, current) => option.code === current.code}><ComboboxInput id={id} disabled={disabled} placeholder={placeholder} className="h-11 w-full rounded-none bg-white" /><ComboboxContent className="rounded-none"><ComboboxEmpty>Nenhuma opção encontrada.</ComboboxEmpty><ComboboxList>{(option) => <ComboboxItem key={option.code} value={option} className="min-h-11 cursor-pointer rounded-none px-3 py-2"><span className="min-w-0"><span className="block font-medium">{option.label}</span><span className="block text-xs text-muted-foreground">{option.description}</span></span></ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>;
}

function DuplicateNotice({ product }: { product: SimilarProduct; exact?: boolean }) {
  return <section role="alert" className="border border-alert/25 bg-alert-soft p-5"><div className="flex items-start gap-3"><AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-alert" /><div><h2 className="font-semibold">Este produto já está cadastrado</h2><p className="mt-1 text-sm text-muted-foreground">Encontramos “{product.name}”, inclusive ao ignorar acentos e letras maiúsculas.</p><Link href={`/cadastros/produtos/${product.id}`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">Abrir produto existente</Link></div></div></section>;
}

function DuplicateRow({ product }: { product: SimilarProduct }) {
  return <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{product.name}</p><p className="mt-1 text-sm text-muted-foreground">{getProductUnitShortLabel(product.unit)} · {product.packaging} · {product.active ? 'Ativo' : 'Inativo'}</p></div><Link href={`/cadastros/produtos/${product.id}`} className="inline-flex min-h-11 shrink-0 items-center font-semibold text-primary hover:underline">Ver cadastro</Link></div>;
}

function SectionTitle({ title, description }: { title: string; description: string }) { return <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>; }
function Field({ id, label, hint, required, className, children }: { id: string; label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) { return <div className={cn('flex min-w-0 flex-col', className)}><div className="flex min-h-10 items-end justify-between gap-3"><Label htmlFor={id} className="leading-5">{label}{required ? <span className="text-alert"> *</span> : null}</Label>{hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}</div><div className="mt-2">{children}</div></div>; }
function Toggle({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) { return <section className="flex min-h-24 items-center gap-4 border bg-subtle p-4"><div className="min-w-0 flex-1"><Label htmlFor={id}>{label}</Label><p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p></div><Switch id={id} checked={checked} onCheckedChange={onChange} /></section>; }
function Status({ active }: { active: boolean }) { return <span className={cn('inline-flex min-h-9 items-center border px-3 text-sm font-semibold', active ? 'border-success/30 bg-success-soft text-success' : 'border-border bg-subtle text-muted-foreground')}>{active ? 'Ativo' : 'Arquivado'}</span>; }
function patchDraft(setDraft: React.Dispatch<React.SetStateAction<ProductDraft>>, patch: Partial<ProductDraft>) { setDraft((current) => ({ ...current, ...patch })); }
function parseDecimal(value: string) { return Number(value.trim().replace(',', '.')); }
function formatInputNumber(value: number) { return String(value).replace('.', ','); }
function formatNumber(value: number) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value); }
function toDraft(product: Product): ProductDraft { return { name: product.name, unit: product.unit, packagingCode: product.packagingCode, packagingLabel: product.packagingLabel ?? '', packageContentQuantity: formatInputNumber(product.packageContentQuantity), averageUnitWeightKg: formatInputNumber(product.averageUnitWeightKg), perishable: product.perishable, active: product.active }; }
