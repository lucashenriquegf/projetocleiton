import {
  AlertTriangle,
  Clock3,
  Coins,
  MapPin,
  PackageCheck,
  Phone,
  Printer,
  Radio,
  Truck,
} from 'lucide-react';
import Link from 'next/link';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { RouteMap } from '@/components/routes/route-map';
import { RouteStopList } from '@/components/routes/route-stop-list';
import { StatusPill } from '@/components/system/status-pill';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { logisticsRoutes } from '@/lib/mocks/operations';

export default function RouteDetailPage() {
  return (
    <ManagerShell>
      <PageFrame
        wide
        backHref="/gestor?rota=rota-norte"
        eyebrow="Rota #RN-091"
        title="Rota Norte"
        description="2 escolas · última entrega na Escola Maria da Terra"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              title="Impressão será habilitada após a validação do mock"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'h-11 rounded-none',
              )}
            >
              <Printer aria-hidden="true" /> Imprimir roteiro
            </button>
            <Link
              href="/acompanhamento/rota-norte"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'h-11 rounded-none bg-[#245f0a]',
              )}
            >
              <Radio aria-hidden="true" /> Acompanhar
            </Link>
          </div>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <StatusPill tone="live">Em andamento</StatusPill>
          <span className="text-sm text-muted-foreground">
            57% do percurso concluído · 2 escolas restantes
          </span>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_400px]">
          <div className="space-y-5">
            <RouteMap
              routes={[logisticsRoutes[0]]}
              showCompletedPath
              className="min-h-[500px] border"
            />
            <section className="border bg-white p-5">
              <h2 className="font-semibold">Rastreabilidade</h2>
              <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                <Event
                  time="08h02"
                  title="Rota iniciada"
                  text="Carlos saiu da cooperativa"
                />
                <Event
                  time="09h06"
                  title="4ª coleta concluída"
                  text="30 dúzias de ovos coletadas"
                />
                <Event
                  time="Agora"
                  title="A caminho"
                  text="Fazenda Sol Nascente"
                />
              </ol>
            </section>
          </div>
          <aside className="space-y-5">
            <section className="border bg-white p-5">
              <div className="flex items-center justify-between gap-3 border-b pb-4">
                <div>
                  <h2 className="font-semibold">Roteiro</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Planejado e realizado
                  </p>
                </div>
                <Truck aria-hidden="true" className="size-5 text-primary" />
              </div>
              <div className="mt-2">
                <RouteStopList compact />
              </div>
            </section>
            <section className="border bg-white p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <PackageCheck
                  aria-hidden="true"
                  className="size-5 text-primary"
                />
                Coletado até agora
              </h2>
              <ul className="mt-4 divide-y border-y text-sm">
                <CollectedItem name="Alface" value="280 unidades" />
                <CollectedItem name="Batata" value="200 kg" />
                <CollectedItem name="Ovos" value="30 dúzias" />
                <CollectedItem name="Leite" value="120 litros" />
              </ul>
            </section>
            <section className="border bg-white p-5">
              <h2 className="font-semibold">Caminhoneiro e custos</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Pair icon={Truck} label="Caminhoneiro" value="Carlos Mendes" />
                <Pair icon={Phone} label="Telefone" value="(62) 99912-3040" />
                <Pair icon={MapPin} label="Posição" value="GO-070, acesso 14" />
                <Pair icon={Clock3} label="Duração estimada" value="2h58" />
                <Pair icon={Coins} label="Custo estimado" value="R$ 227,61" />
              </dl>
              <details className="mt-4 border-t pt-4">
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  Ver memória do custo
                </summary>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  R$ 35,00 fixos + 42,6 km × R$ 2,85 + 2h58 × R$ 24,00.
                </p>
              </details>
            </section>
            <div className="flex gap-3 border bg-white p-4 text-sm">
              <AlertTriangle
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
              <p>
                <strong className="font-medium">Rota recalculada:</strong> o
                trajeto exibido contém somente vias liberadas.
              </p>
            </div>
          </aside>
        </div>
      </PageFrame>
    </ManagerShell>
  );
}

function Pair({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Truck;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 text-primary" />
      <dt className="flex-1 text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
function Event({
  time,
  title,
  text,
}: {
  time: string;
  title: string;
  text: string;
}) {
  return (
    <li className="border-l-2 border-primary pl-3">
      <p className="text-xs font-medium text-primary">{time}</p>
      <p className="mt-1 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </li>
  );
}
function CollectedItem({ name, value }: { name: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="text-muted-foreground">{name}</span>
      <strong className="font-semibold tabular-nums">{value}</strong>
    </li>
  );
}
