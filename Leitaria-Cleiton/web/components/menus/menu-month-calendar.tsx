'use client';

import { AlertTriangle, Check, Circle, Replace } from 'lucide-react';
import { useMemo, useState, type ComponentProps } from 'react';
import { ptBR } from 'date-fns/locale';

import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import type { MenuDay } from '@/lib/mocks/menus';
import { cn } from '@/lib/utils';

export function MenuMonthCalendar({
  days,
  selectedIso,
  initialMonth,
  onSelect,
  disableSundays = false,
}: {
  days: MenuDay[];
  selectedIso: string;
  initialMonth: Date;
  onSelect: (isoDate: string) => void;
  disableSundays?: boolean;
}) {
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const dayMap = useMemo(
    () => new Map(days.map((day) => [day.isoDate, day])),
    [days],
  );

  return (
    <section aria-label="Calendário dos cardápios" className="border bg-white">
      <Calendar
        mode="single"
        locale={ptBR}
        month={visibleMonth}
        onMonthChange={setVisibleMonth}
        selected={dateFromIso(selectedIso)}
        onSelect={(date) => {
          if (date && (!disableSundays || date.getDay() !== 0)) {
            onSelect(isoFromDate(date));
          }
        }}
        disabled={disableSundays ? { dayOfWeek: [0] } : undefined}
        showOutsideDays={false}
        className="w-full p-4 [--cell-size:2.75rem] sm:p-5 sm:[--cell-size:3.25rem]"
        classNames={{
          root: 'w-full',
          months: 'w-full',
          month: 'w-full',
          month_grid: 'w-full',
          weekday: 'text-xs font-medium text-muted-foreground',
          disabled: 'text-muted-foreground opacity-100',
        }}
        components={{
          DayButton: (props) => (
            <MenuCalendarDayButton
              {...props}
              menuDay={dayMap.get(isoFromDate(props.day.date))}
            />
          ),
        }}
      />

      <div className="grid gap-2 border-t bg-subtle px-4 py-3 text-xs text-muted-foreground sm:grid-cols-2 sm:px-5">
        <CalendarLegend
          icon={Check}
          className="bg-[#245f0a] text-white"
          label="Cardápio preenchido"
        />
        <CalendarLegend
          icon={Circle}
          className="border border-foreground/25 bg-white text-muted-foreground"
          label="Rascunho"
        />
        <CalendarLegend
          icon={Replace}
          className="bg-[#fff1b8] text-[#765d12]"
          label="Tem alternativa"
        />
        <CalendarLegend
          icon={AlertTriangle}
          className="border border-[#d8b84e] bg-[#fff8df] text-[#765d12]"
          label="Precisa de revisão"
        />
      </div>
    </section>
  );
}

function MenuCalendarDayButton({
  menuDay,
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof CalendarDayButton> & { menuDay?: MenuDay }) {
  const pendingCount =
    menuDay?.appliedSubstitutions.filter(
      (change) => change.status === 'Solicitada',
    ).length ?? 0;
  const substitutionCount =
    menuDay?.items.reduce(
      (total, item) => total + item.substitutions.length,
      0,
    ) ?? 0;
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
  }).format(day.date);
  const summary = menuDay
    ? `${menuDay.status}, ${menuDay.items.length} itens, ${substitutionCount} ${substitutionCount === 1 ? 'substituição' : 'substituições'}${pendingCount ? `, precisa de revisão, ${pendingCount} ${pendingCount === 1 ? 'solicitação pendente' : 'solicitações pendentes'}` : ''}`
    : 'sem cardápio';

  return (
    <CalendarDayButton
      day={day}
      modifiers={modifiers}
      {...props}
      locale={ptBR}
      aria-label={`${dateLabel}, ${summary}${modifiers.disabled ? ', indisponível' : ''}`}
      className={cn(
        'min-h-11 gap-1 rounded-none border border-transparent text-sm hover:border-foreground/15 hover:bg-subtle',
        'data-[selected-single=true]:border-primary data-[selected-single=true]:bg-white data-[selected-single=true]:text-foreground data-[selected-single=true]:ring-2 data-[selected-single=true]:ring-primary/20',
        pendingCount > 0 &&
          'border-[#d8b84e] bg-[#fff8df] text-[#765d12] hover:border-[#b69324] hover:bg-[#fff3c4] data-[selected-single=true]:bg-[#fff8df]',
        modifiers.disabled &&
          'cursor-not-allowed border-border bg-subtle/70 text-muted-foreground opacity-100 hover:border-border hover:bg-subtle/70',
        className,
      )}
    >
      {pendingCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center bg-[#765d12] px-1 text-[0.625rem] font-bold leading-none text-white opacity-100"
        >
          {pendingCount}
        </span>
      ) : null}
      <span aria-hidden="true" className="text-sm font-semibold opacity-100">
        {day.date.getDate()}
      </span>
      {menuDay ? (
        <span
          aria-hidden="true"
          className="flex h-2 items-center justify-center gap-1 opacity-100"
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              menuDay.status === 'Rascunho'
                ? 'border border-foreground/30 bg-white'
                : 'bg-[#245f0a]',
            )}
          />
          {substitutionCount > 0 ? (
            <span className="size-1.5 rounded-full bg-[#d6a800]" />
          ) : null}
        </span>
      ) : null}
    </CalendarDayButton>
  );
}

function CalendarLegend({
  icon: Icon,
  className,
  label,
}: {
  icon: typeof Check;
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('grid size-5 place-items-center', className)}>
        <Icon aria-hidden="true" className="size-3" />
      </span>
      {label}
    </span>
  );
}

export function dateFromIso(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isoFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
