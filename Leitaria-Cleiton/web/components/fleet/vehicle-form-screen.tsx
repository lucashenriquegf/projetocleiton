'use client';

import { Archive, CheckCircle2, RotateCcw, Save, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ReferenceBasePicker, type ReferenceBaseValue } from '@/components/fleet/reference-base-picker';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  vehicleTractionsByCategory,
  type Vehicle,
  type VehicleCategory,
  type VehicleOperationalStatus,
  type VehicleTraction,
} from '@/lib/domain';
import { formatBrazilianPlateInput } from '@/lib/input-masks';
import { cn } from '@/lib/utils';

type VehicleDraft = {
  plate: string;
  manufacturer: string;
  model: string;
  modelYear: string;
  category: VehicleCategory;
  traction: VehicleTraction;
  axleCount: string;
  capacityKg: string;
  capacityM3: string;
  operationalStatus: VehicleOperationalStatus;
  notes: string;
  base: ReferenceBaseValue;
};

const emptyDraft: VehicleDraft = {
  plate: '', manufacturer: '', model: '', modelYear: String(new Date().getFullYear()),
  category: 'TRUCK', traction: '4X2', axleCount: '2', capacityKg: '', capacityM3: '',
  operationalStatus: 'AVAILABLE', notes: '',
  base: { locationId: null, label: 'Garagem municipal de Inhumas', latitude: -16.35742, longitude: -49.49681 },
};

