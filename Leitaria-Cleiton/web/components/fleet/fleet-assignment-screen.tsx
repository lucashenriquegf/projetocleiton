'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Link2,
  Phone,
  Route,
  Search,
  Truck,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { StatusPill } from '@/components/system/status-pill';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DriverRecord, FleetAssignment, Vehicle, VehicleCategory } from '@/lib/domain';
import {
  formatBrazilianPhone,
  formatBrazilianPlateInput,
} from '@/lib/input-masks';
import { cn } from '@/lib/utils';

type CandidateResult<T> = { items: T[]; total: number; page: number; pageSize: number };
type AssignmentStep = 1 | 2 | 3;

const emptyVehicles: CandidateResult<Vehicle> = { items: [], total: 0, page: 1, pageSize: 10 };
const emptyDrivers: CandidateResult<DriverRecord> = { items: [], total: 0, page: 1, pageSize: 10 };

export function FleetAssignmentScreen({ assignmentId }: { assignmentId?: string }) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<FleetAssignment | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<AssignmentStep>(1);
  const [loading, setLoading] = useState(Boolean(assignmentId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    void fetch(`/api/fleet/${assignmentId}`)
      .then(async (response) => {
        const body = (await response.json()) as FleetAssignment & { message?: string };
        if (!response.ok) throw new Error(body.message ?? 'Vínculo não encontrado.');
        const [vehicleResponse, driverResponse] = await Promise.all([
          fetch(`/api/vehicles/${body.vehicleId}`),
          fetch(`/api/drivers/${body.driverId}`),
        ]);
        if (!vehicleResponse.ok || !driverResponse.ok) throw new Error('Não foi possível carregar os responsáveis atuais.');
        return {
          assignment: body,
          vehicle: await vehicleResponse.json() as Vehicle,
          driver: await driverResponse.json() as DriverRecord,
        };
      })
      .then((result) => {
        if (!active) return;
        setAssignment(result.assignment);
        setVehicle(result.vehicle);
        setDriver(result.driver);
        if (result.assignment.endedAt) setStep(3);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o vínculo.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [assignmentId]);

  const vehicleIssue = vehicle ? getVehicleIssue(vehicle, assignment?.activeRouteId ?? null) : '';
  const driverIssue = driver ? getDriverIssue(driver, assignment?.activeRouteId ?? null) : '';
  const existingPair = Boolean(
    !assignment &&
    vehicle &&
    driver &&
    vehicle.currentDriverId === driver.id &&
    driver.currentVehicleId === vehicle.id,
  );
  const pairIssue = existingPair ? 'Este motorista já está vinculado a este veículo.' : '';
  const changed = !existingPair && (!assignment || assignment.vehicleId !== vehicle?.id || assignment.driverId !== driver?.id);
  const ended = Boolean(assignment?.endedAt);
  const impacts = useMemo(() => getImpacts(assignment, vehicle, driver), [assignment, vehicle, driver]);
  const hasActiveRoute = Boolean(assignment?.activeRouteId);
  const transfer = hasActiveRoute && changed;

  async function save() {
    if (!vehicle || !driver || vehicleIssue || driverIssue || !changed || ended) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(transfer ? `/api/routes/${assignment?.activeRouteId}/transfer` : '/api/fleet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vehicleId: vehicle.id, driverId: driver.id, notes: notes.trim() || undefined }),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? 'Não foi possível salvar o vínculo.');
      router.push(`/cadastros/frota?salvo=${transfer ? 'transferido' : assignment ? 'alterado' : 'criado'}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o vínculo.');
    } finally {
      setSaving(false);
    }
  }

  const title = hasActiveRoute ? 'Transferir responsabilidade' : assignment ? 'Alterar vínculo' : 'Novo vínculo';
  const actionLabel = saving ? 'Salvando…' : hasActiveRoute ? 'Transferir responsabilidade' : assignment ? 'Confirmar troca' : 'Criar vínculo';
  const vehicleReady = Boolean(vehicle && !vehicleIssue);
  const driverReady = Boolean(driver && !driverIssue);
  const pairReady = vehicleReady && driverReady && !pairIssue;

  function goForward() {
    if (step === 1 && vehicleReady) setStep(2);
    if (step === 2 && pairReady) setStep(3);
  }

  function goBack() {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  }

  return (
    <ManagerShell>
      <PageFrame
        eyebrow="Frota"
        title={title}
        description="Faça uma escolha por vez. No final, confira as responsabilidades que serão alteradas antes de confirmar."
        backHref="/cadastros/frota"
        wide
      >
        {error ? <div role="alert" className="mb-5 border border-alert/25 bg-alert-soft px-5 py-4 text-sm font-medium text-alert">{error}</div> : null}
        {loading ? <div className="border bg-white p-8 text-sm text-muted-foreground">Carregando vínculo…</div> : null}

        {!loading && (!assignmentId || assignment) ? (
          <div className="space-y-6">
            {ended ? (
              <div className="border border-warning/30 bg-warning-soft px-5 py-4 text-sm">
                <strong>Este vínculo já foi encerrado.</strong> Ele pode ser consultado, mas não pode ser alterado.
              </div>
            ) : null}

            <AssignmentSteps
              step={step}
              vehicleReady={vehicleReady}
              driverReady={pairReady}
              onChange={setStep}
              disabled={ended}
            />

            {step === 1 ? (
              <div className="mx-auto w-full max-w-5xl">
                <VehiclePicker selected={vehicle} onSelect={setVehicle} currentRouteId={assignment?.activeRouteId ?? null} disabled={ended} />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mx-auto w-full max-w-5xl space-y-4">
                {vehicle ? (
                  <CompactChoice
                    icon={Truck}
                    label="Veículo escolhido"
                    title={`${vehicle.manufacturer} ${vehicle.model}`}
                    detail={`${vehicle.plate} · ${vehicle.baseName ?? 'Base não informada'}`}
                    onEdit={() => setStep(1)}
                  />
                ) : null}
                <DriverPicker selected={driver} onSelect={setDriver} currentRouteId={assignment?.activeRouteId ?? null} disabled={ended} />
                {pairIssue ? <div role="alert" className="border border-alert/25 bg-alert-soft px-5 py-4 text-sm font-medium text-alert">{pairIssue}</div> : null}
              </div>
            ) : null}

            {step === 3 ? <section className="mx-auto w-full max-w-5xl border bg-white">
              <header className="border-b px-5 py-4 sm:px-6">
                <h2 className="text-lg font-semibold">Resumo da mudança</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">A data e a hora do novo vínculo serão definidas automaticamente pelo servidor.</p>
              </header>
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                <SummaryIdentity icon={Truck} label="Veículo" title={vehicle ? `${vehicle.manufacturer} ${vehicle.model}` : 'Nenhum veículo selecionado'} detail={vehicle?.plate ?? 'Escolha um veículo na lista'} onEdit={ended ? undefined : () => setStep(1)} />
                <ArrowRight aria-hidden="true" className="hidden size-6 text-muted-foreground lg:block" />
                <SummaryIdentity icon={UserRound} label="Motorista responsável" title={driver?.name ?? 'Nenhum motorista selecionado'} detail={driver?.phone ?? 'Escolha um motorista na lista'} onEdit={ended ? undefined : () => setStep(2)} />
              </div>

              {assignment?.activeRouteName ? (
                <div className="flex items-start gap-3 border-t bg-warning-soft px-5 py-4 text-sm sm:px-6">
                  <Route aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
                  <p><strong>Rota em andamento:</strong> {assignment.activeRouteName}. A alteração será registrada também no histórico de responsabilidade da rota.</p>
                </div>
              ) : null}

              {impacts.length > 0 ? (
                <div className="border-t px-5 py-4 sm:px-6">
                  <p className="text-sm font-semibold">O que será alterado</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {impacts.map((impact) => <li key={impact} className="flex items-start gap-2"><ArrowLeft aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{impact}</span></li>)}
                  </ul>
                </div>
              ) : null}

              {vehicleIssue || driverIssue || pairIssue ? (
                <div role="alert" className="border-t border-alert/25 bg-alert-soft px-5 py-4 text-sm font-medium text-alert sm:px-6">
                  {vehicleIssue || driverIssue || pairIssue}
                </div>
              ) : null}

              <div className="border-t px-5 py-5 sm:px-6">
                <Label htmlFor="fleet-notes">Observação da troca <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Textarea id="fleet-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: troca de turno" className="mt-2 min-h-24 resize-y rounded-none" disabled={ended} />
              </div>
            </section> : null}

            <footer className="sticky bottom-[70px] z-20 flex flex-col-reverse gap-3 border bg-subtle/95 px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between lg:bottom-0">
              {step === 1 ? (
                <Link href="/cadastros/frota" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-none bg-white')}>Cancelar</Link>
              ) : (
                <Button type="button" variant="outline" size="lg" onClick={goBack} className="h-11 cursor-pointer rounded-none bg-white">
                  <ArrowLeft aria-hidden="true" /> Voltar
                </Button>
              )}
              {ended ? (
                <Link href="/cadastros/frota" className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-none bg-[#245f0a]')}>Voltar para Frota</Link>
              ) : step < 3 ? (
                <Button type="button" onClick={goForward} disabled={step === 1 ? !vehicleReady : !pairReady} className="h-11 cursor-pointer rounded-none bg-[#245f0a] px-5">
                  {step === 1 ? 'Continuar para motorista' : 'Revisar vínculo'} <ArrowRight aria-hidden="true" />
                </Button>
              ) : (
                <Button type="button" onClick={() => void save()} disabled={!vehicle || !driver || Boolean(vehicleIssue || driverIssue || pairIssue) || !changed || saving} className="h-11 cursor-pointer rounded-none bg-[#245f0a] px-5">
                  <Link2 aria-hidden="true" /> {actionLabel}
                </Button>
              )}
            </footer>
          </div>
        ) : null}
      </PageFrame>
    </ManagerShell>
  );
}

function VehiclePicker({ selected, onSelect, currentRouteId, disabled }: { selected: Vehicle | null; onSelect: (vehicle: Vehicle | null) => void; currentRouteId: string | null; disabled: boolean }) {
  const [result, setResult] = useState<CandidateResult<Vehicle>>(emptyVehicles);
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [driverName, setDriverName] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [base, setBase] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const search = new URLSearchParams({ tipo: 'veiculos', pagina: String(page), porPagina: '10' });
    if (plate) search.set('placa', plate);
    if (model) search.set('modelo', model);
    if (driverName) search.set('motorista', driverName);
    if (status) search.set('situacao', status);
    if (category) search.set('categoria', category);
    if (base) search.set('base', base);
    void fetch(`/api/fleet/options?${search}`)
      .then(async (response) => {
        const body = await response.json() as CandidateResult<Vehicle> & { message?: string };
        if (!response.ok) throw new Error(body.message);
        return body;
      })
      .then((body) => { if (active) setResult(body); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os veículos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [plate, model, driverName, status, category, base, page]);

  return (
    <CandidateSection icon={Truck} title="1. Escolha o veículo" description="Busque por placa, modelo ou base e confira capacidade e situação.">
      {selected ? <SelectedCandidate title={`${selected.manufacturer} ${selected.model}`} detail={`${selected.plate} · ${selected.baseName ?? 'Base não informada'}`} onClear={disabled ? undefined : () => onSelect(null)} /> : null}
      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-3">
        <SearchField label="Placa" value={plate} onChange={(value) => { setPlate(value); setPage(1); }} transform={formatBrazilianPlateInput} placeholder="Ex.: BRA2E19" />
        <SearchField label="Modelo" value={model} onChange={(value) => { setModel(value); setPage(1); }} placeholder="Ex.: Hilux" />
        <SearchField label="Motorista atual" value={driverName} onChange={(value) => { setDriverName(value); setPage(1); }} placeholder="Nome do motorista" />
        <SelectField label="Situação" value={status} onChange={(value) => { setStatus(value); setPage(1); }}><option value="">Todas</option><option value="AVAILABLE">Disponíveis</option><option value="ON_ROUTE">Em rota</option><option value="MAINTENANCE">Em manutenção</option><option value="INACTIVE">Arquivados</option></SelectField>
        <SelectField label="Tipo" value={category} onChange={(value) => { setCategory(value); setPage(1); }}><option value="">Todos</option><option value="CAR">Carro</option><option value="UTILITY">Utilitário / picape</option><option value="VAN">Van</option><option value="TRUCK">Caminhão</option></SelectField>
        <SearchField label="Base" value={base} onChange={(value) => { setBase(value); setPage(1); }} placeholder="Nome da base" />
      </div>
      <CandidateBody loading={loading} error={error} empty={result.items.length === 0} emptyText="Nenhum veículo encontrado.">
        {result.items.map((item) => {
          const issue = getVehicleIssue(item, currentRouteId);
          const chosen = item.id === selected?.id;
          return <button key={item.id} type="button" disabled={disabled || Boolean(issue)} onClick={() => onSelect(item)} className={cn(candidateClass, chosen && 'border-l-4 border-l-primary bg-primary-soft', (disabled || issue) && 'cursor-not-allowed opacity-60')}><span className="flex items-start justify-between gap-3"><span><strong className="block break-words">{item.manufacturer} {item.model}</strong><span className="mt-1 block text-sm font-medium text-primary">{item.plate}</span></span>{chosen ? <Check aria-hidden="true" className="size-5 shrink-0 text-primary" /> : item.activeRouteId ? <StatusPill tone="warning">Em rota</StatusPill> : null}</span><span className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2"><span>{categoryLabels[item.category]} · {item.traction}</span><span>{formatNumber(item.capacityKg)} kg · {formatNumber(item.capacityM3)} m³</span><span className="break-words">Base: {item.baseName ?? 'Não informada'}</span><span className="break-words">Motorista: {item.currentDriverName ?? 'Sem motorista'}</span></span>{issue ? <span className="mt-2 block text-sm font-medium text-alert">{issue}</span> : null}</button>;
        })}
      </CandidateBody>
      <CandidatePagination page={result.page} total={result.total} pageSize={result.pageSize} onChange={setPage} />
    </CandidateSection>
  );
}

function DriverPicker({ selected, onSelect, currentRouteId, disabled }: { selected: DriverRecord | null; onSelect: (driver: DriverRecord | null) => void; currentRouteId: string | null; disabled: boolean }) {
  const [result, setResult] = useState<CandidateResult<DriverRecord>>(emptyDrivers);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [status, setStatus] = useState('');
  const [base, setBase] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const search = new URLSearchParams({ tipo: 'motoristas', pagina: String(page), porPagina: '10' });
    if (name) search.set('nome', name);
    if (phone) search.set('telefone', phone);
    if (vehiclePlate) search.set('placaVeiculo', vehiclePlate);
    if (status) search.set('situacao', status);
    if (base) search.set('base', base);
    void fetch(`/api/fleet/options?${search}`)
      .then(async (response) => {
        const body = await response.json() as CandidateResult<DriverRecord> & { message?: string };
        if (!response.ok) throw new Error(body.message);
        return body;
      })
      .then((body) => { if (active) setResult(body); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os motoristas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [name, phone, vehiclePlate, status, base, page]);

  return (
    <CandidateSection icon={UserRound} title="2. Escolha o motorista" description="Busque por nome, telefone ou base e confira sua responsabilidade atual.">
      {selected ? <SelectedCandidate title={selected.name} detail={`${selected.phone ?? 'Telefone não informado'} · ${selected.baseName ?? 'Base não informada'}`} onClear={disabled ? undefined : () => onSelect(null)} /> : null}
      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-3">
        <SearchField label="Nome" value={name} onChange={(value) => { setName(value); setPage(1); }} placeholder="Nome do motorista" />
        <SearchField label="Telefone" value={phone} onChange={(value) => { setPhone(value); setPage(1); }} transform={formatBrazilianPhone} inputMode="tel" placeholder="(62) 99999-9999" />
        <SearchField label="Placa do veículo atual" value={vehiclePlate} onChange={(value) => { setVehiclePlate(value); setPage(1); }} transform={formatBrazilianPlateInput} placeholder="Ex.: BRA2E19" />
        <SelectField label="Situação" value={status} onChange={(value) => { setStatus(value); setPage(1); }}><option value="">Todas</option><option value="AVAILABLE">Disponíveis</option><option value="ON_ROUTE">Em rota</option><option value="INACTIVE">Inativos</option></SelectField>
        <SearchField label="Base" value={base} onChange={(value) => { setBase(value); setPage(1); }} placeholder="Nome da base" className="lg:col-span-2" />
      </div>
      <CandidateBody loading={loading} error={error} empty={result.items.length === 0} emptyText="Nenhum motorista encontrado.">
        {result.items.map((item) => {
          const issue = getDriverIssue(item, currentRouteId);
          const chosen = item.id === selected?.id;
          return <button key={item.id} type="button" disabled={disabled || Boolean(issue)} onClick={() => onSelect(item)} className={cn(candidateClass, chosen && 'border-l-4 border-l-primary bg-primary-soft', (disabled || issue) && 'cursor-not-allowed opacity-60')}><span className="flex items-start justify-between gap-3"><span><strong className="block break-words">{item.name}</strong><span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Phone aria-hidden="true" className="size-3.5 shrink-0" />{item.phone ?? 'Telefone não informado'}</span></span>{chosen ? <Check aria-hidden="true" className="size-5 shrink-0 text-primary" /> : item.activeRouteId ? <StatusPill tone="warning">Em rota</StatusPill> : null}</span><span className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2"><span className="break-words">Base: {item.baseName ?? 'Não informada'}</span><span className="break-words">Veículo: {item.currentVehiclePlate ?? 'Sem veículo'}</span></span>{issue ? <span className="mt-2 block text-sm font-medium text-alert">{issue}</span> : null}</button>;
        })}
      </CandidateBody>
      <CandidatePagination page={result.page} total={result.total} pageSize={result.pageSize} onChange={setPage} />
    </CandidateSection>
  );
}

function AssignmentSteps({ step, vehicleReady, driverReady, onChange, disabled }: { step: AssignmentStep; vehicleReady: boolean; driverReady: boolean; onChange: (step: AssignmentStep) => void; disabled: boolean }) {
  const steps: Array<{ id: AssignmentStep; label: string; available: boolean; complete: boolean }> = [
    { id: 1, label: 'Veículo', available: true, complete: vehicleReady },
    { id: 2, label: 'Motorista', available: vehicleReady, complete: driverReady },
    { id: 3, label: 'Confirmar', available: vehicleReady && driverReady, complete: false },
  ];

  return (
    <nav aria-label="Etapas do vínculo" className="mx-auto w-full max-w-5xl border bg-white">
      <ol className="grid grid-cols-3">
        {steps.map((item) => {
          const active = step === item.id;
          return (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onChange(item.id)}
                disabled={disabled || !item.available}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex min-h-16 w-full cursor-pointer items-center justify-center gap-2 border-b-2 px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:justify-start sm:px-5',
                  active ? 'border-b-primary bg-primary-soft text-primary' : 'border-b-transparent text-muted-foreground hover:bg-subtle hover:text-foreground',
                  (disabled || !item.available) && 'cursor-not-allowed opacity-55 hover:bg-transparent hover:text-muted-foreground',
                )}
              >
                <span className={cn('grid size-7 shrink-0 place-items-center border text-xs tabular-nums', active || item.complete ? 'border-primary text-primary' : 'border-border')}>
                  {item.complete && item.id !== step ? <Check aria-hidden="true" className="size-4" /> : item.id}
                </span>
                <span className="hidden min-w-0 sm:block">{item.label}</span>
                <span className="sr-only sm:hidden">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CompactChoice({ icon: Icon, label, title, detail, onEdit }: { icon: typeof Truck; label: string; title: string; detail: string; onEdit: () => void }) {
  return (
    <section className="flex items-center justify-between gap-4 border bg-subtle px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center bg-white text-primary"><Icon aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="mt-1 break-words font-semibold">{title}</p>
          <p className="mt-0.5 break-words text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Button type="button" variant="outline" onClick={onEdit} className="h-11 shrink-0 cursor-pointer rounded-none bg-white">Alterar</Button>
    </section>
  );
}

function CandidateSection({ icon: Icon, title, description, children }: { icon: typeof Truck; title: string; description: string; children: React.ReactNode }) {
  return <section className="min-w-0 border bg-white"><header className="flex items-start gap-3 border-b p-5"><span className="grid size-10 shrink-0 place-items-center bg-primary-soft text-primary"><Icon aria-hidden="true" className="size-5" /></span><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div></header>{children}</section>;
}

function SelectedCandidate({ title, detail, onClear }: { title: string; detail: string; onClear?: () => void }) {
  return <div className="flex min-h-16 items-center justify-between gap-4 border-b bg-primary-soft px-4 py-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Selecionado</p><p className="mt-1 break-words font-semibold">{title}</p><p className="mt-1 break-words text-sm text-muted-foreground">{detail}</p></div>{onClear ? <button type="button" onClick={onClear} className="min-h-11 shrink-0 cursor-pointer px-2 text-sm font-semibold text-primary hover:underline">Limpar</button> : null}</div>;
}

function CandidateBody({ loading, error, empty, emptyText, children }: { loading: boolean; error: string; empty: boolean; emptyText: string; children: React.ReactNode }) {
  return <div className="max-h-[36rem] min-h-64 divide-y overflow-y-auto" aria-live="polite">{loading ? <p className="p-6 text-sm text-muted-foreground">Carregando opções…</p> : null}{error ? <p role="alert" className="p-6 text-sm font-medium text-alert">{error}</p> : null}{!loading && !error && empty ? <p className="p-6 text-sm text-muted-foreground">{emptyText}</p> : null}{!loading && !error ? children : null}</div>;
}

function CandidatePagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <footer className="flex min-h-14 items-center justify-between gap-3 border-t bg-subtle px-4 py-2 text-sm"><span className="text-muted-foreground">{total} opções</span><span className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="grid size-10 cursor-pointer place-items-center border bg-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior"><ChevronLeft aria-hidden="true" className="size-4" /></button><strong className="tabular-nums">{page}/{pages}</strong><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="grid size-10 cursor-pointer place-items-center border bg-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Próxima página"><ChevronRight aria-hidden="true" className="size-4" /></button></span></footer>;
}

function SearchField({ label, value, onChange, placeholder, className, transform, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; className?: string; transform?: (value: string) => string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) {
  return <label className={cn('flex min-w-0 flex-col', className)}><span className="flex min-h-6 items-end text-sm font-semibold">{label}</span><span className="relative mt-2"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input value={value} onChange={(event) => onChange(transform ? transform(event.target.value) : event.target.value)} inputMode={inputMode} placeholder={placeholder} className="h-11 rounded-none pl-10" /></span></label>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col"><span className="flex min-h-6 items-end text-sm font-semibold">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full cursor-pointer border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">{children}</select></label>;
}

function SummaryIdentity({ icon: Icon, label, title, detail, onEdit }: { icon: typeof Truck; label: string; title: string; detail: string; onEdit?: () => void }) {
  return <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center bg-subtle text-muted-foreground"><Icon aria-hidden="true" className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-1 break-words font-semibold">{title}</p><p className="mt-1 break-words text-sm text-muted-foreground">{detail}</p>{onEdit ? <button type="button" onClick={onEdit} className="mt-3 min-h-11 cursor-pointer text-sm font-semibold text-primary hover:underline">Alterar {label.toLocaleLowerCase('pt-BR')}</button> : null}</div></div>;
}

function getVehicleIssue(vehicle: Vehicle, currentRouteId: string | null) {
  if (!vehicle.active) return 'Este veículo está arquivado.';
  if (vehicle.operationalStatus === 'MAINTENANCE') return 'Este veículo está em manutenção.';
  if (vehicle.activeRouteId && vehicle.activeRouteId !== currentRouteId) return `Este veículo já está executando ${vehicle.activeRouteName ?? 'outra rota'}.`;
  return '';
}

function getDriverIssue(driver: DriverRecord, currentRouteId: string | null) {
  if (!driver.active) return 'Este motorista está inativo.';
  if (driver.activeRouteId && driver.activeRouteId !== currentRouteId) return `Este motorista já está executando ${driver.activeRouteName ?? 'outra rota'}.`;
  return '';
}

function getImpacts(assignment: FleetAssignment | null, vehicle: Vehicle | null, driver: DriverRecord | null) {
  if (!vehicle || !driver) return [];
  const impacts = new Set<string>();
  if (assignment && (assignment.vehicleId !== vehicle.id || assignment.driverId !== driver.id)) {
    impacts.add(`O vínculo entre ${assignment.driverName} e ${assignment.vehiclePlate} será encerrado e preservado no histórico.`);
  }
  const vehicleCurrentLinkIsOriginal = Boolean(
    assignment && vehicle.id === assignment.vehicleId && vehicle.currentDriverId === assignment.driverId,
  );
  if (vehicle.currentDriverId && vehicle.currentDriverId !== driver.id && !vehicleCurrentLinkIsOriginal) {
    impacts.add(`${vehicle.currentDriverName ?? 'O motorista atual'} deixará de ser responsável pelo veículo ${vehicle.plate}.`);
  }
  const driverCurrentLinkIsOriginal = Boolean(
    assignment && driver.id === assignment.driverId && driver.currentVehicleId === assignment.vehicleId,
  );
  if (driver.currentVehicleId && driver.currentVehicleId !== vehicle.id && !driverCurrentLinkIsOriginal) {
    impacts.add(`${driver.name} deixará de ser responsável pelo veículo ${driver.currentVehiclePlate ?? 'atual'}.`);
  }
  return [...impacts];
}

const candidateClass = 'block min-h-24 w-full cursor-pointer p-4 text-left transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';
const categoryLabels: Record<VehicleCategory, string> = { CAR: 'Carro', UTILITY: 'Utilitário / picape', VAN: 'Van', TRUCK: 'Caminhão' };

function formatNumber(value: number) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value); }
