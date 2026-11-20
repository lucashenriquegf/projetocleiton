'use client';

import { CarFront, Link2, MapPinned, PackageCheck, Plus, RouteOff, Truck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { buttonVariants } from '@/components/ui/button';
import {
  registryCategoryMeta,
  registryItems,
  type RegistryCategory,
} from '@/lib/mocks/registries';
import { cn } from '@/lib/utils';

const categories: Array<{
  key: RegistryCategory | 'veiculos' | 'frota';
  icon: typeof PackageCheck;
  helper: string;
  iconTone: string;
  label?: string;
  href?: string;
  newHref?: string;
  newLabel?: string;
}> = [
  {
    key: 'produtos',
    icon: PackageCheck,
    helper: 'Usados nos cardápios e nas demandas',
    iconTone: 'bg-[#edf6e8] text-[#35691c]',
  },
  {
    key: 'locais',
    icon: MapPinned,
    helper: 'Produtores, escolas, estoques e bases',
    iconTone: 'bg-[#edf5ff] text-[#245ca8]',
  },
  {
    key: 'caminhoneiros',
    icon: Truck,
    helper: 'Contatos e disponibilidade operacional',
    iconTone: 'bg-[#fff4e5] text-[#a85c08]',
  },
  {
    key: 'veiculos',
    icon: CarFront,
    label: 'Veículos',
    helper: 'Capacidade, tração, situação e base',
    iconTone: 'bg-[#eef1f8] text-[#43547f]',
    href: '/cadastros/veiculos',
    newHref: '/cadastros/veiculos/novo',
    newLabel: 'Novo veículo',
  },
  {
    key: 'frota',
    icon: Link2,
    label: 'Frota',
    helper: 'Vínculos atuais entre motoristas e veículos',
    iconTone: 'bg-[#f0f0f0] text-[#444c47]',
    href: '/cadastros/frota',
    newHref: '/cadastros/frota/novo',
    newLabel: 'Novo vínculo',
  },
  {
    key: 'vias-bloqueadas',
    icon: RouteOff,
    helper: 'Bloqueios e condições de passagem',
    iconTone: 'bg-[#fff0ef] text-[#ad3833]',
  },
];

export function RegistryHub() {
  const [fleetCounts, setFleetCounts] = useState({ products: 0, activeProducts: 0, vehicles: 0, activeVehicles: 0, assignments: 0, drivers: 0, activeDrivers: 0, roads: 0, activeRoads: 0 });

  useEffect(() => {
    void Promise.all([
      fetch('/api/products?porPagina=10').then((response) => response.ok ? response.json() as Promise<{ total: number }> : null),
      fetch('/api/products?situacao=ACTIVE&porPagina=10').then((response) => response.ok ? response.json() as Promise<{ total: number }> : null),
      fetch('/api/vehicles?porPagina=10').then((response) => response.ok ? response.json() as Promise<{ total: number; activeTotal: number }> : null),
      fetch('/api/fleet?porPagina=10').then((response) => response.ok ? response.json() as Promise<{ total: number }> : null),
      fetch('/api/drivers').then((response) => response.ok ? response.json() as Promise<{ items: Array<{ active: boolean }> }> : null),
      fetch('/api/roads').then((response) => response.ok ? response.json() as Promise<{ items: Array<{ active: boolean }> }> : null),
    ]).then(([productResult, activeProductResult, vehicleResult, fleetResult, driverResult, roadResult]) => {
      setFleetCounts({
        products: Number(productResult?.total ?? 0),
        activeProducts: Number(activeProductResult?.total ?? 0),
        vehicles: Number(vehicleResult?.total ?? 0),
        activeVehicles: Number(vehicleResult?.activeTotal ?? 0),
        assignments: Number(fleetResult?.total ?? 0),
        drivers: driverResult?.items.length ?? 0,
        activeDrivers: driverResult?.items.filter((item) => item.active).length ?? 0,
        roads: roadResult?.items.length ?? 0,
        activeRoads: roadResult?.items.filter((item) => item.active).length ?? 0,
      });
    }).catch(() => undefined);
  }, []);

  return (
    <ManagerShell>
      <PageFrame
        title="Cadastros da operação"
        description="Gerencie produtos, locais, motoristas, veículos, vínculos da frota e restrições das vias."
      >
        <section
          aria-label="Categorias de cadastro"
          className="border border-[#dce4df] bg-white"
        >
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1fr)_10rem_12.5rem] items-center gap-6 border-b border-[#dce4df] bg-[#f6f8f6] px-6 py-3 text-sm font-semibold text-[#5d6a62] lg:grid"
          >
            <span>Categoria</span>
            <span>Registros</span>
            <span>Ações</span>
          </div>

          <div className="divide-y divide-[#e2e8e4]">
            {categories.map(({ key, icon: Icon, helper, iconTone }) => {
              const isRegistry = key in registryCategoryMeta;
              const meta = isRegistry ? registryCategoryMeta[key as RegistryCategory] : null;
              const category = categories.find((item) => item.key === key)!;
              const count = key === 'produtos' ? fleetCounts.products : key === 'veiculos' ? fleetCounts.vehicles : key === 'frota' ? fleetCounts.assignments : key === 'caminhoneiros' ? fleetCounts.drivers : key === 'vias-bloqueadas' ? fleetCounts.roads : registryItems[key as RegistryCategory].length;
              const activeCount = key === 'produtos' ? fleetCounts.activeProducts : key === 'veiculos' ? fleetCounts.activeVehicles : key === 'frota' ? fleetCounts.assignments : key === 'caminhoneiros' ? fleetCounts.activeDrivers : key === 'vias-bloqueadas' ? fleetCounts.activeRoads : registryItems[key as RegistryCategory].filter((item) => item.active).length;
              const label = category.label ?? meta?.label ?? '';
              const href = category.href ?? `/cadastros/${key}`;
              const newHref = category.newHref ?? meta?.newHref;

              return (
                <article
                  key={key}
                  className="grid gap-4 p-5 transition-colors hover:bg-[#fafcfa] sm:p-6 lg:grid-cols-[minmax(0,1fr)_10rem_12.5rem] lg:items-center lg:gap-6"
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-md',
                        iconTone,
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#17241f]">
                        {label}
                      </h2>
                      <p className="mt-1 text-[0.9375rem] leading-6 text-muted-foreground">
                        {helper}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-5 pl-[3.75rem] lg:gap-3 lg:pl-0">
                    <div>
                      <dd className="text-lg font-semibold leading-tight tabular-nums text-[#17241f]">
                        {count}
                      </dd>
                      <dt className="mt-0.5 text-sm leading-5 text-[#5d6a62]">
                        Total
                      </dt>
                    </div>
                    <div>
                      <dd className="text-lg font-semibold leading-tight tabular-nums text-[#17241f]">
                        {activeCount}
                      </dd>
                      <dt className="mt-0.5 text-sm leading-5 text-[#5d6a62]">
                        {key === 'vias-bloqueadas' ? 'Bloqueios' : key === 'frota' ? 'Atuais' : 'Ativos'}
                      </dt>
                    </div>
                  </dl>

                  <div className="flex items-center gap-2 pl-[3.75rem] lg:pl-0">
                    <Link
                      href={href}
                      className={cn(
                        buttonVariants({ size: 'lg' }),
                        'h-11 min-w-0 flex-1 rounded-none bg-[#245f0a] px-3 text-sm text-white shadow-none hover:bg-[#1c4e07]',
                      )}
                    >
                      Ver lista
                    </Link>
                    {newHref ? <Link
                      href={newHref}
                      aria-label={category.newLabel ?? meta?.newLabel}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'lg' }),
                        'h-11 shrink-0 rounded-none px-3.5 text-sm',
                      )}
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      Novo
                    </Link> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </PageFrame>
    </ManagerShell>
  );
}
