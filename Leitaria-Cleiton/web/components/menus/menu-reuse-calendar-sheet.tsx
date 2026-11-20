'use client';

import {
  CalendarDays,
  ChevronLeft,
  Copy,
  Eraser,
  Repeat2,
  TriangleAlert,
} from 'lucide-react';
import { useMemo, useState, type ComponentProps } from 'react';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MenuDay, MenuItem } from '@/lib/mocks/menus';
import { cn } from '@/lib/utils';

type PlannedCopy = {
  source: MenuDay;
  targetIso: string;
  existing?: MenuDay;
};

export function MenuReuseSheet({
  open,
  onOpenChange,
  currentDays,
  historyDays,
  defaultTargetIso,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDays: MenuDay[];
  historyDays: MenuDay[];
  defaultTargetIso: string;
  onCreate: (days: MenuDay[], message: string) => void;
}) {
  const allSourceDays = useMemo(
    () =>
      [...historyDays, ...currentDays].sort((a, b) =>
        a.isoDate.localeCompare(b.isoDate),
      ),
    [currentDays, historyDays],
  );
  const initialSourceMonth =
    [...allSourceDays]
      .reverse()
      .find((day) => day.isoDate.slice(0, 7) !== defaultTargetIso.slice(0, 7))
      ?.isoDate ??
    allSourceDays[0]?.isoDate ??
    defaultTargetIso;
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSourceIsos, setSelectedSourceIsos] = useState<string[]>([]);
  const [sourceAnchorIso, setSourceAnchorIso] = useState<string | null>(null);
  const [sourceMonth, setSourceMonth] = useState(
    dateFromIso(initialSourceMonth),
  );
  const initialTargetIso = moveFromSunday(defaultTargetIso);
  const [targetIso, setTargetIso] = useState(initialTargetIso);
  const [targetMonth, setTargetMonth] = useState(dateFromIso(initialTargetIso));
  const [replaceDraftDates, setReplaceDraftDates] = useState<string[]>([]);
  const [overwriteConfirmationOpen, setOverwriteConfirmationOpen] =
    useState(false);

  const selectedSourceDays = useMemo(
    () =>
      selectedSourceIsos
        .map((isoDate) =>
          allSourceDays.find((candidate) => candidate.isoDate === isoDate),
        )
        .filter((day): day is MenuDay => Boolean(day))
        .sort((a, b) => a.isoDate.localeCompare(b.isoDate)),
    [allSourceDays, selectedSourceIsos],
  );
  const plannedCopies = useMemo(
    () => planFlexibleCopies(selectedSourceDays, targetIso, currentDays),
    [currentDays, selectedSourceDays, targetIso],
  );
  const replacingCopies = plannedCopies.filter(
    (copy) =>
      copy.existing?.status === 'Rascunho' &&
      replaceDraftDates.includes(copy.targetIso),
  );
  const copiesToCreate = plannedCopies.filter(
    (copy) =>
      !copy.existing ||
      (copy.existing.status === 'Rascunho' &&
        replaceDraftDates.includes(copy.targetIso)),
  );
  const protectedCopies = plannedCopies.filter(
    (copy) => copy.existing && !replacingCopies.includes(copy),
  );
  const sourceItemCount = selectedSourceDays.reduce(
    (total, day) => total + day.items.length,
    0,
  );

  function close() {
    setStep(1);
    setSelectedSourceIsos([]);
    setSourceAnchorIso(null);
    setReplaceDraftDates([]);
    setOverwriteConfirmationOpen(false);
    onOpenChange(false);
  }

  function changeSelectedSources(isoDates: string[]) {
    setSelectedSourceIsos(
      [...new Set(isoDates)]
        .filter((isoDate) => dateFromIso(isoDate).getDay() !== 0)
        .sort(),
    );
    setReplaceDraftDates([]);
  }

  function confirmReuse() {
    if (!copiesToCreate.length) return;
    const operationId = `reuse-${Date.now()}`;
    const copies = copiesToCreate.map((copy) =>
      createCopiedMenuDay(copy.source, copy.targetIso, operationId),
    );
    onCreate(
      copies,
      `${copies.length} ${copies.length === 1 ? 'cardápio foi criado' : 'cardápios foram criados'} como rascunho.${protectedCopies.length ? ` ${protectedCopies.length} ${protectedCopies.length === 1 ? 'data preenchida foi mantida' : 'datas preenchidas foram mantidas'}.` : ''}`,
    );
    close();
  }

  function requestReuse() {
    if (!copiesToCreate.length) return;
    if (replacingCopies.length) {
      setOverwriteConfirmationOpen(true);
      return;
    }
    confirmReuse();
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[min(1180px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              Etapa {step} de 2
            </p>
            <DialogTitle className="text-xl font-semibold leading-tight">
              Reaproveitar cardápios
            </DialogTitle>
            <DialogDescription className="leading-5">
              Escolha os dias no calendário e confira as opções ao lado.
            </DialogDescription>
          </DialogHeader>

          {step === 1 ? (
            <SourceCalendarStep
              days={allSourceDays}
              selectedIsos={selectedSourceIsos}
              anchorIso={sourceAnchorIso}
              visibleMonth={sourceMonth}
              onVisibleMonthChange={setSourceMonth}
              onAnchorChange={setSourceAnchorIso}
              onChange={changeSelectedSources}
              onCancel={close}
              onNext={() => setStep(2)}
            />
          ) : (
            <TargetCalendarStep
              sourceDays={selectedSourceDays}
              sourceItemCount={sourceItemCount}
              currentDays={currentDays}
              targetIso={targetIso}
              targetMonth={targetMonth}
              plannedCopies={plannedCopies}
              copiesToCreateCount={copiesToCreate.length}
              protectedCount={protectedCopies.length}
              replacementCount={replacingCopies.length}
              replaceDraftDates={replaceDraftDates}
              onTargetChange={(isoDate) => {
                setTargetIso(isoDate);
                setReplaceDraftDates([]);
              }}
              onTargetMonthChange={setTargetMonth}
              onToggleDraftReplacement={(isoDate) =>
                setReplaceDraftDates((current) =>
                  current.includes(isoDate)
                    ? current.filter((date) => date !== isoDate)
                    : [...current, isoDate],
                )
              }
              onSetDraftReplacements={setReplaceDraftDates}
              onBack={() => setStep(1)}
              onConfirm={requestReuse}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={overwriteConfirmationOpen}
        onOpenChange={setOverwriteConfirmationOpen}
      >
        <AlertDialogContent className="max-w-md rounded-none sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-[#fff8df] text-[#765d12]">
              <TriangleAlert aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Substituir rascunhos existentes?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {replacingCopies.length}{' '}
              {replacingCopies.length === 1
                ? 'data já possui um cardápio preenchido.'
                : 'datas já possuem cardápios preenchidos.'}{' '}
              Ao continuar, o conteúdo atual será substituído pelos cardápios
              escolhidos.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul
            aria-label="Datas que terão o rascunho substituído"
            className="max-h-40 divide-y overflow-y-auto border text-sm"
          >
            {replacingCopies.map((copy) => (
              <li key={copy.targetIso} className="px-3 py-2.5 font-medium">
                {formatFullDate(copy.targetIso)}
              </li>
            ))}
          </ul>

          <AlertDialogFooter className="rounded-none">
            <AlertDialogCancel className="h-11 cursor-pointer rounded-none">
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11 cursor-pointer rounded-none"
              onClick={confirmReuse}
            >
              Substituir e reaproveitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SourceCalendarStep({
  days,
  selectedIsos,
  anchorIso,
  visibleMonth,
  onVisibleMonthChange,
  onAnchorChange,
  onChange,
  onCancel,
  onNext,
}: {
  days: MenuDay[];
  selectedIsos: string[];
  anchorIso: string | null;
  visibleMonth: Date;
  onVisibleMonthChange: (month: Date) => void;
  onAnchorChange: (isoDate: string) => void;
  onChange: (isoDates: string[]) => void;
  onCancel: () => void;
  onNext: () => void;
}) {
  const dayMap = useMemo(
    () => new Map(days.map((day) => [day.isoDate, day])),
    [days],
  );
  const selectedDays = selectedIsos
    .map((isoDate) => dayMap.get(isoDate))
    .filter((day): day is MenuDay => Boolean(day));
  const weekReference = anchorIso ?? selectedIsos[selectedIsos.length - 1];

  function selectWeek() {
    if (!weekReference) return;
    const start = startOfWeek(dateFromIso(weekReference));
    const end = addDays(start, 6);
    const weekDates = days
      .filter((day) => {
        const date = dateFromIso(day.isoDate);
        return date >= start && date <= end && date.getDay() !== 0;
      })
      .map((day) => day.isoDate);
    onChange([...selectedIsos, ...weekDates]);
  }

  function selectVisibleMonth() {
    const monthDates = days
      .filter((day) => {
        const date = dateFromIso(day.isoDate);
        return (
          date.getFullYear() === visibleMonth.getFullYear() &&
          date.getMonth() === visibleMonth.getMonth() &&
          date.getDay() !== 0
        );
      })
      .map((day) => day.isoDate);
    onChange([...selectedIsos, ...monthDates]);
  }

  return (
    <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
      <main className="flex min-h-[500px] items-center justify-center bg-subtle/45 p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:p-8">
        <section className="w-full max-w-[650px] border bg-white shadow-sm">
          <Calendar
            mode="multiple"
            locale={ptBR}
            month={visibleMonth}
            onMonthChange={onVisibleMonthChange}
            captionLayout="dropdown"
            startMonth={new Date(2024, 0, 1)}
            endMonth={new Date(2027, 11, 1)}
            hideNavigation
            selected={selectedIsos.map(dateFromIso)}
            onDayClick={(date) => {
              const isoDate = isoFromDate(date);
              if (date.getDay() !== 0 && dayMap.has(isoDate)) {
                onAnchorChange(isoDate);
              }
            }}
            onSelect={(dates) =>
              onChange(
                (dates ?? [])
                  .filter((date) => date.getDay() !== 0)
                  .map(isoFromDate)
                  .filter((iso) => dayMap.has(iso)),
              )
            }
            disabled={(date) =>
              date.getDay() === 0 || !dayMap.has(isoFromDate(date))
            }
            showOutsideDays={false}
            className="w-full p-4 [--cell-size:3rem] sm:p-6 sm:[--cell-size:3.7rem] xl:[--cell-size:4.2rem]"
            classNames={{
              root: 'w-full',
              months: 'w-full',
              month: 'w-full',
              month_grid: 'w-full',
              weekdays: 'flex w-full gap-px sm:gap-1 lg:gap-2',
              weekday:
                'flex-1 text-center text-sm font-medium text-muted-foreground',
              week: 'mt-2 flex w-full gap-px sm:gap-1 lg:gap-2',
              disabled: 'text-muted-foreground opacity-100',
            }}
            components={{
              DayButton: (props) => (
                <SourceCalendarDayButton
                  {...props}
                  menuDay={dayMap.get(isoFromDate(props.day.date))}
                />
              ),
            }}
          />
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t bg-subtle px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <Legend swatchClass="bg-primary text-white" label="Selecionado" />
            <Legend
              swatchClass="border border-primary/25 bg-primary-soft"
              label="Tem cardápio"
            />
            <Legend
              swatchClass="border border-border bg-subtle"
              label="Sem cardápio para reaproveitar"
            />
          </div>
        </section>
      </main>

      <aside className="flex min-h-0 flex-col border-t bg-white lg:border-l lg:border-t-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h3 className="text-base font-semibold">
            Quais dias você quer reaproveitar?
          </h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Clique nos dias com cardápio. Depois, ajuste a seleção como quiser.
          </p>

          <div className="mt-5 grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start rounded-none"
              disabled={!weekReference}
              onClick={selectWeek}
            >
              <CalendarDays aria-hidden="true" /> Selecionar semana
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start rounded-none"
              onClick={selectVisibleMonth}
            >
              <CalendarDays aria-hidden="true" /> Selecionar mês visível
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 justify-start rounded-none"
              disabled={!selectedIsos.length}
              onClick={() => onChange([])}
            >
              <Eraser aria-hidden="true" /> Limpar seleção
            </Button>
          </div>

          <section className="mt-5 border bg-white">
            <header className="flex items-center justify-between gap-3 border-b bg-subtle px-4 py-3">
              <div>
                <h4 className="font-semibold">Dias escolhidos</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedDays.length}{' '}
                  {selectedDays.length === 1 ? 'cardápio' : 'cardápios'} ·{' '}
                  {selectedDays.reduce(
                    (total, day) => total + day.items.length,
                    0,
                  )}{' '}
                  produtos
                </p>
              </div>
              <span className="grid size-9 place-items-center bg-primary text-sm font-semibold text-white">
                {selectedDays.length}
              </span>
            </header>
            {selectedDays.length ? (
              <ul className="max-h-64 divide-y overflow-y-auto">
                {selectedDays.map((day) => (
                  <li
                    key={day.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {formatFullDate(day.isoDate)}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {day.items.map((item) => item.product).join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="min-h-10 shrink-0 px-2 text-xs font-medium text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        onChange(
                          selectedIsos.filter(
                            (isoDate) => isoDate !== day.isoDate,
                          ),
                        )
                      }
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum dia selecionado.
              </p>
            )}
          </section>
        </div>

        <footer className="flex shrink-0 gap-2 border-t bg-subtle p-4">
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
            className="ml-auto h-11 rounded-none bg-[#245f0a]"
            disabled={!selectedDays.length}
            onClick={onNext}
          >
            Escolher destino
          </Button>
        </footer>
      </aside>
    </div>
  );
}

function SourceCalendarDayButton({
  menuDay,
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof CalendarDayButton> & { menuDay?: MenuDay }) {
  const dateLabel = formatFullDate(isoFromDate(day.date));
  return (
    <CalendarDayButton
      day={day}
      modifiers={modifiers}
      {...props}
      locale={ptBR}
      aria-label={
        menuDay
          ? `${dateLabel}, cardápio com ${menuDay.items.length} produtos${modifiers.selected ? ', selecionado' : ''}`
          : `${dateLabel}, sem cardápio`
      }
      className={cn(
        'min-h-11 rounded-sm border border-transparent text-sm hover:border-primary/25 hover:bg-primary-soft/45',
        menuDay &&
          "border-primary/15 bg-white after:absolute after:bottom-1.5 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']",
        modifiers.disabled &&
          'cursor-not-allowed border-border bg-subtle/70 text-muted-foreground opacity-100 hover:border-border hover:bg-subtle/70',
        'data-[selected-single=true]:border-primary data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground',
        modifiers.selected &&
          'border-primary bg-primary text-primary-foreground hover:bg-primary-hover after:bg-white',
        className,
      )}
    />
  );
}

function TargetCalendarStep({
  sourceDays,
  sourceItemCount,
  currentDays,
  targetIso,
  targetMonth,
  plannedCopies,
  copiesToCreateCount,
  protectedCount,
  replacementCount,
  replaceDraftDates,
  onTargetChange,
  onTargetMonthChange,
  onToggleDraftReplacement,
  onSetDraftReplacements,
  onBack,
  onConfirm,
}: {
  sourceDays: MenuDay[];
  sourceItemCount: number;
  currentDays: MenuDay[];
  targetIso: string;
  targetMonth: Date;
  plannedCopies: PlannedCopy[];
  copiesToCreateCount: number;
  protectedCount: number;
  replacementCount: number;
  replaceDraftDates: string[];
  onTargetChange: (isoDate: string) => void;
  onTargetMonthChange: (month: Date) => void;
  onToggleDraftReplacement: (isoDate: string) => void;
  onSetDraftReplacements: (isoDates: string[]) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const currentDayMap = useMemo(
    () => new Map(currentDays.map((day) => [day.isoDate, day])),
    [currentDays],
  );
  const firstSource = sourceDays[0];
  const replaceableDraftDates = plannedCopies
    .filter((copy) => copy.existing?.status === 'Rascunho')
    .map((copy) => copy.targetIso);
  const allDraftsSelected =
    replaceableDraftDates.length > 0 &&
    replaceableDraftDates.every((isoDate) =>
      replaceDraftDates.includes(isoDate),
    );

  return (
    <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
      <main className="flex min-h-[500px] items-center justify-center bg-subtle/45 p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:p-8">
        <section className="w-full max-w-[650px] border bg-white shadow-sm">
          <Calendar
            mode="single"
            locale={ptBR}
            month={targetMonth}
            onMonthChange={onTargetMonthChange}
            captionLayout="dropdown"
            startMonth={new Date(2024, 0, 1)}
            endMonth={new Date(2027, 11, 1)}
            hideNavigation
            selected={dateFromIso(targetIso)}
            onSelect={(date) => {
              if (date && date.getDay() !== 0)
                onTargetChange(isoFromDate(date));
            }}
            disabled={{ dayOfWeek: [0] }}
            modifiers={{
              copyTarget: plannedCopies.map((copy) =>
                dateFromIso(copy.targetIso),
              ),
            }}
            showOutsideDays
            className="w-full p-4 [--cell-size:3rem] sm:p-6 sm:[--cell-size:3.7rem] xl:[--cell-size:4.2rem]"
            classNames={{
              root: 'w-full',
              months: 'w-full',
              month: 'w-full',
              month_grid: 'w-full',
              weekdays: 'flex w-full gap-px sm:gap-1 lg:gap-2',
              weekday:
                'flex-1 text-center text-sm font-medium text-muted-foreground',
              week: 'mt-2 flex w-full gap-px sm:gap-1 lg:gap-2',
              disabled: 'text-muted-foreground opacity-100',
            }}
            components={{
              DayButton: (props) => (
                <TargetCalendarDayButton
                  {...props}
                  existing={currentDayMap.get(isoFromDate(props.day.date))}
                />
              ),
            }}
          />
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t bg-subtle px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <Legend
              swatchClass="border border-primary/30 bg-primary-soft"
              label="Dias que receberão cardápio"
            />
            <Legend swatchClass="bg-primary" label="Primeiro dia" />
            <Legend
              swatchClass="border border-[#d8b84e] bg-[#fff8df]"
              label="Já possui cardápio"
            />
          </div>
        </section>
      </main>

      <aside className="flex min-h-0 flex-col border-t bg-white lg:border-l lg:border-t-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h3 className="text-base font-semibold">
            Onde a cópia deve começar?
          </h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Marque no calendário onde o primeiro cardápio escolhido será usado.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <SummaryCard
              value={String(sourceDays.length)}
              label={
                sourceDays.length === 1 ? 'dia escolhido' : 'dias escolhidos'
              }
            />
            <SummaryCard value={String(sourceItemCount)} label="produtos" />
            <SummaryCard
              value={firstSource ? formatShortDate(firstSource.isoDate) : '—'}
              label="primeira origem"
            />
          </div>

          <section className="mt-5 border bg-white p-4">
            <h4 className="font-semibold">Confira antes de criar</h4>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Count
                value={copiesToCreateCount}
                label="serão criados"
                tone="success"
              />
              <Count
                value={protectedCount}
                label="serão mantidos"
                tone="warning"
              />
              <Count
                value={replacementCount}
                label="substituídos"
                tone="neutral"
              />
            </div>
            {protectedCount ? (
              <p className="mt-4 border-l-2 border-[#d8b84e] pl-3 text-sm leading-5 text-muted-foreground">
                Cardápios aprovados ou em revisão ficam protegidos. Rascunhos só
                mudam quando você autorizar abaixo.
              </p>
            ) : null}

            {replaceableDraftDates.length ? (
              <div className="mt-4 flex flex-col gap-3 border bg-subtle p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Rascunhos existentes</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {replaceableDraftDates.length}{' '}
                    {replaceableDraftDates.length === 1
                      ? 'data pode ser substituída.'
                      : 'datas podem ser substituídas.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 cursor-pointer rounded-none bg-white px-4"
                  onClick={() =>
                    onSetDraftReplacements(
                      allDraftsSelected ? [] : replaceableDraftDates,
                    )
                  }
                >
                  {allDraftsSelected ? 'Manter tudo' : 'Substituir tudo'}
                </Button>
              </div>
            ) : null}

            <ul className="mt-4 divide-y border-t">
              {plannedCopies.map((copy) => {
                const replacing = replaceDraftDates.includes(copy.targetIso);
                return (
                  <li
                    key={`${copy.source.id}-${copy.targetIso}`}
                    className="py-3"
                  >
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="leading-5">
                        {formatShortDate(copy.source.isoDate)}
                        <span aria-hidden="true"> → </span>
                        {formatShortDate(copy.targetIso)}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-right text-xs font-medium',
                          copy.existing ? 'text-[#765d12]' : 'text-success',
                        )}
                      >
                        {replacing
                          ? 'Será substituído'
                          : copy.existing
                            ? copy.existing.status === 'Rascunho'
                              ? 'Rascunho existente'
                              : `${copy.existing.status} · protegido`
                            : 'Novo rascunho'}
                      </span>
                    </div>

                    {copy.existing?.status === 'Rascunho' ? (
                      <div className="mt-2 border bg-subtle p-3">
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={replacing}
                            onChange={() =>
                              onToggleDraftReplacement(copy.targetIso)
                            }
                            className="size-4 accent-primary"
                          />
                          Substituir este rascunho
                        </label>
                        <details className="mt-2">
                          <summary className="text-xs font-medium text-primary">
                            Comparar produtos
                          </summary>
                          <div className="mt-2 grid gap-2 text-xs">
                            <ComparisonList
                              title="Rascunho atual"
                              items={copy.existing.items}
                            />
                            <ComparisonList
                              title="Cardápio escolhido"
                              items={copy.source.items}
                            />
                          </div>
                        </details>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <footer className="flex shrink-0 gap-2 border-t bg-subtle p-4">
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-none"
            onClick={onBack}
          >
            <ChevronLeft aria-hidden="true" /> Voltar
          </Button>
          <Button
            type="button"
            className="ml-auto h-11 rounded-none bg-[#245f0a]"
            disabled={!copiesToCreateCount}
            onClick={onConfirm}
          >
            <Copy aria-hidden="true" /> Criar {copiesToCreateCount}{' '}
            {copiesToCreateCount === 1 ? 'rascunho' : 'rascunhos'}
          </Button>
        </footer>
      </aside>
    </div>
  );
}

function TargetCalendarDayButton({
  existing,
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof CalendarDayButton> & { existing?: MenuDay }) {
  return (
    <CalendarDayButton
      day={day}
      modifiers={modifiers}
      {...props}
      locale={ptBR}
      aria-label={`${formatFullDate(isoFromDate(day.date))}${modifiers.copyTarget ? ', receberá cardápio' : ''}${existing ? `, já possui cardápio ${existing.status.toLowerCase()}` : ''}`}
      className={cn(
        'min-h-11 rounded-sm border border-transparent text-sm hover:border-primary/25 hover:bg-primary-soft/45',
        existing && 'border-[#d8b84e] bg-[#fff8df] text-[#765d12]',
        modifiers.copyTarget &&
          'border-primary/35 bg-primary-soft/70 text-foreground ring-1 ring-inset ring-primary/15',
        modifiers.copyTarget &&
          existing &&
          'border-[#d8b84e] bg-[#fff8df] ring-2 ring-inset ring-primary/35',
        modifiers.disabled &&
          'cursor-not-allowed border-border bg-subtle/70 text-muted-foreground opacity-100 hover:border-border hover:bg-subtle/70',
        'data-[selected-single=true]:border-primary data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:ring-2 data-[selected-single=true]:ring-primary/20',
        className,
      )}
    />
  );
}

function ComparisonList({
  title,
  items,
}: {
  title: string;
  items: MenuItem[];
}) {
  return (
    <div className="border bg-white p-2">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 space-y-1 text-muted-foreground">
        {items.map((item) => (
          <li key={item.id}>
            {item.product}: {formatNumber(item.quantity)} {item.unit}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MenuRecurrenceSheet({
  open,
  onOpenChange,
  day,
  currentDays,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: MenuDay;
  currentDays: MenuDay[];
  onCreate: (days: MenuDay[], message: string) => void;
}) {
  const sourceDate = dateFromIso(day.isoDate);
  const [weekdays, setWeekdays] = useState<number[]>(
    sourceDate.getDay() === 0 ? [] : [sourceDate.getDay()],
  );
  const [startDate, setStartDate] = useState(day.isoDate);
  const [endDate, setEndDate] = useState(endOfFollowingMonth(day.isoDate));
  const occurrenceDates = useMemo(
    () => datesMatchingWeekdays(startDate, endDate, weekdays),
    [endDate, startDate, weekdays],
  );
  const emptyDates = occurrenceDates.filter(
    (isoDate) =>
      isoDate !== day.isoDate &&
      !currentDays.some((current) => current.isoDate === isoDate),
  );
  const occupiedDates = occurrenceDates.filter((isoDate) =>
    currentDays.some((current) => current.isoDate === isoDate),
  );
  const occupiedCount = occupiedDates.filter(
    (isoDate) => isoDate !== day.isoDate,
  ).length;

  function toggleWeekday(weekday: number) {
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((candidate) => candidate !== weekday)
        : [...current, weekday].sort((a, b) => a - b),
    );
  }

  function confirmRecurrence() {
    if (!emptyDates.length) return;
    const operationId = `repeat-${Date.now()}`;
    const copies = emptyDates.map((isoDate) =>
      createCopiedMenuDay(day, isoDate, operationId),
    );
    onCreate(
      copies,
      `${copies.length} ${copies.length === 1 ? 'cardápio foi criado' : 'cardápios foram criados'} como rascunho.${occupiedCount ? ` ${occupiedCount} ${occupiedCount === 1 ? 'data preenchida foi mantida' : 'datas preenchidas foram mantidas'}.` : ''}`,
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[min(1180px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14 sm:px-6">
          <DialogTitle className="text-xl font-semibold leading-tight">
            Repetir este cardápio
          </DialogTitle>
          <DialogDescription className="leading-5">
            As datas marcadas no calendário acompanham suas escolhas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
          <main className="flex min-h-[500px] items-center justify-center bg-subtle/45 p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:p-8">
            <RecurrenceCalendarPreview
              key={`${startDate.slice(0, 7)}-${endDate.slice(0, 7)}-${weekdays.join('-')}`}
              startDate={startDate}
              sourceIso={day.isoDate}
              occurrenceDates={occurrenceDates}
              occupiedDates={occupiedDates}
            />
          </main>

          <aside className="flex min-h-0 flex-col border-t bg-white lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <section className="border bg-subtle p-4">
                <p className="text-sm font-semibold">Cardápio de origem</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {formatFullDate(day.isoDate)} · {day.items.length} produtos
                </p>
              </section>

              <fieldset className="mt-5">
                <legend className="text-sm font-medium">
                  Repetir em quais dias?
                </legend>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {weekdayOptions.map((option) => {
                    const selected = weekdays.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          'min-h-11 cursor-pointer border px-2 text-sm font-medium',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'bg-white hover:border-primary/35',
                        )}
                        onClick={() => toggleWeekday(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <DateField
                  id="recurrence-start"
                  label="Começar em"
                  value={startDate}
                  onChange={setStartDate}
                />
                <DateField
                  id="recurrence-end"
                  label="Terminar em"
                  value={endDate}
                  min={startDate}
                  onChange={setEndDate}
                />
              </div>

              <section className="mt-5 border bg-white p-4">
                <h3 className="font-semibold">Resumo</h3>
                {weekdays.length &&
                startDate &&
                endDate &&
                endDate >= startDate ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Repetir às {formatWeekdayList(weekdays)}, de{' '}
                      {formatShortDate(startDate)} a {formatShortDate(endDate)}.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                      <Count
                        value={emptyDates.length}
                        label="novos rascunhos"
                        tone="success"
                      />
                      <Count
                        value={occupiedCount}
                        label="datas preenchidas"
                        tone="warning"
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-destructive">
                    Escolha pelo menos um dia e um período válido.
                  </p>
                )}
              </section>
            </div>

            <footer className="flex shrink-0 gap-2 border-t bg-subtle p-4">
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-none"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="ml-auto h-11 rounded-none bg-[#245f0a]"
                disabled={
                  !weekdays.length ||
                  !startDate ||
                  !endDate ||
                  endDate < startDate ||
                  !emptyDates.length
                }
                onClick={confirmRecurrence}
              >
                <Repeat2 aria-hidden="true" /> Criar {emptyDates.length}{' '}
                {emptyDates.length === 1 ? 'rascunho' : 'rascunhos'}
              </Button>
            </footer>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecurrenceCalendarPreview({
  startDate,
  sourceIso,
  occurrenceDates,
  occupiedDates,
}: {
  startDate: string;
  sourceIso: string;
  occurrenceDates: string[];
  occupiedDates: string[];
}) {
  const plannedDates = occurrenceDates.filter(
    (isoDate) => !occupiedDates.includes(isoDate),
  );
  return (
    <section className="w-full max-w-[650px] border bg-white shadow-sm">
      <header className="border-b bg-subtle px-4 py-3">
        <h3 className="font-semibold">Datas da repetição</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Navegue pelos meses para conferir todos os dias marcados.
        </p>
      </header>
      <Calendar
        mode="multiple"
        locale={ptBR}
        defaultMonth={dateFromIso(startDate || sourceIso)}
        captionLayout="dropdown"
        startMonth={new Date(2024, 0, 1)}
        endMonth={new Date(2027, 11, 1)}
        hideNavigation
        selected={plannedDates.map(dateFromIso)}
        disabled={{ dayOfWeek: [0] }}
        modifiers={{
          planned: plannedDates.map(dateFromIso),
          occupied: occupiedDates.map(dateFromIso),
          source: [dateFromIso(sourceIso)],
        }}
        showOutsideDays={false}
        className="w-full p-4 [--cell-size:3rem] sm:p-6 sm:[--cell-size:3.7rem] xl:[--cell-size:4.2rem]"
        classNames={{
          root: 'w-full',
          months: 'w-full',
          month: 'w-full',
          month_grid: 'w-full',
          weekday:
            'flex-1 text-center text-sm font-medium text-muted-foreground',
          disabled: 'text-muted-foreground opacity-100',
        }}
        components={{
          DayButton: (props) => <RecurrencePreviewDayButton {...props} />,
        }}
      />
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t bg-subtle px-4 py-3 text-xs text-muted-foreground">
        <Legend swatchClass="bg-primary" label="Será criado" />
        <Legend
          swatchClass="border border-[#d8b84e] bg-[#fff8df]"
          label="Já preenchido"
        />
        <Legend
          swatchClass="border-2 border-primary bg-white"
          label="Cardápio de origem"
        />
      </div>
    </section>
  );
}

function RecurrencePreviewDayButton({
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof CalendarDayButton>) {
  const state = modifiers.source
    ? 'cardápio de origem'
    : modifiers.occupied
      ? 'já possui cardápio'
      : modifiers.planned
        ? 'será criado como rascunho'
        : '';
  return (
    <CalendarDayButton
      day={day}
      modifiers={modifiers}
      {...props}
      locale={ptBR}
      tabIndex={-1}
      aria-label={`${formatFullDate(isoFromDate(day.date))}${state ? `, ${state}` : ''}`}
      onClick={(event) => event.preventDefault()}
      className={cn(
        className,
        'min-h-11 cursor-default rounded-none border border-transparent text-sm hover:bg-transparent',
        modifiers.planned && 'border-primary bg-primary text-white',
        modifiers.occupied && 'border-[#d8b84e] bg-[#fff8df] text-[#765d12]',
        modifiers.source &&
          'border-2 border-primary bg-white text-primary ring-2 ring-primary/15',
        modifiers.disabled &&
          'cursor-not-allowed border-border bg-subtle/70 text-muted-foreground opacity-100',
      )}
    />
  );
}

function DateField({
  id,
  label,
  value,
  min,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <label
        htmlFor={id}
        className="flex min-h-10 items-end text-sm font-medium leading-5"
      >
        {label}
      </label>
      <input
        id={id}
        type="date"
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
      />
    </div>
  );
}

function SummaryCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="border bg-subtle p-3">
      <strong className="block truncate font-semibold">{value}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Count({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  return (
    <div
      className={cn(
        'border px-2 py-3',
        tone === 'success' && 'border-success/20 bg-success-soft',
        tone === 'warning' && 'border-[#eadca9] bg-[#fff8df]',
        tone === 'neutral' && 'bg-subtle',
      )}
    >
      <strong className="block text-lg tabular-nums">{value}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Legend({
  swatchClass,
  label,
}: {
  swatchClass: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('size-3', swatchClass)} />
      {label}
    </span>
  );
}

function planFlexibleCopies(
  sourceDays: MenuDay[],
  targetIso: string,
  currentDays: MenuDay[],
): PlannedCopy[] {
  if (!sourceDays.length || !targetIso) return [];
  const sortedSourceDays = [...sourceDays].sort((a, b) =>
    a.isoDate.localeCompare(b.isoDate),
  );
  let nextTargetDate = skipSunday(dateFromIso(targetIso));
  return sortedSourceDays.map((source) => {
    const mappedIso = isoFromDate(nextTargetDate);
    nextTargetDate = skipSunday(addDays(nextTargetDate, 1));
    return {
      source,
      targetIso: mappedIso,
      existing: currentDays.find((day) => day.isoDate === mappedIso),
    };
  });
}

export function createCopiedMenuDay(
  source: MenuDay,
  targetIso: string,
  operationId: string,
): MenuDay {
  return {
    id: targetIso,
    isoDate: targetIso,
    date: formatDate(targetIso),
    weekday: capitalize(
      new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(
        dateFromIso(targetIso),
      ),
    ),
    items: cloneItemsForDate(source.items, targetIso),
    appliedSubstitutions: [],
    status: 'Rascunho',
    copiedFrom: {
      menuDayId: source.id,
      originalDate: source.isoDate,
      operationId,
    },
  };
}

function cloneItemsForDate(items: MenuItem[], isoDate: string): MenuItem[] {
  return items.map((item, itemIndex) => ({
    ...item,
    id: `${isoDate}-item-${itemIndex}-${item.productId}`,
    substitutions: item.substitutions.map(
      (substitution, substitutionIndex) => ({
        ...substitution,
        id: `${isoDate}-sub-${itemIndex}-${substitutionIndex}-${substitution.productId}`,
      }),
    ),
  }));
}

function datesMatchingWeekdays(
  startIso: string,
  endIso: string,
  weekdays: number[],
) {
  if (!startIso || !endIso || endIso < startIso || !weekdays.length) return [];
  const result: string[] = [];
  const end = dateFromIso(endIso);
  for (let date = dateFromIso(startIso); date <= end; date = addDays(date, 1)) {
    if (date.getDay() !== 0 && weekdays.includes(date.getDay())) {
      result.push(isoFromDate(date));
    }
  }
  return result;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function dateFromIso(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isoFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function endOfFollowingMonth(isoDate: string) {
  const date = dateFromIso(isoDate);
  return isoFromDate(new Date(date.getFullYear(), date.getMonth() + 2, 0));
}

function formatDate(isoDate: string) {
  const date = dateFromIso(isoDate);
  const day = date.getDate() === 1 ? '1º' : String(date.getDate());
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    date,
  );
  return `${day} de ${month}`;
}

function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dateFromIso(isoDate));
}

function formatFullDate(isoDate: string) {
  return capitalize(
    new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dateFromIso(isoDate)),
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatWeekdayList(weekdays: number[]) {
  return weekdays
    .map(
      (weekday) =>
        weekdayOptions.find((option) => option.value === weekday)?.longLabel,
    )
    .filter(Boolean)
    .join(', ');
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const weekdayOptions = [
  { value: 1, label: 'Seg', longLabel: 'segundas' },
  { value: 2, label: 'Ter', longLabel: 'terças' },
  { value: 3, label: 'Qua', longLabel: 'quartas' },
  { value: 4, label: 'Qui', longLabel: 'quintas' },
  { value: 5, label: 'Sex', longLabel: 'sextas' },
  { value: 6, label: 'Sáb', longLabel: 'sábados' },
];

function moveFromSunday(isoDate: string) {
  return isoFromDate(skipSunday(dateFromIso(isoDate)));
}

function skipSunday(date: Date) {
  return date.getDay() === 0 ? addDays(date, 1) : date;
}
