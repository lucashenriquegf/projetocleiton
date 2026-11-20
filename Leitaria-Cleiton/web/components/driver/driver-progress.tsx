import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export function DriverProgress({ completed = 4, total = 7 }: { completed?: number; total?: number }) {
  const percent = Math.round((completed / total) * 100);
  return <section aria-label={`${completed} de ${total} paradas concluídas`} className="border bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{completed} de {total} paradas</p><p className="text-sm font-semibold tabular-nums">{percent}%</p></div><div className="mt-3 flex gap-1">{Array.from({ length: total }).map((_, index) => <span key={index} className={cn('grid h-2 flex-1 place-items-center bg-border', index < completed && 'bg-primary')}>{index < completed ? <Check aria-hidden="true" className="hidden" /> : null}</span>)}</div></section>;
}

export function DriverHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <header className="border-b pb-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p><h1 className="mt-2 text-[1.8rem] font-semibold leading-tight tracking-[-0.04em]">{title}</h1>{description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}</header>;
}
