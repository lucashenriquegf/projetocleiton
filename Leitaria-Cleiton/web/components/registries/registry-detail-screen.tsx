'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Power,
  RotateCcw,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { StatusPill } from '@/components/system/status-pill';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  findRegistryItem,
  registryCategoryMeta,
  type RegistryCategory,
} from '@/lib/mocks/registries';
import { cn } from '@/lib/utils';

export function RegistryDetailScreen({
  category,
  id,
}: {
  category: RegistryCategory;
  id: string;
}) {
  const initialItem = findRegistryItem(category, id);
  const meta = registryCategoryMeta[category];
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [active, setActive] = useState(initialItem?.active ?? false);
  const [name, setName] = useState(initialItem?.name ?? '');
  const [fields, setFields] = useState(initialItem?.fields ?? {});

  if (!initialItem) {
    return (
      <ManagerShell>
        <PageFrame
          eyebrow="Cadastros"
          title="Cadastro não encontrado"
          description="Este registro não existe ou não está mais disponível."
          backHref={`/cadastros/${category}`}
        >
          <div className="border bg-white p-6">
            <Link
              href={`/cadastros/${category}`}
              className={cn(
                buttonVariants({ size: 'lg' }),
                'h-11 rounded-none bg-[#245f0a] px-5',
              )}
            >
              Voltar para {meta.label.toLowerCase()}
            </Link>
          </div>
        </PageFrame>
      </ManagerShell>
    );
  }

  const isRoad = category === 'vias-bloqueadas';
  const currentStatus = !active
    ? isRoad
      ? 'Liberada'
      : 'Inativo'
    : initialItem.status;
  const currentTone = !active
    ? isRoad
      ? 'success'
      : 'neutral'
    : initialItem.statusTone;

  function handleSave(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditing(false);
    setSaved(true);
  }

  function toggleStatus() {
    setActive((current) => !current);
    setConfirmingStatus(false);
    setSaved(false);
  }

  return (
    <ManagerShell>
      <PageFrame
        eyebrow={meta.label}
        title={name}
        description={initialItem.summary}
        backHref={`/cadastros/${category}`}
        action={<StatusPill tone={currentTone}>{currentStatus}</StatusPill>}
      >
        {saved ? (
          <output className="mb-4 flex items-start gap-3 border border-success/25 bg-success-soft px-5 py-4 text-sm">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-success"
            />
            <div>
              <p className="font-semibold text-success">Alterações salvas</p>
              <p className="mt-0.5 text-muted-foreground">
                O cadastro foi atualizado nesta versão de demonstração.
              </p>
            </div>
          </output>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <form className="border bg-white" onSubmit={handleSave}>
            <header className="flex min-h-16 items-center justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">
                  {editing ? 'Editar cadastro' : 'Informações do cadastro'}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {editing
                    ? 'Revise os campos e salve quando terminar.'
                    : 'Dados usados no planejamento da operação.'}
                </p>
              </div>
              {!editing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setEditing(true);
                    setSaved(false);
                  }}
                  className="h-11 cursor-pointer rounded-none px-4"
                >
                  <Pencil aria-hidden="true" /> Editar cadastro
                </Button>
              ) : null}
            </header>

            <div className="grid gap-x-5 gap-y-6 p-5 sm:grid-cols-2 sm:p-6">
              <DetailField
                label="Nome"
                value={name}
                editing={editing}
                onChange={setName}
                className="sm:col-span-2"
              />
              {Object.entries(fields).map(([label, value]) => (
                <DetailField
                  key={label}
                  label={label}
                  value={value}
                  editing={editing}
                  onChange={(nextValue) =>
                    setFields((current) => ({
                      ...current,
                      [label]: nextValue,
                    }))
                  }
                  className={label === 'Endereço' ? 'sm:col-span-2' : undefined}
                />
              ))}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Última atualização
                </p>
                <p className="mt-2 min-h-11 py-2.5 text-sm">
                  {formatDate(initialItem.updatedAt)}
                </p>
              </div>
            </div>

            {editing ? (
              <footer className="flex flex-col-reverse gap-2 border-t bg-subtle px-5 py-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setName(initialItem.name);
                    setFields(initialItem.fields);
                    setEditing(false);
                  }}
                  className="h-11 cursor-pointer rounded-none px-5"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="h-11 cursor-pointer rounded-none bg-[#245f0a] px-5"
                >
                  <Save aria-hidden="true" /> Salvar alterações
                </Button>
              </footer>
            ) : null}
          </form>

          <aside className="h-fit border bg-white p-5">
            <h2 className="font-semibold">Situação do cadastro</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {getStatusExplanation(category, active)}
            </p>
            <div className="mt-4">
              <StatusPill tone={currentTone}>{currentStatus}</StatusPill>
            </div>

            {confirmingStatus ? (
              <div className="mt-5 border border-warning/30 bg-[#fff8df] p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-[#765d12]"
                  />
                  <p className="text-sm font-semibold">
                    {getConfirmationQuestion(category, active)}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  O registro será preservado no histórico e poderá ser
                  reativado.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setConfirmingStatus(false)}
                    className="h-11 cursor-pointer rounded-none bg-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant={active ? 'destructive' : 'default'}
                    size="lg"
                    onClick={toggleStatus}
                    className={cn(
                      'h-11 cursor-pointer rounded-none',
                      !active && 'bg-[#245f0a]',
                    )}
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setConfirmingStatus(true)}
                className="mt-5 h-11 w-full cursor-pointer rounded-none"
              >
                {active ? (
                  <Power aria-hidden="true" />
                ) : (
                  <RotateCcw aria-hidden="true" />
                )}
                {getStatusAction(category, active)}
              </Button>
            )}
          </aside>
        </div>
      </PageFrame>
    </ManagerShell>
  );
}

function DetailField({
  label,
  value,
  editing,
  onChange,
  className,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = `field-${label.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className={className}>
      <Label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      {editing ? (
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-11 rounded-none"
        />
      ) : (
        <p className="mt-2 min-h-11 border-b py-2.5 text-sm font-medium">
          {value || 'Não informado'}
        </p>
      )}
    </div>
  );
}

function getStatusExplanation(category: RegistryCategory, active: boolean) {
  if (category === 'vias-bloqueadas') {
    return active
      ? 'O sistema evita este trecho ao propor novas rotas.'
      : 'Este trecho pode voltar a ser usado nas novas propostas de rota.';
  }
  return active
    ? 'Este registro aparece normalmente nas novas operações.'
    : 'Este registro não aparece em novos planejamentos, mas continua no histórico.';
}

function getStatusAction(category: RegistryCategory, active: boolean) {
  if (category === 'vias-bloqueadas') {
    return active ? 'Liberar esta via' : 'Ativar bloqueio';
  }
  return active ? 'Inativar cadastro' : 'Reativar cadastro';
}

function getConfirmationQuestion(category: RegistryCategory, active: boolean) {
  if (category === 'vias-bloqueadas') {
    return active
      ? 'Liberar esta via para novas rotas?'
      : 'Voltar a bloquear esta via?';
  }
  return active ? 'Inativar este cadastro?' : 'Reativar este cadastro?';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`));
}
