'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  RefreshCw,
  Route as RouteIcon,
  Split,
  Truck,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { RouteMap } from '@/components/routes/route-map';
import { StatusPill } from '@/components/system/status-pill';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { DemandRecord } from '@/lib/mocks/demands';
import { saveDemandDemoOverride } from '@/lib/mocks/demand-demo-state';
import {
  deliveryPlans,
  drivers,
  fleetVehicles,
  logisticalCoverage,
  logisticsRoutes,
} from '@/lib/mocks/operations';
import { cn } from '@/lib/utils';

const steps = ['Pedido', 'Onde buscar', 'Veículos e motoristas', 'Revisão'];
type DeliveryPlan = ReturnType<typeof evaluateDeliveryPlans>[number];

const initialAssignments = Object.fromEntries(
  deliveryPlans.flatMap((plan) =>
    plan.routes.map((route) => [route.id, route.suggestedDriverId]),
  ),
);
const initialVehicleAssignments = Object.fromEntries(
  deliveryPlans.flatMap((plan) =>
    plan.routes.map((route) => [
      route.id,
      fleetVehicles.find((vehicle) => vehicle.driverId === route.suggestedDriverId)?.id ?? fleetVehicles[0].id,
    ]),
  ),
);

export function PlanningFlow({ demand }: { demand: DemandRecord }) {
  const [step, setStep] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [driverAssignments, setDriverAssignments] =
    useState<Record<string, string>>(initialAssignments);
  const [vehicleAssignments, setVehicleAssignments] =
    useState<Record<string, string>>(initialVehicleAssignments);
  const [replacementApproved, setReplacementApproved] = useState(false);
  const [reductionApproved, setReductionApproved] = useState(false);
  const [approved, setApproved] = useState(false);
  const adjustmentCount =
    demand.id === 'joao-paulo' || demand.id === 'nova-esperanca' ? 2 : 0;
  const planOptions = evaluateDeliveryPlans(demand);
  const selectedPlan = planOptions.find((plan) => plan.id === selectedPlanId);
  const adjustmentsApproved =
    adjustmentCount === 0 || (replacementApproved && reductionApproved);
  const canApprove = Boolean(
    selectedPlan?.coverage === '100%' &&
    selectedPlan.meetsDeadline &&
    adjustmentsApproved,
  );

  const approvePlan = () => {
    if (!selectedPlan) return;
    const routes = selectedPlan.routes.map((route) => ({
      id: `${demand.id}-${route.id}`,
      driver:
        drivers.find(
          (candidate) =>
            candidate.id ===
            (driverAssignments[route.id] ?? route.suggestedDriverId),
        )?.name ?? 'Motorista a definir',
      vehicle:
        fleetVehicles.find((candidate) => candidate.id === vehicleAssignments[route.id])?.plate ??
        'Veículo a definir',
      name: `${
        drivers.find(
          (candidate) =>
            candidate.id ===
            (driverAssignments[route.id] ?? route.suggestedDriverId),
        )?.name ?? 'Motorista'
      } — ${demand.school}`,
    }));

    saveDemandDemoOverride(demand.id, {
      status: 'Planejada',
      coverage: 100,
      routes,
    });
    setApproved(true);
  };

  if (approved && selectedPlan)
    return (
      <ApprovalSuccess
        demand={demand}
        plan={selectedPlan}
        assignments={driverAssignments}
        vehicleAssignments={vehicleAssignments}
      />
    );

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <Link
        href="/demandas"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Voltar às demandas
      </Link>
      <header className="mt-2 border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Demanda de {demand.dateLabel}
        </p>
        <h1 className="mt-1.5 text-[1.8rem] font-semibold tracking-[-0.04em]">
          Planejar demanda
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {demand.school} · até {demand.deadline}
        </p>
      </header>
      <StepIndicator current={step} />
      <div className="mt-6">
        {step === 0 ? <OrderStep demand={demand} /> : null}
        {step === 1 ? (
          <AvailabilityStep
            demand={demand}
            adjustmentCount={adjustmentCount}
            replacementApproved={replacementApproved}
            reductionApproved={reductionApproved}
            onReplacementChange={setReplacementApproved}
            onReductionChange={setReductionApproved}
          />
        ) : null}
        {step === 2 ? (
          <PlanStep
            demand={demand}
            plans={planOptions}
            selected={selectedPlanId}
            onSelect={setSelectedPlanId}
          />
        ) : null}
        {step === 3 && selectedPlan ? (
          <ReviewStep
            demand={demand}
            plan={selectedPlan}
            assignments={driverAssignments}
            onAssign={(routeId, driverId) =>
              setDriverAssignments((current) => ({
                ...current,
                [routeId]: driverId,
              }))
            }
            vehicleAssignments={vehicleAssignments}
            onAssignVehicle={(routeId, vehicleId) =>
              setVehicleAssignments((current) => ({ ...current, [routeId]: vehicleId }))
            }
            adjustmentsApproved={adjustmentsApproved}
            adjustmentCount={adjustmentCount}
          />
        ) : null}
      </div>
      <div className="sticky bottom-[70px] z-30 mt-6 flex items-center justify-between gap-3 border bg-white/95 p-3 shadow-[0_-12px_35px_rgba(15,30,18,.08)] backdrop-blur lg:bottom-0">
        <Button
          variant="ghost"
          className="h-11 rounded-none"
          disabled={step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          <ArrowLeft aria-hidden="true" /> Voltar
        </Button>
        {step < 3 ? (
          <Button
            disabled={
              (step === 1 && !adjustmentsApproved) ||
              (step === 2 && !selectedPlan)
            }
            title={
              step === 1 && !adjustmentsApproved
                ? 'Aprove os dois ajustes antes de continuar.'
                : step === 2 && !selectedPlan
                  ? 'Escolha uma das sugestões para continuar.'
                  : undefined
            }
            className="h-11 rounded-none bg-[#245f0a] px-5 font-semibold hover:bg-[#1c4d07]"
            onClick={() => setStep((current) => Math.min(3, current + 1))}
          >
            {step === 0
              ? 'Ver onde buscar'
              : step === 1
                ? adjustmentsApproved
                  ? 'Ver veículos e motoristas sugeridos'
                  : 'Aprove os ajustes'
                : selectedPlan
                  ? 'Revisar escolha'
                  : 'Escolha uma opção'}
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <Button
            disabled={!canApprove}
            title={
              !canApprove
                ? 'Escolha uma opção que atenda todo o pedido.'
                : undefined
            }
            className="h-11 rounded-none bg-[#245f0a] px-5 font-semibold hover:bg-[#1c4d07]"
            onClick={approvePlan}
          >
            <Check aria-hidden="true" /> Aprovar plano com{' '}
            {selectedPlan?.routeCount === 1
              ? '1 veículo e motorista'
              : `${selectedPlan?.routeCount ?? 0} veículos e motoristas`}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Etapas do planejamento" className="mt-6 overflow-x-auto">
      <ol className="flex min-w-[640px] items-center">
        {steps.map((label, index) => (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center border text-xs font-semibold',
                index < current && 'border-primary bg-primary text-white',
                index === current && 'border-[#101510] bg-[#101510] text-white',
              )}
            >
              {index < current ? (
                <Check aria-hidden="true" className="size-4" />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                'ml-2 text-xs font-medium',
                index === current ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            {index < steps.length - 1 ? (
              <span className="mx-3 h-px flex-1 bg-border" />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function OrderStep({ demand }: { demand: DemandRecord }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_340px]">
      <section className="overflow-hidden rounded-2xl border bg-white">
        <header className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold">Conferir a demanda</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A escola, a data e as quantidades vieram do cardápio publicado.
          </p>
        </header>
        <dl className="grid border-b sm:grid-cols-3">
          <div className="border-b p-5 sm:border-b-0 sm:border-r">
            <dt className="text-sm text-muted-foreground">Escola</dt>
            <dd className="mt-1 font-semibold">{demand.school}</dd>
          </div>
          <div className="border-b p-5 sm:border-b-0 sm:border-r">
            <dt className="text-sm text-muted-foreground">Data e prazo</dt>
            <dd className="mt-1 font-semibold">
              {demand.dateLabel} · {demand.deadline}
            </dd>
          </div>
          <div className="p-5">
            <dt className="text-sm text-muted-foreground">Cardápio</dt>
            <dd className="mt-1 font-semibold">{demand.menuLabel}</dd>
          </div>
        </dl>
        <div className="p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Produtos e quantidades</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A disponibilidade só será confirmada depois de verificar quais
              fontes cabem nas rotas dos motoristas.
            </p>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] bg-subtle px-4 py-3 text-sm font-medium text-muted-foreground">
              <span>Produto</span>
              <span>Quantidade necessária</span>
            </div>
            <div className="divide-y">
              {demand.products.map((product) => (
                <div
                  key={product.name}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4"
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {product.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <aside className="h-fit rounded-2xl border bg-white p-5 xl:sticky xl:top-6">
        <h2 className="font-semibold">Resumo da demanda</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Pair label="Escola" value={demand.school} />
          <Pair label="Data" value={demand.dateLabel} />
          <Pair label="Prazo" value={demand.deadline} />
          <Pair label="Produtos" value={String(demand.productCount)} />
        </dl>
        <div className="mt-5 border-t pt-4">
          <p className="text-xs text-muted-foreground">Próximo passo</p>
          <p className="mt-1 text-sm font-medium">
            Cruzar produtores, motoristas e rotas aceitáveis.
          </p>
        </div>
      </aside>
    </div>
  );
}

function AvailabilityStep({
  demand,
  adjustmentCount,
  replacementApproved,
  reductionApproved,
  onReplacementChange,
  onReductionChange,
}: {
  demand: DemandRecord;
  adjustmentCount: number;
  replacementApproved: boolean;
  reductionApproved: boolean;
  onReplacementChange: (value: boolean) => void;
  onReductionChange: (value: boolean) => void;
}) {
  const coverageItems = coverageForDemand(demand);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
      <section className="border bg-white">
        <header className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">
            Onde os produtos podem ser buscados
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            O sistema mostra somente os locais que um motorista consegue visitar
            sem atrasar a entrega.
          </p>
        </header>
        {adjustmentCount > 0 ? (
          <div className="grid gap-3 border-b bg-subtle p-4 lg:grid-cols-2">
            <AdjustmentNotice
              title="Substituição necessária"
              description="A demanda original que exigia essa quantidade de produtos foi desfeita. Deseja aprovar a substituição?"
              checked={replacementApproved}
              checkedLabel="Substituição aprovada"
              actionLabel="Aprovar substituição"
              onChange={onReplacementChange}
            />
            <AdjustmentNotice
              title="Redução necessária"
              description="Uma das demandas que exigia este produto foi desfeita. A quantidade precisa ser ajustada para o valor mostrado. Deseja aprovar?"
              checked={reductionApproved}
              checkedLabel="Redução aprovada"
              actionLabel="Aprovar redução"
              onChange={onReductionChange}
            />
          </div>
        ) : null}
        <div className="divide-y">
          {coverageItems.map((product) => (
            <article key={product.product} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{product.product}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pedido: {product.requested}
                  </p>
                </div>
                <StatusPill tone={product.tone}>{product.status}</StatusPill>
              </div>
              <ul className="mt-4 grid gap-2 lg:grid-cols-2">
                {product.sources.map((source) => (
                  <li
                    key={`${product.product}-${source.source}`}
                    className="border bg-subtle p-3"
                  >
                    <div className="flex items-start gap-3">
                      <MapPin
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-primary"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{source.source}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {source.quantity} · {source.driver}
                        </p>
                        <p className="mt-1 text-xs font-medium text-primary">
                          {source.fit}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {'excluded' in product && product.excluded ? (
                <p className="mt-3 flex items-start gap-2 border border-alert/20 bg-alert-soft/55 p-3 text-xs leading-5 text-muted-foreground">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-alert"
                  />
                  {product.excluded}
                </p>
              ) : null}
            </article>
          ))}
          {demand.id === 'joao-paulo' ? (
            <article className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Farinha, feijão e leite</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quantidades completas disponíveis no estoque da cooperativa.
                  </p>
                </div>
                <StatusPill tone="success">Disponível no estoque</StatusPill>
              </div>
            </article>
          ) : null}
        </div>
      </section>
      <aside className="h-fit space-y-4 xl:sticky xl:top-6">
        <div className="border bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
            Resultado
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            {replacementApproved && reductionApproved ? '100%' : 'Pendente'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {replacementApproved && reductionApproved
              ? 'do pedido pode ser atendido'
              : 'aprove os dois ajustes'}
          </p>
          <dl className="mt-5 space-y-3 border-t pt-4 text-sm">
            <Pair label="Sugestão inicial" value="2 motoristas" />
            <Pair label="Combinações comparadas" value="3" />
            <Pair label="Local fora do caminho" value="1" />
          </dl>
        </div>
        <div className="flex gap-3 border border-primary/20 bg-primary-soft/55 p-4">
          <Split aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <p className="text-sm leading-5">
            Carlos está mais perto do estoque e dos primeiros produtores. Ana
            está mais perto das outras coletas. O próximo passo compara o custo
            e o tempo de enviar um ou os dois.
          </p>
        </div>
      </aside>
    </div>
  );
}

function PlanStep({
  demand,
  plans,
  selected,
  onSelect,
}: {
  demand: DemandRecord;
  plans: DeliveryPlan[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  const recommendedPlan = plans.find((plan) => plan.recommended) ?? plans[0];
  const activePlan =
    plans.find((plan) => plan.id === selected) ?? recommendedPlan;
  const showingRecommendation = selected === null;
  const hasRecentChange = Boolean(demand.menuChangeCount);
  const totalStops = activePlan.routes.reduce(
    (total, route) => total + route.stops,
    0,
  );
  const mapRoutes = mapRoutesForPlan(activePlan, demand);
  return (
    <div className="grid min-h-[610px] gap-5 xl:grid-cols-[minmax(0,1.05fr)_470px]">
      <div className="border bg-white">
        <RouteMap
          routes={mapRoutes}
          className="min-h-[520px]"
          label={
            showingRecommendation
              ? 'Prévia da recomendação'
              : `Plano escolhido: ${activePlan.name}`
          }
          totalStops={totalStops}
          currentStopLabel={`${activePlan.routeCount} ${activePlan.routeCount === 1 ? 'motorista' : 'motoristas'}`}
        />
        <div className="grid grid-cols-3 divide-x border-t py-4">
          <PlanMetric
            label="Motoristas"
            value={String(activePlan.routeCount)}
          />
          <PlanMetric label="Chegada prevista" value={activePlan.arrival} />
          <PlanMetric label="Custo total" value={activePlan.cost} />
        </div>
      </div>
      <section className="border bg-white p-4">
        <div className="px-1 pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
            Sugestão calculada
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            Quem deve buscar este pedido?
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Compare o horário de chegada e o custo. Nenhuma opção foi escolhida
            por você ainda.
          </p>
        </div>
        {hasRecentChange ? (
          <div className="mb-3 flex gap-3 border border-[#d8b84e] bg-[#fff8df] p-4">
            <Clock3
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-[#765d12]"
            />
            <div>
              <p className="text-sm font-semibold text-[#5f4a0e]">
                Prazo mais apertado após a substituição
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                A recomendação prioriza a chegada no horário. Uma opção mais
                barata também aparece abaixo, mas não cumpre o prazo atual.
              </p>
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          {plans.map((plan) => {
            const active = selected === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(plan.id)}
                className={cn(
                  'w-full cursor-pointer border p-4 text-left transition-colors hover:border-primary/40 hover:bg-subtle',
                  plan.recommended &&
                    !active &&
                    'border-primary/35 bg-primary-soft/25',
                  active && 'border-primary bg-primary-soft/50',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <div className="flex items-center gap-2">
                    {active ? (
                      <StatusPill tone="success">Escolhido</StatusPill>
                    ) : plan.recommended ? (
                      <StatusPill tone="success">Recomendado</StatusPill>
                    ) : null}
                    <StatusPill
                      tone={plan.meetsDeadline ? 'success' : 'warning'}
                    >
                      {plan.priority}
                    </StatusPill>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {hasRecentChange ? plan.urgentReason : plan.reason}
                </p>
                <dl className="mt-4 grid grid-cols-4 gap-2 border-t pt-3">
                  <SmallMetric
                    label="Motoristas"
                    value={String(plan.routeCount)}
                  />
                  <SmallMetric label="Chegada" value={plan.arrival} />
                  <SmallMetric label="Prazo" value={plan.deadlineStatus} />
                  <SmallMetric label="Custo" value={plan.cost} />
                </dl>
                <p
                  className={cn(
                    'mt-3 border-l-2 pl-3 text-xs font-medium leading-5',
                    plan.meetsDeadline
                      ? 'border-success text-success'
                      : 'border-alert text-[#765d12]',
                  )}
                >
                  {plan.comparison}
                </p>
                {active ? (
                  <ul className="mt-3 space-y-1 border-t pt-3">
                    {plan.routes.map((route) => (
                      <li
                        key={route.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="font-medium">
                          {
                            drivers.find(
                              (driver) => driver.id === route.suggestedDriverId,
                            )?.name
                          }
                        </span>
                        <span className="text-muted-foreground">
                          {route.stops} paradas · {route.duration}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function mapRoutesForPlan(plan: DeliveryPlan, demand: DemandRecord) {
  return plan.routes.map((planRoute, index) => {
    const baseRoute =
      logisticsRoutes.find((route) => route.id === planRoute.mapRouteId) ??
      logisticsRoutes[index % logisticsRoutes.length];
    const assignedDriver = drivers.find(
      (driver) => driver.id === planRoute.suggestedDriverId,
    );
    const mapPath =
      plan.routeCount === 1
        ? combineDriverCollectionPaths(baseRoute, planRoute.stops)
        : baseRoute.mapPath.slice(
            0,
            Math.min(baseRoute.mapPath.length, planRoute.stops),
          );
    const estimatedArrivalAt = toRouteTimestamp(demand.date, plan.arrival);
    const deadlineAt = toRouteTimestamp(demand.date, demand.deadline);
    const demandItems = demand.products
      .map((product) => `${product.name} ${product.quantity}`)
      .join(', ');
    const stops = mapPath.map((position, stopIndex) => {
      const last = stopIndex === mapPath.length - 1;
      const first = stopIndex === 0;
      const knownStop = findKnownStop(position);
      const pickupStop = knownStop?.kind === 'pickup' ? knownStop : undefined;
      return {
        name: last
          ? demand.school
          : first
            ? knownStop?.name ?? assignedDriver?.base ?? 'Base da cooperativa'
            : pickupStop?.name ?? `Local de coleta ${stopIndex}`,
        address: last
          ? 'Endereço cadastrado da escola'
          : knownStop?.address ?? 'Local cadastrado na rota',
        items: last
          ? demandItems
          : knownStop?.items ?? 'Produtos programados para coleta',
        kind: last
          ? ('delivery' as const)
          : first
            ? ('origin' as const)
            : ('pickup' as const),
        placeType: last
          ? ('school' as const)
          : first
            ? knownStop?.placeType ?? ('base' as const)
            : pickupStop?.placeType ?? ('farm' as const),
        position,
        ...(last
          ? { estimatedArrivalAt, deadlineAt }
          : knownStop
            ? {
                estimatedArrivalAt: knownStop.estimatedArrivalAt,
                deadlineAt: knownStop.deadlineAt,
              }
            : {}),
      };
    });

    return {
      ...baseRoute,
      id: `proposta-${plan.id}-${planRoute.id}`,
      name: `Coleta de ${assignedDriver?.name ?? 'motorista a definir'}`,
      region: planRoute.region,
      currentLocation: assignedDriver?.base ?? 'Base da cooperativa',
      destination: demand.school,
      driver: assignedDriver?.name ?? 'Motorista a definir',
      phone: assignedDriver?.phone ?? '',
      status: 'Planejada' as const,
      distance: planRoute.distance,
      eta: plan.arrival,
      completedStops: 0,
      totalStops: planRoute.stops,
      collected: [],
      stops,
      mapPosition: mapPath[0],
      mapPath,
      nextStop: 'Aguardando aprovação do gestor',
      lastUpdate: 'Proposta de rota',
      detailHref: `/demandas/${demand.id}`,
    };
  });
}

function findKnownStop(position: { lat: number; lng: number }) {
  return logisticsRoutes
    .flatMap((route) => route.stops ?? [])
    .find(
      (stop) =>
        Math.abs(stop.position.lat - position.lat) < 0.000001 &&
        Math.abs(stop.position.lng - position.lng) < 0.000001,
    );
}

function toRouteTimestamp(date: string, time: string) {
  const normalizedTime = time.replace('h', ':');
  return `${date}T${normalizedTime.padEnd(5, '0')}:00-03:00`;
}

function combineDriverCollectionPaths(
  primaryRoute: (typeof logisticsRoutes)[number],
  totalPoints: number,
) {
  const sharedCollectionRouteIds = ['rota-norte', 'rota-leste'];
  const secondaryRoute = logisticsRoutes.find(
    (route) =>
      sharedCollectionRouteIds.includes(route.id) &&
      route.id !== primaryRoute.id,
  );
  if (!secondaryRoute) return primaryRoute.mapPath;

  const primaryPointCount = Math.ceil(totalPoints / 2);
  const secondaryPointCount = Math.max(2, totalPoints - primaryPointCount);
  return [
    ...sampleMapPath(primaryRoute.mapPath, primaryPointCount),
    ...sampleMapPath(secondaryRoute.mapPath, secondaryPointCount),
  ];
}

function sampleMapPath<T>(points: T[], count: number) {
  if (points.length <= count) return points;
  if (count <= 1) return points.slice(0, 1);

  return Array.from({ length: count }, (_, index) => {
    const pointIndex = Math.round((index * (points.length - 1)) / (count - 1));
    return points[pointIndex];
  });
}

function coverageForDemand(demand: DemandRecord) {
  if (demand.id === 'joao-paulo') return logisticalCoverage;

  const sourceNames = [
    'Estoque da cooperativa',
    'Sítio Boa Colheita',
    'Chácara Vale Verde',
  ];
  const driverNames = ['Carlos Mendes', 'Ana Ferreira', 'Marcos Silva'];
  const fitLabels = [
    'Perto da posição atual de Carlos',
    'Perto da posição atual de Ana',
    'Desvio curto para Marcos',
  ];

  return demand.products.map((product, index) => ({
    product: product.name,
    requested: product.quantity,
    status: index === 0 ? 'Disponível no estoque' : 'Coleta possível',
    tone: 'success' as const,
    sources: [
      {
        source: sourceNames[index % sourceNames.length],
        quantity: product.quantity,
        driver: driverNames[index % driverNames.length],
        fit: fitLabels[index % fitLabels.length],
      },
    ],
    excluded: undefined,
  }));
}

function ReviewStep({
  demand,
  plan,
  assignments,
  onAssign,
  vehicleAssignments,
  onAssignVehicle,
  adjustmentsApproved,
  adjustmentCount,
}: {
  demand: DemandRecord;
  plan: DeliveryPlan;
  assignments: Record<string, string>;
  onAssign: (routeId: string, driverId: string) => void;
  vehicleAssignments: Record<string, string>;
  onAssignVehicle: (routeId: string, vehicleId: string) => void;
  adjustmentsApproved: boolean;
  adjustmentCount: number;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_370px]">
      <section className="space-y-4">
        <header className="border bg-white p-5">
          <h2 className="text-lg font-semibold">
            O que cada motorista vai buscar
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Cada quantidade fica sob responsabilidade de apenas um motorista.
            Todos trabalham para atender à mesma demanda da escola.
          </p>
        </header>
        {plan.routes.map((route, routeIndex) => {
          const selectedDriverId =
            assignments[route.id] ?? route.suggestedDriverId;
          const selectedDriver = drivers.find(
            (driver) => driver.id === selectedDriverId,
          );
          const selectedVehicleId = vehicleAssignments[route.id] ?? fleetVehicles[0].id;
          const selectedVehicle = fleetVehicles.find((vehicle) => vehicle.id === selectedVehicleId);
          const routeItems =
            demand.id === 'joao-paulo'
              ? route.items
              : demand.products
                  .filter(
                    (_, productIndex) =>
                      productIndex % plan.routes.length === routeIndex,
                  )
                  .map((product) => `${product.name}: ${product.quantity}`);
          return (
            <article key={route.id} className="border bg-white">
              <header className="flex flex-wrap items-start gap-4 border-b p-5">
                <span className="grid size-11 shrink-0 place-items-center bg-primary-soft text-primary">
                  <Truck aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                    Sugestão do sistema
                  </p>
                  <h3 className="font-semibold">
                    {selectedDriver?.name ?? 'Motorista a definir'}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Parte {routeIndex + 1} de {plan.routeCount} · {route.region}
                  </p>
                </div>
                <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[520px]">
                  <div>
                  <Label htmlFor={`driver-${route.id}`}>
                    Motorista
                  </Label>
                  <select
                    id={`driver-${route.id}`}
                    value={selectedDriverId}
                    onChange={(event) => onAssign(route.id, event.target.value)}
                    className="mt-2 h-11 w-full border bg-white px-3 text-sm"
                  >
                    {route.eligibleDriverIds.map((driverId) => {
                      const driver = drivers.find(
                        (candidate) => candidate.id === driverId,
                      );
                      return driver ? (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ) : null;
                    })}
                  </select>
                  </div>
                  <div>
                    <Label htmlFor={`vehicle-${route.id}`}>Veículo</Label>
                    <select
                      id={`vehicle-${route.id}`}
                      value={selectedVehicleId}
                      onChange={(event) => onAssignVehicle(route.id, event.target.value)}
                      className="mt-2 h-11 w-full cursor-pointer border bg-white px-3 text-sm"
                    >
                      {fleetVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate} · {vehicle.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </header>
              {selectedVehicle && selectedDriver && selectedVehicle.driverId !== selectedDriver.id ? (
                <div className="border-b border-warning/30 bg-[#fff8df] px-5 py-3 text-sm leading-5">
                  Esta escolha troca o responsável atual do veículo. O vínculo anterior será encerrado e continuará no histórico da Frota.
                </div>
              ) : null}
              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <PackageCheck
                      aria-hidden="true"
                      className="size-4 text-primary"
                    />
                    Produtos para buscar
                  </h4>
                  <ul className="mt-3 divide-y border bg-subtle">
                    {routeItems.map((item) => (
                      <li key={item} className="px-3 py-3 text-sm">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                  <ReviewMetric
                    icon={Truck}
                    label="Veículo"
                    value={selectedVehicle ? `${selectedVehicle.plate} · ${selectedVehicle.capacity}` : 'A definir'}
                  />
                  <ReviewMetric
                    icon={MapPin}
                    label="Distância"
                    value={route.distance}
                  />
                  <ReviewMetric
                    icon={Clock3}
                    label="Tempo"
                    value={route.duration}
                  />
                  <ReviewMetric
                    icon={RouteIcon}
                    label="Paradas"
                    value={String(route.stops)}
                  />
                  <ReviewMetric
                    icon={Warehouse}
                    label="Custo"
                    value={route.cost}
                  />
                </dl>
              </div>
            </article>
          );
        })}
      </section>
      <aside className="h-fit space-y-5 xl:sticky xl:top-6">
        <section className="border bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
            Conferência final
          </p>
          <h2 className="mt-2 font-semibold">{plan.name}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Pair label="Motoristas" value={String(plan.routeCount)} />
            <Pair label="Pedido atendido" value={plan.coverage} />
            <Pair label="Chegada prevista" value={plan.arrival} />
            <Pair label="Prazo" value={plan.deadlineStatus} />
            <Pair label="Custo total" value={plan.cost} />
            <Pair
              label="Mudanças do cardápio"
              value={
                adjustmentCount === 0
                  ? 'Nenhuma'
                  : adjustmentsApproved
                    ? `${adjustmentCount} aprovadas`
                    : 'Falta aprovar'
              }
            />
          </dl>
          {plan.routeCount > 1 ? (
            <details className="mt-4 border-t pt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Por que usar dois motoristas?
              </summary>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Carlos e Ana estão próximos de grupos diferentes de produtores.
                Trabalhando ao mesmo tempo, eles concluem as coletas dentro do
                prazo mesmo após a substituição do cardápio.
              </p>
            </details>
          ) : null}
        </section>
        {!plan.meetsDeadline ? (
          <div className="flex gap-3 border border-alert/25 bg-alert-soft/65 p-4">
            <AlertTriangle
              aria-hidden="true"
              className="size-5 shrink-0 text-alert"
            />
            <p className="text-sm leading-5">
              Esta opção busca todos os produtos, mas chega depois do prazo e
              não pode ser aprovada sem um novo horário combinado com a escola.
            </p>
          </div>
        ) : (
          <div className="flex gap-3 border border-success/25 bg-success-soft/65 p-4">
            <CheckCircle2
              aria-hidden="true"
              className="size-5 shrink-0 text-success"
            />
            <p className="text-sm leading-5">
              Todos os produtos serão buscados e a chegada está prevista para{' '}
              {plan.arrival}, dentro do horário.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function ApprovalSuccess({
  demand,
  plan,
  assignments,
  vehicleAssignments,
}: {
  demand: DemandRecord;
  plan: DeliveryPlan;
  assignments: Record<string, string>;
  vehicleAssignments: Record<string, string>;
}) {
  const assignedNames = plan.routes
    .map(
      (route) =>
        drivers.find(
          (driver) =>
            driver.id === (assignments[route.id] ?? route.suggestedDriverId),
        )?.name,
    )
    .filter(Boolean)
    .join(' e ');
  const totalStops = plan.routes.reduce(
    (total, route) => total + route.stops,
    0,
  );
  const assignedVehicles = plan.routes
    .map((route) => fleetVehicles.find((vehicle) => vehicle.id === vehicleAssignments[route.id])?.plate)
    .filter(Boolean)
    .join(' e ');
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
      <section className="w-full border bg-white p-7 text-center shadow-[0_24px_70px_rgba(14,28,18,.12)] sm:p-10">
        <span className="mx-auto grid size-16 place-items-center bg-primary text-white">
          <CheckCircle2 aria-hidden="true" className="size-8" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Plano aprovado
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          {plan.routeCount === 1
            ? 'Um motorista confirmado'
            : `${plan.routeCount} motoristas confirmados`}{' '}
          para {demand.school}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          {assignedNames} usarão {assignedVehicles}. Eles buscarão partes diferentes do mesmo pedido. A chegada
          está prevista para {plan.arrival}, dentro do prazo.
        </p>
        <dl className="mx-auto mt-6 grid max-w-lg grid-cols-3 divide-x border-y py-4">
          <SmallMetric label="Motoristas" value={String(plan.routeCount)} />
          <SmallMetric label="Paradas" value={String(totalStops)} />
          <SmallMetric label="Custo total" value={plan.cost} />
        </dl>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/gestor"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-11 rounded-none bg-[#245f0a] px-5',
            )}
          >
            Ver rotas no mapa
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link
            href="/demandas"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'lg' }),
              'h-11 rounded-none px-5',
            )}
          >
            Voltar às demandas
          </Link>
        </div>
      </section>
    </div>
  );
}

function AdjustmentNotice({
  title,
  description,
  checked,
  checkedLabel,
  actionLabel,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  checkedLabel: string;
  actionLabel: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <section
      className={`border p-4 ${checked ? 'border-success/30 bg-success-soft/60' : 'border-[#ecdcae] bg-[#fff8df]'}`}
    >
      <div className="flex items-start gap-3">
        {checked ? (
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-success"
          />
        ) : (
          <RefreshCw
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-[#765d12]"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant={checked ? 'ghost' : 'outline'}
        className={`mt-4 h-11 w-full rounded-none ${checked ? 'text-success' : 'border-[#d8c47e] bg-white'}`}
        onClick={() => onChange(!checked)}
      >
        {checked ? <Check aria-hidden="true" /> : null}
        {checked ? checkedLabel : actionLabel}
      </Button>
    </section>
  );
}

function evaluateDeliveryPlans(demand: DemandRecord) {
  const deadlineMinutes = timeToMinutes(demand.deadline);
  const evaluated = deliveryPlans.map((plan) => {
    const minutesToDeadline = deadlineMinutes - timeToMinutes(plan.arrival);
    return {
      ...plan,
      recommended: false,
      meetsDeadline: minutesToDeadline >= 0,
      deadlineStatus:
        minutesToDeadline >= 0
          ? `Chega ${formatMinuteDistance(minutesToDeadline)} antes do prazo`
          : `Chega ${formatMinuteDistance(Math.abs(minutesToDeadline))} depois do prazo`,
    };
  });
  const viable = evaluated.filter(
    (plan) => plan.coverage === '100%' && plan.meetsDeadline,
  );
  const candidates = viable.length ? viable : evaluated;
  const recommended = [...candidates].sort((first, second) => {
    if (demand.menuChangeCount || !viable.length) {
      return timeToMinutes(first.arrival) - timeToMinutes(second.arrival);
    }
    return currencyToNumber(first.cost) - currencyToNumber(second.cost);
  })[0];

  return evaluated.map((plan) => ({
    ...plan,
    recommended: plan.id === recommended.id,
  }));
}

function timeToMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split('h').map(Number);
  return hours * 60 + minutes;
}

function currencyToNumber(value: string) {
  return Number(value.replace(/[^\d,]/g, '').replace(',', '.'));
}

function formatMinuteDistance(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xs font-medium leading-4 tabular-nums">
        {value}
      </dd>
    </div>
  );
}
function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
function ReviewMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="border bg-subtle p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
