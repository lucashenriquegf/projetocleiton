'use client';

import {
  ArrowDown,
  Check,
  Clock3,
  RotateCcw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import type {
  AppliedSubstitution,
  MenuDay,
  MenuItem,
  MenuSubstitution,
} from '@/lib/mocks/menus';
import { cn } from '@/lib/utils';

export type SubstitutionAction = {
  item: MenuItem;
  substitution: MenuSubstitution;
  record?: AppliedSubstitution;
};

export function MenuCompositionTable({
  day,
  actor,
  onApply,
  onRequest,
  onConfirm,
  onUndo,
}: {
  day: MenuDay;
  actor: 'manager' | 'nutritionist';
  onApply: (action: SubstitutionAction) => void;
  onRequest: (action: SubstitutionAction) => void;
  onConfirm: (action: SubstitutionAction) => void;
  onUndo: (action: SubstitutionAction) => void;
}) {
  return (
    <section aria-label={`Cardápio de ${day.date}`} className="border bg-white">
      <div className="hidden grid-cols-[130px_minmax(0,1fr)_140px_190px] gap-4 border-b bg-subtle px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid">
        <span>Situação</span>
        <span>Produto</span>
        <span>Quantidade</span>
        <span className="sr-only">Ação</span>
      </div>

      <ul className="divide-y">
        {day.items.map((item) => {
          const selectedRecord = day.appliedSubstitutions.find(
            (record) =>
              record.sourceItemId === item.id && record.status !== 'Desfeita',
          );
          const confirmed = selectedRecord?.status === 'Confirmada';

          return (
            <li key={item.id}>
              <MenuProductRow item={item} replaced={Boolean(confirmed)} />
              {item.substitutions.length ? (
                <ul aria-label={`Substituições para ${item.product}`}>
                  {item.substitutions.map((substitution) => {
                    const record = day.appliedSubstitutions.find(
                      (candidate) =>
                        candidate.sourceItemId === item.id &&
                        candidate.substitutionId === substitution.id &&
                        candidate.status !== 'Desfeita',
                    );
                    return (
                      <SubstitutionProductRow
                        key={substitution.id}
                        item={item}
                        substitution={substitution}
                        record={record}
                        anotherSelected={Boolean(
                          selectedRecord &&
                          selectedRecord.substitutionId !== substitution.id,
                        )}
                        actor={actor}
                        onApply={onApply}
                        onRequest={onRequest}
                        onConfirm={onConfirm}
                        onUndo={onUndo}
                      />
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MenuProductRow({
  item,
  replaced,
}: {
  item: MenuItem;
  replaced: boolean;
}) {
  return (
    <div
      className={cn(
        'grid gap-2 px-4 py-4 sm:grid-cols-[130px_minmax(0,1fr)_140px_190px] sm:items-center sm:gap-4',
        replaced ? 'bg-[#f4f5f3] text-muted-foreground' : 'bg-[#f0f7ec]',
      )}
    >
      <StateLabel tone={replaced ? 'neutral' : 'active'}>
        {replaced ? 'Substituído' : 'Ativo'}
      </StateLabel>
      <div>
        <span className="text-xs font-medium text-muted-foreground sm:hidden">
          Produto
        </span>
        <p className={cn('font-medium', !replaced && 'text-foreground')}>
          {item.product}
        </p>
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground sm:hidden">
          Quantidade
        </span>
        <p className="font-semibold tabular-nums text-foreground">
          {formatQuantity(item.quantity)} {item.unit}
        </p>
      </div>
      <span className="hidden sm:block" />
    </div>
  );
}

function SubstitutionProductRow({
  item,
  substitution,
  record,
  anotherSelected,
  actor,
  onApply,
  onRequest,
  onConfirm,
  onUndo,
}: {
  item: MenuItem;
  substitution: MenuSubstitution;
  record?: AppliedSubstitution;
  anotherSelected: boolean;
  actor: 'manager' | 'nutritionist';
  onApply: (action: SubstitutionAction) => void;
  onRequest: (action: SubstitutionAction) => void;
  onConfirm: (action: SubstitutionAction) => void;
  onUndo: (action: SubstitutionAction) => void;
}) {
  const active = record?.status === 'Confirmada';
  const pending = record?.status === 'Solicitada';
  const action = { item, substitution, record };

  return (
    <li
      className={cn(
        'relative grid gap-3 border-t px-4 py-4 pl-9 sm:grid-cols-[130px_minmax(0,1fr)_140px_190px] sm:items-center sm:gap-4 sm:pl-4',
        active
          ? 'border-[#bfd7b4] bg-[#f0f7ec]'
          : 'border-[#eadca9] bg-[#fff8df]',
        anotherSelected && 'opacity-55',
      )}
    >
      <ArrowDown
        aria-hidden="true"
        className="absolute left-4 top-5 size-4 text-[#765d12] sm:hidden"
      />
      <StateLabel tone={active ? 'active' : pending ? 'pending' : 'suggestion'}>
        {active ? 'Ativo' : pending ? 'Aguardando' : 'Alternativa'}
      </StateLabel>
      <div>
        <p className="flex items-center gap-2 font-medium text-foreground">
          <ArrowDown
            aria-hidden="true"
            className="hidden size-4 text-[#765d12] sm:block"
          />
          {substitution.product}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Usar somente se {item.product} não puder ser atendido
        </p>
        {record ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {record.reason} · {record.registeredAt}
          </p>
        ) : null}
      </div>
      <p className="font-semibold tabular-nums text-foreground">
        {formatQuantity(substitution.quantity)} {substitution.unit}
      </p>
      <div className="sm:justify-self-end">
        {active && actor === 'manager' ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-none sm:w-auto"
            onClick={() => onUndo(action)}
          >
            <RotateCcw aria-hidden="true" /> Desfazer
          </Button>
        ) : null}
        {pending && actor === 'manager' ? (
          <Button
            type="button"
            className="h-11 w-full rounded-none bg-[#765d12] hover:bg-[#604b0e] sm:w-auto"
            onClick={() => onConfirm(action)}
          >
            <Check aria-hidden="true" /> Confirmar solicitação
          </Button>
        ) : null}
        {pending && actor === 'nutritionist' ? (
          <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#765d12]">
            <Clock3 aria-hidden="true" className="size-4" /> Aguardando o gestor
          </span>
        ) : null}
        {!record && !anotherSelected && actor === 'manager' ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-none border-[#d8c47e] bg-white sm:w-auto"
            onClick={() => onApply(action)}
          >
            <ShieldCheck aria-hidden="true" /> Ativar alternativa
          </Button>
        ) : null}
        {!record && !anotherSelected && actor === 'nutritionist' ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-none border-[#d8c47e] bg-white sm:w-auto"
            onClick={() => onRequest(action)}
          >
            <Send aria-hidden="true" /> Solicitar uso
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function StateLabel({
  tone,
  children,
}: {
  tone: 'active' | 'suggestion' | 'pending' | 'neutral';
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 px-2.5 py-1 text-xs font-semibold',
        tone === 'active' && 'bg-[#245f0a] text-white',
        tone === 'suggestion' &&
          'border border-[#d8c47e] bg-white text-[#765d12]',
        tone === 'pending' && 'bg-[#765d12] text-white',
        tone === 'neutral' && 'border bg-white text-muted-foreground',
      )}
    >
      {tone === 'active' ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : null}
      {tone === 'suggestion' ? (
        <ShieldCheck aria-hidden="true" className="size-3.5" />
      ) : null}
      {tone === 'pending' ? (
        <Clock3 aria-hidden="true" className="size-3.5" />
      ) : null}
      {children}
    </span>
  );
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
    quantity,
  );
}