export function VehicleFormScreen({ vehicleId }: { vehicleId?: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<VehicleDraft>(emptyDraft);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(Boolean(vehicleId));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!vehicleId) return;
    let active = true;
    void fetch(`/api/vehicles/${vehicleId}`)
      .then(async (response) => {
        const result = (await response.json()) as Vehicle & { message?: string };
        if (!response.ok) throw new Error(result.message ?? 'Veículo não encontrado.');
        return result;
      })
      .then((result) => {
        if (!active) return;
        setVehicle(result);
        setDraft(toDraft(result));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o veículo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [vehicleId]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const response = await fetch(vehicleId ? `/api/vehicles/${vehicleId}` : '/api/vehicles', {
        method: vehicleId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plate: draft.plate,
          manufacturer: draft.manufacturer,
          model: draft.model,
          modelYear: Number(draft.modelYear),
          category: draft.category,
          traction: draft.traction,
          axleCount: draft.category === 'TRUCK' ? Number(draft.axleCount) : null,
          capacityKg: Number(draft.capacityKg),
          capacityM3: Number(draft.capacityM3),
          operationalStatus: draft.operationalStatus,
          baseLocationId: draft.base.locationId,
          baseLabel: draft.base.label,
          baseLatitude: draft.base.latitude,
          baseLongitude: draft.base.longitude,
          notes: draft.notes || null,
        }),
      });
      const result = (await response.json()) as Vehicle & { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Não foi possível salvar o veículo.');
      if (!vehicleId) {
        router.replace(`/cadastros/veiculos/${result.id}`);
        return;
      }
      setVehicle(result);
      setDraft(toDraft(result));
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o veículo.');
    } finally {
      setSaving(false);
    }
  }

  async function changeArchived(archived: boolean) {
    if (!vehicleId) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ archived }),
      });
      const result = (await response.json()) as Vehicle & { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Não foi possível alterar o veículo.');
      setVehicle(result);
      setSaved(true);
      setConfirmArchive(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível alterar o veículo.');
    } finally {
      setSaving(false);
    }
  }

  const title = vehicleId ? (vehicle ? `${vehicle.manufacturer} ${vehicle.model}` : 'Veículo') : 'Cadastrar veículo';

  return (
    <ManagerShell>
      <PageFrame
        eyebrow="Veículos"
        title={title}
        description={vehicleId ? 'Dados usados para definir capacidade, acesso às vias e responsabilidade da rota.' : 'Cadastre as informações necessárias para usar o veículo no planejamento das rotas.'}
        backHref="/cadastros/veiculos"
        action={vehicleId && vehicle ? (
          <span className={cn('inline-flex min-h-9 items-center border px-3 text-sm font-semibold', vehicle.active ? 'border-success/30 bg-success-soft text-success' : 'border-border bg-subtle text-muted-foreground')}>
            {vehicle.active ? (vehicle.activeRouteId ? 'Em rota' : vehicle.operationalStatus === 'MAINTENANCE' ? 'Em manutenção' : 'Disponível') : 'Arquivado'}
          </span>
        ) : undefined}
      >
        {loading ? <div className="max-w-5xl border bg-white p-8 text-sm text-muted-foreground">Carregando veículo…</div> : null}
        {!loading ? (
          <form className="max-w-5xl border bg-white" onSubmit={save}>
            {error ? <div role="alert" className="border-b border-alert/25 bg-alert-soft px-5 py-4 text-sm font-medium text-alert">{error}</div> : null}
            {saved ? (
              <output className="flex items-center gap-3 border-b border-success/25 bg-success-soft px-5 py-4 text-sm">
                <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-success" />
                <span><strong className="text-success">Alterações salvas.</strong> Os dados já podem ser usados no planejamento.</span>
              </output>
            ) : null}

            <div className="space-y-8 p-5 sm:p-7">
              <section>
                <SectionTitle title="Identificação" description="Use os dados que aparecem no documento do veículo. O código interno é gerado automaticamente ao salvar." />
                <div className="mt-5 grid gap-5 sm:grid-cols-6">
                  <Field id="vehicle-plate" label="Placa" required className="sm:col-span-3">
                    <Input id="vehicle-plate" value={draft.plate} onChange={(event) => patchDraft(setDraft, { plate: formatBrazilianPlateInput(event.target.value) })} placeholder="BRA2E19" maxLength={7} autoCapitalize="characters" autoComplete="off" spellCheck={false} required className="h-11 rounded-none uppercase" />
                  </Field>
                  <Field id="vehicle-status" label="Situação operacional" required className="sm:col-span-3">
                    <select id="vehicle-status" value={draft.operationalStatus} onChange={(event) => patchDraft(setDraft, { operationalStatus: event.target.value as VehicleOperationalStatus })} className={selectClassName}>
                      <option value="AVAILABLE">Disponível</option>
                      <option value="MAINTENANCE">Em manutenção</option>
                    </select>
                  </Field>
                  <Field id="vehicle-manufacturer" label="Marca" required className="sm:col-span-2">
                    <Input id="vehicle-manufacturer" value={draft.manufacturer} onChange={(event) => patchDraft(setDraft, { manufacturer: event.target.value })} placeholder="Ex.: Mercedes-Benz" required className="h-11 rounded-none" />
                  </Field>
                  <Field id="vehicle-model" label="Modelo" required className="sm:col-span-3">
                    <Input id="vehicle-model" value={draft.model} onChange={(event) => patchDraft(setDraft, { model: event.target.value })} placeholder="Ex.: Accelo 1016" required className="h-11 rounded-none" />
                  </Field>
                  <Field id="vehicle-year" label="Ano" required className="sm:col-span-1">
                    <Input id="vehicle-year" type="number" min="1950" max={new Date().getFullYear() + 1} value={draft.modelYear} onChange={(event) => patchDraft(setDraft, { modelYear: event.target.value })} required className="h-11 rounded-none" />
                  </Field>
                </div>
              </section>

              <section className="border-t pt-7">
                <SectionTitle title="Capacidade e acesso" description="Esses dados impedem que uma carga ou uma via incompatível seja atribuída ao veículo." />
                <div className="mt-5 grid gap-5 sm:grid-cols-6">
                  <Field id="vehicle-category" label="Tipo de veículo" required className={draft.category === 'TRUCK' ? 'sm:col-span-2' : 'sm:col-span-3'}>
                    <select id="vehicle-category" value={draft.category} onChange={(event) => {
                      const category = event.target.value as VehicleCategory;
                      const compatibleTractions = vehicleTractionsByCategory[category];
                      patchDraft(setDraft, {
                        category,
                        traction: compatibleTractions.includes(draft.traction) ? draft.traction : compatibleTractions[0],
                      });
                    }} className={selectClassName}>
                      <option value="CAR">Carro</option><option value="UTILITY">Utilitário / picape</option><option value="VAN">Van</option><option value="TRUCK">Caminhão</option>
                    </select>
                  </Field>
                  <Field id="vehicle-traction" label="Tração" required className={draft.category === 'TRUCK' ? 'sm:col-span-2' : 'sm:col-span-3'}>
                    <select id="vehicle-traction" value={draft.traction} onChange={(event) => patchDraft(setDraft, { traction: event.target.value as VehicleTraction })} className={selectClassName}>
                      {vehicleTractionsByCategory[draft.category].map((traction) => (
                        <option key={traction} value={traction}>{tractionLabels[traction]}</option>
                      ))}
                    </select>
                  </Field>
                  {draft.category === 'TRUCK' ? (
                    <Field id="vehicle-axles" label="Quantidade de eixos" required className="sm:col-span-2">
                      <Input id="vehicle-axles" type="number" min="2" max="9" value={draft.axleCount} onChange={(event) => patchDraft(setDraft, { axleCount: event.target.value })} required className="h-11 rounded-none" />
                    </Field>
                  ) : null}
                  <Field id="vehicle-capacity-kg" label="Capacidade de carga" hint="kg" required className="sm:col-span-3">
                    <Input id="vehicle-capacity-kg" type="number" min="1" step="0.1" value={draft.capacityKg} onChange={(event) => patchDraft(setDraft, { capacityKg: event.target.value })} placeholder="Ex.: 6000" required className="h-11 rounded-none" />
                  </Field>
                  <Field id="vehicle-capacity-m3" label="Volume disponível" hint="m³" required className="sm:col-span-3">
                    <Input id="vehicle-capacity-m3" type="number" min="0.1" step="0.1" value={draft.capacityM3} onChange={(event) => patchDraft(setDraft, { capacityM3: event.target.value })} placeholder="Ex.: 28" required className="h-11 rounded-none" />
                  </Field>
                </div>
              </section>

              <ReferenceBasePicker value={draft.base} onChange={(base) => patchDraft(setDraft, { base })} />

              <section className="border-t pt-7">
                <Field id="vehicle-notes" label="Observação operacional" hint="Opcional">
                  <Textarea id="vehicle-notes" value={draft.notes} onChange={(event) => patchDraft(setDraft, { notes: event.target.value })} placeholder="Ex.: veículo com baú refrigerado" className="min-h-24 resize-y rounded-none" />
                </Field>
              </section>

              {vehicle?.currentDriverName ? (
                <section className="flex flex-col gap-4 border bg-subtle p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Truck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div><p className="font-semibold">Motorista atual: {vehicle.currentDriverName}</p><p className="mt-1 text-sm text-muted-foreground">Trocas de responsabilidade são feitas na tela de Frota.</p></div>
                  </div>
                  <Link href="/cadastros/frota" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 shrink-0 rounded-none')}>Abrir Frota</Link>
                </section>
              ) : null}
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t bg-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {vehicle ? vehicle.active ? (
                  <Button type="button" variant="outline" onClick={() => setConfirmArchive(true)} className="h-11 cursor-pointer rounded-none text-alert"><Archive aria-hidden="true" /> Arquivar veículo</Button>
                ) : (
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void changeArchived(false)} className="h-11 cursor-pointer rounded-none"><RotateCcw aria-hidden="true" /> Reativar veículo</Button>
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Link href="/cadastros/veiculos" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-none')}>Cancelar</Link>
                <Button type="submit" size="lg" disabled={saving || vehicle?.active === false} className="h-11 cursor-pointer rounded-none bg-[#245f0a] px-5"><Save aria-hidden="true" /> {saving ? 'Salvando…' : 'Salvar veículo'}</Button>
              </div>
            </footer>
          </form>
        ) : null}

        <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Arquivar este veículo?</AlertDialogTitle><AlertDialogDescription>Ele deixará de aparecer em novos planejamentos. Rotas e vínculos anteriores serão preservados.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => void changeArchived(true)} className="bg-alert hover:bg-alert/90">Arquivar veículo</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageFrame>
    </ManagerShell>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>;
}

