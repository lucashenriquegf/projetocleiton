'use client';

import { CheckCircle2, Save, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ReferenceBasePicker, type ReferenceBaseValue } from '@/components/fleet/reference-base-picker';
import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { DriverRecord } from '@/lib/domain';
import { formatBrazilianPhone } from '@/lib/input-masks';
import { cn } from '@/lib/utils';

export function DriverFormScreen({ driverId }: { driverId?: string }) {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [active, setActive] = useState(true);
  const [base, setBase] = useState<ReferenceBaseValue>({ locationId: null, label: 'Garagem municipal de Inhumas', latitude: -16.35742, longitude: -49.49681 });
  const [loading, setLoading] = useState(Boolean(driverId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!driverId) return;
    let mounted = true;
    void fetch(`/api/drivers/${driverId}`).then(async (response) => {
      const body = (await response.json()) as DriverRecord & { message?: string };
      if (!response.ok) throw new Error(body.message ?? 'Motorista não encontrado.');
      return body;
    }).then((body) => {
      if (!mounted) return;
      setDriver(body); setName(body.name); setPhone(formatBrazilianPhone(body.phone ?? '')); setActive(body.active);
      setBase({ locationId: body.baseLocationId, label: body.baseName ?? '', latitude: body.baseLatitude ?? -16.35742, longitude: body.baseLongitude ?? -49.49681 });
    }).catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o motorista.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [driverId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setSaved(false); setError('');
    try {
      const response = await fetch(driverId ? `/api/drivers/${driverId}` : '/api/drivers', { method: driverId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, phone, active, baseLocationId: base.locationId, baseLabel: base.label, baseLatitude: base.latitude, baseLongitude: base.longitude }) });
      const body = (await response.json()) as DriverRecord & { message?: string };
      if (!response.ok) throw new Error(body.message ?? 'Não foi possível salvar o motorista.');
      if (!driverId) { router.replace(`/cadastros/caminhoneiros/${body.id}`); return; }
      setDriver(body); setSaved(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o motorista.'); }
    finally { setSaving(false); }
  }

  return <ManagerShell><PageFrame eyebrow="Caminhoneiros" title={driverId ? driver?.name ?? 'Motorista' : 'Cadastrar caminhoneiro'} description="Mantenha o contato e a base de referência usados para montar a frota e sugerir rotas próximas." backHref="/cadastros/caminhoneiros">
    {loading ? <div className="max-w-5xl border bg-white p-8 text-sm text-muted-foreground">Carregando motorista…</div> : null}
    {!loading ? <form onSubmit={submit} className="max-w-5xl border bg-white">
      {error ? <div role="alert" className="border-b border-alert/25 bg-alert-soft px-5 py-4 text-sm font-medium text-alert">{error}</div> : null}
      {saved ? <output className="flex items-center gap-3 border-b border-success/25 bg-success-soft px-5 py-4 text-sm"><CheckCircle2 aria-hidden="true" className="size-5 text-success" /><strong className="text-success">Alterações salvas.</strong></output> : null}
      <div className="space-y-8 p-5 sm:p-7">
        <section><h2 className="text-lg font-semibold">Dados do motorista</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Informações para contato e atribuição de veículo.</p><div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field id="driver-name" label="Nome completo"><Input id="driver-name" value={name} onChange={(event) => setName(event.target.value)} required className="h-11 rounded-none" /></Field>
          <Field id="driver-phone" label="Telefone"><Input id="driver-phone" value={phone} onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} required placeholder="(62) 99999-9999" className="h-11 rounded-none" /></Field>
        </div></section>
        <ReferenceBasePicker value={base} onChange={setBase} />
        <section className="flex items-center gap-4 border bg-subtle p-4"><div className="min-w-0 flex-1"><Label htmlFor="driver-active" className="font-medium">Motorista ativo</Label><p className="mt-1 text-sm text-muted-foreground">Motoristas inativos não podem receber veículos ou rotas.</p></div><Switch id="driver-active" checked={active} onCheckedChange={setActive} /></section>
        {driver?.currentVehicleId ? <section className="flex flex-col gap-4 border bg-subtle p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Truck aria-hidden="true" className="mt-0.5 size-5 text-primary" /><div><p className="font-semibold">Veículo atual: {driver.currentVehicleLabel}</p><p className="mt-1 text-sm text-muted-foreground">{driver.currentVehiclePlate}{driver.activeRouteName ? ` · ${driver.activeRouteName}` : ''}</p></div></div><Link href="/cadastros/frota" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-none')}>Abrir Frota</Link></section> : null}
      </div>
      <footer className="flex flex-col-reverse gap-3 border-t bg-subtle px-5 py-4 sm:flex-row sm:justify-end"><Link href="/cadastros/caminhoneiros" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-none')}>Cancelar</Link><Button type="submit" disabled={saving} className="h-11 cursor-pointer rounded-none bg-[#245f0a]"><Save aria-hidden="true" /> {saving ? 'Salvando…' : 'Salvar motorista'}</Button></footer>
    </form> : null}
  </PageFrame></ManagerShell>;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) { return <div className="flex min-w-0 flex-col"><div className="flex min-h-10 items-end"><Label htmlFor={id}>{label} <span className="text-alert">*</span></Label></div><div className="mt-2">{children}</div></div>; }
