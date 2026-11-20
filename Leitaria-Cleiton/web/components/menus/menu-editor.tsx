'use client';

import {
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  History,
  Pencil,
  Plus,
  Replace,
  Repeat2,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import {
  MenuCompositionTable,
  type SubstitutionAction,
} from '@/components/menus/menu-composition-table';
import {
  MenuMonthCalendar,
  dateFromIso,
} from '@/components/menus/menu-month-calendar';
import {
  MenuRecurrenceSheet,
  MenuReuseSheet,
} from '@/components/menus/menu-reuse-calendar-sheet';
import { ProductCombobox } from '@/components/menus/product-combobox';
import { StatusPill } from '@/components/system/status-pill';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  findMenuProduct,
  menuHistoryDays,
  septemberMenuDays,
  type AppliedSubstitution,
  type MenuDay,
  type MenuItem,
  type MenuSubstitution,
} from '@/lib/mocks/menus';

type Actor = 'manager' | 'nutritionist';
type DecisionKind = 'apply' | 'request' | 'confirm' | 'undo';

type Decision = {
  kind: DecisionKind;
  action: SubstitutionAction;
};

export function MenuEditor({
  actor,
  newMenu = false,
  schoolName = 'Escola Municipal João Paulo II',
}: {
  actor: Actor;
  newMenu?: boolean;
  schoolName?: string;
}) {
  const initialDays = useMemo(
    () => (newMenu ? [] : cloneDays(septemberMenuDays)),
    [newMenu],
  );
  const defaultIso = newMenu ? '2026-10-01' : chooseInitialIso(initialDays);
  const [days, setDays] = useState<MenuDay[]>(initialDays);
  const [selectedIso, setSelectedIso] = useState(defaultIso);
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<MenuItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [decisionOrigin, setDecisionOrigin] = useState<
    'Escola' | 'Problema na entrega'
  >('Problema na entrega');
  const [pendingIso, setPendingIso] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reuseOpen, setReuseOpen] = useState(false);
  const [recurrenceDay, setRecurrenceDay] = useState<MenuDay | null>(null);

  const selectedDay = days.find((day) => day.isoDate === selectedIso);
  const initialMonth = dateFromIso(defaultIso);
  const substitutionCount = days.reduce(
    (total, day) =>
      total +
      day.items.reduce(
        (subtotal, item) => subtotal + item.substitutions.length,
        0,
      ),
    0,
  );
  const pendingCount = days.reduce(
    (total, day) =>
      total +
      day.appliedSubstitutions.filter(
        (record) => record.status === 'Solicitada',
      ).length,
    0,
  );

  function requestDateChange(isoDate: string) {
    if (isoDate === selectedIso) return;
    if (editing && dirty) {
      setPendingIso(isoDate);
      setDiscardOpen(true);
      return;
    }
    switchDate(isoDate);
  }

  function switchDate(isoDate: string) {
    setSelectedIso(isoDate);
    setEditing(false);
    setDraftItems([]);
    setDirty(false);
    setFormError('');
    setPendingIso(null);
  }

  function beginEditing(day?: MenuDay) {
    setDraftItems(day ? cloneItems(day.items) : [createBlankItem()]);
    setEditing(true);
    setDirty(false);
    setFormError('');
    setFeedback('');
  }

  function cancelEditing() {
    if (dirty) {
      setPendingIso(selectedIso);
      setDiscardOpen(true);
      return;
    }
    setEditing(false);
    setDraftItems([]);
    setFormError('');
  }

  function saveDraft() {
    const error = validateItems(draftItems);
    if (error) {
      setFormError(error);
      return;
    }

    setDays((current) => {
      const existing = current.find((day) => day.isoDate === selectedIso);
      const validRecords = (existing?.appliedSubstitutions ?? []).filter(
        (record) => {
          const source = draftItems.find(
            (item) => item.id === record.sourceItemId,
          );
          return source?.substitutions.some(
            (substitution) => substitution.id === record.substitutionId,
          );
        },
      );
      const savedDay: MenuDay = {
        id: selectedIso,
        isoDate: selectedIso,
        date: formatDate(selectedIso),
        weekday: formatWeekday(selectedIso),
        items: cloneItems(draftItems),
        appliedSubstitutions: validRecords,
        status: 'Rascunho',
      };
      return [
        ...current.filter((day) => day.isoDate !== selectedIso),
        savedDay,
      ].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
    });

    setEditing(false);
    setDirty(false);
    setFormError('');
    setFeedback(`Cardápio de ${formatDate(selectedIso)} salvo como rascunho.`);
  }

  function addGeneratedDays(generatedDays: MenuDay[], message: string) {
    if (!generatedDays.length) return;
    const generatedDates = new Set(
      generatedDays.map((generatedDay) => generatedDay.isoDate),
    );
    setDays((current) =>
      [
        ...current.filter((day) => !generatedDates.has(day.isoDate)),
        ...generatedDays,
      ].sort((a, b) => a.isoDate.localeCompare(b.isoDate)),
    );
    switchDate(generatedDays[0].isoDate);
    setFeedback(message);
  }

  function requestProductRegistration(suggestedName: string) {
    setFeedback(
      `Pedido enviado ao gestor para cadastrar “${suggestedName}”. O produto poderá ser usado depois da aprovação.`,
    );
  }

  function publishMenu() {
    setDays((current) =>
      current.map((day) => ({
        ...day,
        status: day.appliedSubstitutions.some(
          (record) => record.status === 'Solicitada',
        )
          ? ('Em revisão' as const)
          : ('Aprovado' as const),
      })),
    );
    setFeedback(
      actor === 'nutritionist'
        ? 'Cardápio enviado ao gestor. As substituições continuam disponíveis por produto.'
        : 'Cardápio aprovado e disponível para o planejamento das entregas.',
    );
  }

  function openDecision(kind: DecisionKind, action: SubstitutionAction) {
    setDecision({ kind, action });
    setDecisionOrigin(
      kind === 'request' || action.record?.origin === 'Escola'
        ? 'Escola'
        : 'Problema na entrega',
    );
  }

  function confirmDecision() {
    if (!decision) return;
    const { kind, action } = decision;
    setDays((current) =>
      current.map((day) => {
        if (day.isoDate !== selectedIso) return day;
        const withoutCurrent = day.appliedSubstitutions.filter(
          (record) =>
            !(
              record.sourceItemId === action.item.id &&
              record.status !== 'Desfeita'
            ),
        );

        if (kind === 'undo') {
          return {
            ...day,
            status: 'Aprovado',
            appliedSubstitutions: day.appliedSubstitutions.map((record) =>
              record.id === action.record?.id
                ? { ...record, status: 'Desfeita' as const }
                : record,
            ),
          };
        }

        const record: AppliedSubstitution = {
          id: action.record?.id ?? createId('change'),
          sourceItemId: action.item.id,
          substitutionId: action.substitution.id,
          origin: kind === 'request' ? 'Escola' : decisionOrigin,
          status: kind === 'request' ? 'Solicitada' : 'Confirmada',
          reason:
            kind === 'request' || decisionOrigin === 'Escola'
              ? `A escola pediu a troca de ${action.item.product} por ${action.substitution.product}.`
              : `Houve um problema na entrega de ${action.item.product}.`,
          registeredAt: 'Agora',
        };
        return {
          ...day,
          status:
            kind === 'request'
              ? ('Em revisão' as const)
              : ('Aprovado' as const),
          appliedSubstitutions: [...withoutCurrent, record],
        };
      }),
    );

    const original = `${formatQuantity(decision.action.item.quantity)} ${decision.action.item.unit} de ${decision.action.item.product}`;
    const replacement = `${formatQuantity(decision.action.substitution.quantity)} ${decision.action.substitution.unit} de ${decision.action.substitution.product}`;
    setFeedback(
      kind === 'request'
        ? `Solicitação enviada: trocar ${original} por ${replacement}.`
        : kind === 'undo'
          ? `${decision.action.item.product} voltou a ficar ativo neste dia.`
          : `Substituição confirmada: ${original} por ${replacement}. Os demais produtos não foram alterados.`,
    );
    setDecision(null);
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <output
          aria-live="polite"
          className="flex w-full items-center gap-3 border border-success/25 bg-success-soft px-4 py-3 text-sm"
        >
          <CheckCircle2
            aria-hidden="true"
            className="size-5 shrink-0 text-success"
          />
          <p className="flex min-h-8 flex-1 items-center leading-5">
            {feedback}
          </p>
          <button
            type="button"
            onClick={() => setFeedback('')}
            className="min-h-8 cursor-pointer px-2 text-xs font-medium text-muted-foreground"
          >
            Fechar
          </button>
        </output>
      ) : null}

      <header className="flex flex-col gap-5 border bg-white p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Planejamento mensal
          </p>
          <h2 className="mt-2 text-xl font-semibold">Cardápio por dia</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Selecione uma data no calendário. Cada produto pode ter uma
            alternativa de reserva, sem trocar o restante do cardápio.
          </p>
        </div>
        <div className="border-l-2 border-primary bg-primary-soft/55 px-4 py-3 lg:min-w-72">
          <p className="text-xs font-medium text-muted-foreground">Escola</p>
          <p className="mt-1 text-sm font-semibold">{schoolName}</p>
        </div>
      </header>

      <section className="flex flex-col gap-3 border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">
              {days.length} dias
            </strong>{' '}
            preenchidos
          </span>
          <span>
            <strong className="font-semibold text-foreground">
              {substitutionCount}
            </strong>{' '}
            substituições cadastradas
          </span>
          {pendingCount ? (
            <span className="font-medium text-[#765d12]">
              {pendingCount} aguardando confirmação
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {actor === 'nutritionist' ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-none"
              onClick={() => setReuseOpen(true)}
              disabled={editing}
            >
              <History aria-hidden="true" /> Reaproveitar cardápio
            </Button>
          ) : null}
          <Button
            type="button"
            className="h-11 rounded-none bg-[#245f0a]"
            onClick={publishMenu}
            disabled={days.length === 0 || editing}
          >
            {actor === 'nutritionist' ? (
              <Send aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {actor === 'nutritionist' ? 'Enviar ao gestor' : 'Aprovar cardápio'}
          </Button>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-6">
          <MenuMonthCalendar
            key={selectedIso.slice(0, 7)}
            days={days}
            selectedIso={selectedIso}
            initialMonth={initialMonth}
            onSelect={requestDateChange}
            disableSundays={actor === 'nutritionist'}
          />
        </div>

        <SelectedMenuDayPanel
          actor={actor}
          newMenu={newMenu}
          selectedIso={selectedIso}
          day={selectedDay}
          editing={editing}
          draftItems={draftItems}
          formError={formError}
          onBeginEdit={() => beginEditing(selectedDay)}
          onCreate={() => beginEditing()}
          onCancel={cancelEditing}
          onSave={saveDraft}
          onRepeat={(day) => setRecurrenceDay(day)}
          onRequestProduct={requestProductRegistration}
          onChangeItems={(items) => {
            setDraftItems(items);
            setDirty(true);
            setFormError('');
          }}
          onApply={(action) => openDecision('apply', action)}
          onRequest={(action) => openDecision('request', action)}
          onConfirm={(action) => openDecision('confirm', action)}
          onUndo={(action) => openDecision('undo', action)}
        />
      </div>

      <div className="flex items-start gap-3 border bg-white p-4 text-sm">
        <ClipboardCheck
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-primary"
        />
        <p className="leading-6 text-muted-foreground">
          Cada troca fica ligada ao produto e à data. A demanda só considera uma
          alternativa depois que o gestor a confirma.
        </p>
      </div>

      <SubstitutionDecisionDialog
        decision={decision}
        origin={decisionOrigin}
        onOriginChange={setDecisionOrigin}
        onCancel={() => setDecision(null)}
        onConfirm={confirmDecision}
      />

      {actor === 'nutritionist' && reuseOpen ? (
        <MenuReuseSheet
          open
          onOpenChange={setReuseOpen}
          currentDays={days}
          historyDays={menuHistoryDays}
          defaultTargetIso={selectedIso}
          onCreate={addGeneratedDays}
        />
      ) : null}

      {actor === 'nutritionist' && recurrenceDay ? (
        <MenuRecurrenceSheet
          open
          onOpenChange={(open) => {
            if (!open) setRecurrenceDay(null);
          }}
          day={recurrenceDay}
          currentDays={days}
          onCreate={(generatedDays, message) => {
            addGeneratedDays(generatedDays, message);
            setRecurrenceDay(null);
          }}
        />
      ) : null}

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Este cardápio ainda não foi salvo. Se continuar, as alterações
              feitas neste dia serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="rounded-none">
            <AlertDialogCancel
              className="rounded-none"
              onClick={() => setPendingIso(null)}
            >
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const nextIso = pendingIso;
                setDiscardOpen(false);
                setEditing(false);
                setDraftItems([]);
                setDirty(false);
                setFormError('');
                if (nextIso && nextIso !== selectedIso) switchDate(nextIso);
              }}
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SelectedMenuDayPanel({
  actor,
  newMenu,
  selectedIso,
  day,
  editing,
  draftItems,
  formError,
  onBeginEdit,
  onCreate,
  onCancel,
  onSave,
  onRepeat,
  onRequestProduct,
  onChangeItems,
  onApply,
  onRequest,
  onConfirm,
  onUndo,
}: {
  actor: Actor;
  newMenu: boolean;
  selectedIso: string;
  day?: MenuDay;
  editing: boolean;
  draftItems: MenuItem[];
  formError: string;
  onBeginEdit: () => void;
  onCreate: () => void;
  onCancel: () => void;
  onSave: () => void;
  onRepeat: (day: MenuDay) => void;
  onRequestProduct: (suggestedName: string) => void;
  onChangeItems: (items: MenuItem[]) => void;
  onApply: (action: SubstitutionAction) => void;
  onRequest: (action: SubstitutionAction) => void;
  onConfirm: (action: SubstitutionAction) => void;
  onUndo: (action: SubstitutionAction) => void;
}) {
  const canCreate = actor === 'nutritionist' || newMenu;

  if (editing) {
    return (
      <MenuDayForm
        date={selectedIso}
        items={draftItems}
        formError={formError}
        onChange={onChangeItems}
        onRequestProduct={onRequestProduct}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  if (!day) {
    return (
      <section className="grid min-h-[430px] place-items-center border bg-white p-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid size-12 place-items-center bg-subtle text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-primary">
            {formatLongDate(selectedIso)}
          </p>
          <h3 className="mt-2 text-lg font-semibold">
            Nenhum cardápio cadastrado
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {canCreate
              ? 'Selecione os produtos do catálogo e informe as quantidades necessárias para este dia.'
              : 'A nutricionista ainda não cadastrou o cardápio desta data.'}
          </p>
          {canCreate ? (
            <Button
              type="button"
              className="mt-5 h-11 rounded-none bg-[#245f0a]"
              onClick={onCreate}
            >
              <Plus aria-hidden="true" /> Cadastrar cardápio neste dia
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  const substitutionCount = day.items.reduce(
    (total, item) => total + item.substitutions.length,
    0,
  );

  return (
    <section className="min-w-0 border bg-white">
      <header className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-primary">
            <CalendarDays aria-hidden="true" className="size-4" /> {day.weekday}
          </p>
          <h3 className="mt-2 text-xl font-semibold">{day.date}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusPill
              tone={
                day.status === 'Aprovado'
                  ? 'success'
                  : day.status === 'Em revisão'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {day.status}
            </StatusPill>
            <span className="text-xs text-muted-foreground">
              {day.items.length} itens · {substitutionCount}{' '}
              {substitutionCount === 1 ? 'substituição' : 'substituições'}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {actor === 'nutritionist' ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-none"
              onClick={() => onRepeat(day)}
            >
              <Repeat2 aria-hidden="true" /> Repetir este cardápio
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-none"
            onClick={onBeginEdit}
          >
            <Pencil aria-hidden="true" /> Editar cardápio
          </Button>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        <MenuCompositionTable
          day={day}
          actor={actor}
          onApply={onApply}
          onRequest={onRequest}
          onConfirm={onConfirm}
          onUndo={onUndo}
        />
      </div>
    </section>
  );
}

function MenuDayForm({
  date,
  items,
  formError,
  onChange,
  onRequestProduct,
  onCancel,
  onSave,
}: {
  date: string;
  items: MenuItem[];
  formError: string;
  onChange: (items: MenuItem[]) => void;
  onRequestProduct: (suggestedName: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  function updateItem(itemId: string, quantity: number) {
    onChange(
      items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
    );
  }

  function selectItemProduct(itemId: string, productId: string) {
    const product = findMenuProduct(productId);
    if (!product) return;
    onChange(
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productId: product.id,
              product: product.name,
              unit: product.unit,
            }
          : item,
      ),
    );
  }

  function updateSubstitution(
    itemId: string,
    substitutionId: string,
    quantity: number,
  ) {
    onChange(
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              substitutions: item.substitutions.map((substitution) =>
                substitution.id === substitutionId
                  ? { ...substitution, quantity }
                  : substitution,
              ),
            }
          : item,
      ),
    );
  }

  function selectSubstitutionProduct(
    itemId: string,
    substitutionId: string,
    productId: string,
  ) {
    const product = findMenuProduct(productId);
    if (!product) return;
    onChange(
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              substitutions: item.substitutions.map((substitution) =>
                substitution.id === substitutionId
                  ? {
                      ...substitution,
                      productId: product.id,
                      product: product.name,
                      unit: product.unit,
                    }
                  : substitution,
              ),
            }
          : item,
      ),
    );
  }

  return (
    <section className="border bg-white">
      <header className="flex items-start justify-between gap-3 border-b p-5">
        <div>
          <p className="text-xs font-medium text-primary">
            {formatWeekday(date)}
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            Editar {formatDate(date)}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe a quantidade total necessária para a escola.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Fechar edição"
          className="rounded-none"
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </Button>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="space-y-4">
          {items.map((item, itemIndex) => (
            <article key={item.id} className="border bg-subtle">
              <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <h4 className="font-semibold">Produto {itemIndex + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover produto ${itemIndex + 1}`}
                  className="rounded-none text-destructive"
                  onClick={() =>
                    onChange(
                      items.filter((candidate) => candidate.id !== item.id),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </header>

              <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_130px_120px] sm:items-start">
                <Field label="Produto" htmlFor={`product-${item.id}`}>
                  <ProductCombobox
                    id={`product-${item.id}`}
                    value={item.productId}
                    excludedProductIds={items
                      .filter((candidate) => candidate.id !== item.id)
                      .map((candidate) => candidate.productId)
                      .filter(Boolean)}
                    onValueChange={(product) =>
                      selectItemProduct(item.id, product.id)
                    }
                    onRequestProduct={onRequestProduct}
                  />
                </Field>
                <Field label="Quantidade" htmlFor={`quantity-${item.id}`}>
                  <Input
                    id={`quantity-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity || ''}
                    onChange={(event) =>
                      updateItem(item.id, Number(event.target.value))
                    }
                    className="h-11 rounded-none bg-white"
                  />
                </Field>
                <ReadOnlyUnitField value={item.unit || 'Automática'} />
              </div>

              <div className="border-t bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Alternativas para imprevistos
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      São planos de reserva e só serão usados se o produto
                      original não puder ser atendido.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-none"
                    onClick={() =>
                      onChange(
                        items.map((candidate) =>
                          candidate.id === item.id
                            ? {
                                ...candidate,
                                substitutions: [
                                  ...candidate.substitutions,
                                  createBlankSubstitution(),
                                ],
                              }
                            : candidate,
                        ),
                      )
                    }
                  >
                    <Replace aria-hidden="true" /> Adicionar alternativa
                  </Button>
                </div>

                {item.substitutions.length ? (
                  <div className="mt-4 space-y-3">
                    {item.substitutions.map((substitution) => (
                      <div
                        key={substitution.id}
                        className="grid gap-3 border border-[#eadca9] bg-[#fff8df] p-3 sm:grid-cols-[minmax(0,1fr)_120px_110px_44px] sm:items-start"
                      >
                        <Field
                          label={`Produto que substitui ${item.product || 'o item'}`}
                          htmlFor={`sub-product-${substitution.id}`}
                        >
                          <ProductCombobox
                            id={`sub-product-${substitution.id}`}
                            value={substitution.productId}
                            excludedProductIds={[
                              item.productId,
                              ...item.substitutions
                                .filter(
                                  (candidate) =>
                                    candidate.id !== substitution.id,
                                )
                                .map((candidate) => candidate.productId),
                            ].filter(Boolean)}
                            onValueChange={(product) =>
                              selectSubstitutionProduct(
                                item.id,
                                substitution.id,
                                product.id,
                              )
                            }
                            onRequestProduct={onRequestProduct}
                            placeholder="Buscar alternativa..."
                          />
                        </Field>
                        <Field
                          label="Quantidade"
                          htmlFor={`sub-quantity-${substitution.id}`}
                        >
                          <Input
                            id={`sub-quantity-${substitution.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={substitution.quantity || ''}
                            onChange={(event) =>
                              updateSubstitution(
                                item.id,
                                substitution.id,
                                Number(event.target.value),
                              )
                            }
                            className="h-11 rounded-none bg-white"
                          />
                        </Field>
                        <ReadOnlyUnitField
                          value={substitution.unit || 'Automática'}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-lg"
                          aria-label={`Remover substituição por ${substitution.product || 'produto'}`}
                          className="rounded-none text-destructive sm:mt-12"
                          onClick={() =>
                            onChange(
                              items.map((candidate) =>
                                candidate.id === item.id
                                  ? {
                                      ...candidate,
                                      substitutions:
                                        candidate.substitutions.filter(
                                          (current) =>
                                            current.id !== substitution.id,
                                        ),
                                    }
                                  : candidate,
                              ),
                            )
                          }
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    Nenhuma alternativa cadastrada para este produto.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-none border-dashed"
          onClick={() => onChange([...items, createBlankItem()])}
        >
          <Plus aria-hidden="true" /> Adicionar produto
        </Button>

        {formError ? (
          <p
            role="alert"
            className="border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}
      </div>

      <footer className="flex flex-col-reverse justify-end gap-2 border-t bg-subtle p-4 sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-none"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className="h-11 rounded-none bg-[#245f0a]"
          onClick={onSave}
        >
          <Save aria-hidden="true" /> Salvar rascunho
        </Button>
      </footer>
    </section>
  );
}

function SubstitutionDecisionDialog({
  decision,
  origin,
  onOriginChange,
  onCancel,
  onConfirm,
}: {
  decision: Decision | null;
  origin: 'Escola' | 'Problema na entrega';
  onOriginChange: (origin: 'Escola' | 'Problema na entrega') => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!decision) return null;
  const { item, substitution } = decision.action;
  const title =
    decision.kind === 'undo'
      ? `Voltar a usar ${item.product}?`
      : decision.kind === 'request'
        ? `Solicitar a troca por ${substitution.product}?`
        : `Substituir ${item.product} por ${substitution.product}?`;
  const description =
    decision.kind === 'undo'
      ? `${formatQuantity(substitution.quantity)} ${substitution.unit} de ${substitution.product} deixarão de ser usados. ${formatQuantity(item.quantity)} ${item.unit} de ${item.product} voltarão a ficar ativos.`
      : `${formatQuantity(item.quantity)} ${item.unit} de ${item.product} serão trocados por ${formatQuantity(substitution.quantity)} ${substitution.unit} de ${substitution.product}. Os outros produtos não serão alterados.`;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-lg rounded-none sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {decision.kind === 'apply' ? (
          <fieldset>
            <legend className="text-sm font-medium">
              Por que esta troca será feita?
            </legend>
            <div className="mt-2 grid gap-2">
              <label
                className={`flex min-h-12 cursor-pointer items-center gap-3 border px-3 text-sm ${origin === 'Escola' ? 'border-primary bg-primary-soft/50' : 'bg-white'}`}
              >
                <input
                  type="radio"
                  name="substitution-origin"
                  checked={origin === 'Escola'}
                  onChange={() => onOriginChange('Escola')}
                  className="size-4 accent-primary"
                />
                A escola pediu esta troca
              </label>
              <label
                className={`flex min-h-12 cursor-pointer items-center gap-3 border px-3 text-sm ${origin === 'Problema na entrega' ? 'border-primary bg-primary-soft/50' : 'bg-white'}`}
              >
                <input
                  type="radio"
                  name="substitution-origin"
                  checked={origin === 'Problema na entrega'}
                  onChange={() => onOriginChange('Problema na entrega')}
                  className="size-4 accent-primary"
                />
                Houve um problema na entrega
              </label>
            </div>
          </fieldset>
        ) : null}

        <AlertDialogFooter className="rounded-none">
          <AlertDialogCancel className="rounded-none" onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-none bg-[#245f0a] hover:bg-[#1c4d07]"
            onClick={onConfirm}
          >
            {decision.kind === 'request'
              ? 'Enviar solicitação'
              : decision.kind === 'undo'
                ? 'Voltar ao produto original'
                : 'Confirmar substituição'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <Label htmlFor={htmlFor} className="flex min-h-10 items-end leading-5">
        {label}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ReadOnlyUnitField({ value }: { value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="flex min-h-10 items-end text-sm font-medium leading-5">
        Unidade
      </span>
      <div className="mt-2 flex h-11 items-center border bg-white px-3 text-sm font-medium text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

function validateItems(items: MenuItem[]) {
  if (!items.length) return 'Adicione pelo menos um produto ao cardápio.';
  const productIds = items.map((item) => item.productId).filter(Boolean);
  if (new Set(productIds).size !== productIds.length) {
    return 'Cada produto deve aparecer apenas uma vez no cardápio deste dia.';
  }
  for (const item of items) {
    const product = findMenuProduct(item.productId);
    if (!product || !product.active || item.quantity <= 0) {
      return 'Escolha um produto cadastrado e informe uma quantidade válida em todos os itens.';
    }
    for (const substitution of item.substitutions) {
      const alternative = findMenuProduct(substitution.productId);
      if (!alternative || !alternative.active || substitution.quantity <= 0) {
        return `Escolha uma alternativa cadastrada e informe a quantidade para ${item.product}.`;
      }
      if (substitution.productId === item.productId) {
        return `${item.product} não pode substituir o próprio produto.`;
      }
    }
  }
  return '';
}

function chooseInitialIso(days: MenuDay[]) {
  const pending = days.find((day) =>
    day.appliedSubstitutions.some((record) => record.status === 'Solicitada'),
  );
  if (pending) return pending.isoDate;
  const todayIso = '2026-09-08';
  if (days.some((day) => day.isoDate === todayIso)) return todayIso;
  return days[0]?.isoDate ?? todayIso;
}

function createBlankItem(): MenuItem {
  return {
    id: createId('item'),
    productId: '',
    product: '',
    quantity: 0,
    unit: '',
    substitutions: [],
  };
}

function createBlankSubstitution(): MenuSubstitution {
  return {
    id: createId('substitution'),
    productId: '',
    product: '',
    quantity: 0,
    unit: '',
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function cloneDays(days: MenuDay[]) {
  return days.map((day) => ({
    ...day,
    items: cloneItems(day.items),
    appliedSubstitutions: day.appliedSubstitutions.map((record) => ({
      ...record,
    })),
  }));
}

function cloneItems(items: MenuItem[]) {
  return items.map((item) => ({
    ...item,
    substitutions: item.substitutions.map((substitution) => ({
      ...substitution,
    })),
  }));
}

function formatDate(isoDate: string) {
  const date = dateFromIso(isoDate);
  const day = date.getDate() === 1 ? '1º' : String(date.getDate());
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    date,
  );
  return `${day} de ${month}`;
}

function formatLongDate(isoDate: string) {
  return `${formatWeekday(isoDate)}, ${formatDate(isoDate)}`;
}

function formatWeekday(isoDate: string) {
  const value = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(
    dateFromIso(isoDate),
  );
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
    quantity,
  );
}
