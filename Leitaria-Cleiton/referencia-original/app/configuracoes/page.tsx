'use client';

import { Calculator, Save } from 'lucide-react';
import { useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  return (
    <ManagerShell>
      <Frame saved={saved} setSaved={setSaved} />
    </ManagerShell>
  );
}

function Frame({
  saved,
  setSaved,
}: {
  saved: boolean;
  setSaved: (saved: boolean) => void;
}) {
  return (
    <PageFrame
      eyebrow="Administração"
      title="Configurações operacionais"
      description="Ajuste os valores gerais usados pelo sistema para comparar propostas de rota."
    >
      <form
        className="max-w-4xl border bg-white"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
        onChange={() => setSaved(false)}
      >
        <header className="flex items-start gap-3 border-b p-5 sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center bg-[#edf6e8] text-[#35691c]">
            <Calculator aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Parâmetros de custo</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Valores usados para comparar custo e tempo nas sugestões de
              planejamento.
            </p>
          </div>
        </header>

        {saved ? (
          <output className="block border-b border-success/25 bg-success-soft px-5 py-3 text-sm font-medium text-success">
            Parâmetros salvos.
          </output>
        ) : null}

        <div className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
          <CostField id="fixed" label="Custo fixo por viagem" value="35,00" />
          <CostField id="km" label="Custo por quilômetro" value="2,85" />
          <CostField id="hour" label="Custo por hora" value="24,00" />
        </div>

        <div className="mx-5 mb-6 border bg-subtle p-4 sm:mx-6">
          <p className="text-xs font-medium text-muted-foreground">
            Exemplo com os valores atuais
          </p>
          <p className="mt-2 text-sm font-medium leading-6">
            R$ 35,00 + 38,2 km × R$ 2,85 + 2h42 × R$ 24,00 = R$ 212,40
          </p>
        </div>

        <footer className="flex justify-end border-t bg-subtle px-5 py-4 sm:px-6">
          <Button
            type="submit"
            size="lg"
            className="h-11 cursor-pointer rounded-none bg-[#245f0a] px-5"
          >
            <Save aria-hidden="true" /> Salvar parâmetros
          </Button>
        </footer>
      </form>
    </PageFrame>
  );
}

function CostField({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <Label htmlFor={id} className="flex min-h-10 items-end leading-5">
        {label}
      </Label>
      <div className="mt-2 flex">
        <span className="grid h-11 place-items-center border border-r-0 bg-subtle px-3 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          defaultValue={value}
          inputMode="decimal"
          className="h-11 rounded-none"
        />
      </div>
    </div>
  );
}