function Field({ id, label, hint, required, className, children }: { id: string; label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={cn('flex min-w-0 flex-col', className)}><div className="flex min-h-10 items-end justify-between gap-3"><Label htmlFor={id} className="leading-5">{label}{required ? <span className="text-alert"> *</span> : null}</Label>{hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}</div><div className="mt-2">{children}</div></div>;
}

function patchDraft(setDraft: React.Dispatch<React.SetStateAction<VehicleDraft>>, patch: Partial<VehicleDraft>) {
  setDraft((current) => ({ ...current, ...patch }));
}

function toDraft(vehicle: Vehicle): VehicleDraft {
  return {
    plate: vehicle.plate, manufacturer: vehicle.manufacturer,
    model: vehicle.model, modelYear: String(vehicle.modelYear), category: vehicle.category,
    traction: vehicle.traction, axleCount: vehicle.axleCount == null ? '2' : String(vehicle.axleCount),
    capacityKg: String(vehicle.capacityKg), capacityM3: String(vehicle.capacityM3),
    operationalStatus: vehicle.operationalStatus, notes: vehicle.notes ?? '',
    base: { locationId: vehicle.baseLocationId, label: vehicle.baseName ?? '', latitude: vehicle.baseLatitude ?? -16.35742, longitude: vehicle.baseLongitude ?? -49.49681 },
  };
}

const selectClassName = 'h-11 w-full cursor-pointer border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35';

const tractionLabels: Record<VehicleTraction, string> = {
  '4X2': '4x2',
  '4X4': '4x4',
  '6X2': '6x2',
  '6X4': '6x4',
  OTHER: 'Outra configuração',
};
