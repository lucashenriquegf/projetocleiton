import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  MapPin,
  Replace,
} from 'lucide-react';
import Link from 'next/link';

import { PersonaShell } from '@/components/layout/persona-shell';
import { StatusPill } from '@/components/system/status-pill';
import { schoolMenus } from '@/lib/mocks/menus';

const nutritionistSchools = schoolMenus.slice(0, 3).map((menu, index) => ({
  ...menu,
  href:
    index === 0
      ? '/nutricionista/cardapios/setembro'
      : index === 1
        ? '/nutricionista/cardapios/maria-terra'
        : '/nutricionista/cardapios/sementes-cerrado',
}));

export default function NutritionistPage() {
  return (
    <PersonaShell persona="nutritionist" contentClassName="max-w-5xl">
      <header className="border-b pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Olá, Helena
        </p>
        <h1 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em]">
          Cardápios das escolas
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha uma escola para consultar ou editar o planejamento mensal.
        </p>
      </header>

      <section className="mt-5 border bg-white">
        <header className="flex items-center gap-3 border-b p-5">
          <span className="grid size-10 place-items-center bg-primary-soft text-primary">
            <ClipboardCheck aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Meus cardápios</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {nutritionistSchools.length} escolas disponíveis
            </p>
          </div>
        </header>

        <ul className="divide-y">
          {nutritionistSchools.map((menu) => (
            <li key={menu.id}>
              <Link
                href={menu.href}
                className="group grid gap-4 p-5 hover:bg-subtle lg:grid-cols-[minmax(0,1.2fr)_150px_170px_120px_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold">{menu.school}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                    {menu.city} · {menu.month}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Atualizado {menu.updated.toLowerCase()}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays aria-hidden="true" className="size-3.5" />
                    Dias preenchidos
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {menu.filledDays} de {menu.totalDays}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Replace aria-hidden="true" className="size-3.5" />
                    Alternativas
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {menu.substitutionCount} cadastradas
                  </p>
                  {menu.pendingChanges ? (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#765d12]">
                      <AlertTriangle aria-hidden="true" className="size-3.5" />
                      {menu.pendingChanges} aguardando
                    </p>
                  ) : null}
                </div>
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
                <ArrowRight
                  aria-hidden="true"
                  className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PersonaShell>
  );
}
