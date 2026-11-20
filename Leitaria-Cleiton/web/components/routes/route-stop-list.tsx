import { Check, MapPin } from 'lucide-react';

import { routeStops } from '@/lib/mocks/operations';
import { cn } from '@/lib/utils';

export function RouteStopList({ compact = false }: { compact?: boolean }) {
  return (
    <ol className="divide-y border-y">
      {routeStops.map((stop) => {
        const done = stop.status === 'Concluída';
        const current = stop.status === 'Atual';
        return (
          <li key={stop.sequence} className={cn('flex gap-3 py-4', compact && 'py-3')}>
            <span className={cn('grid size-8 shrink-0 place-items-center border text-xs font-semibold', done && 'border-primary bg-primary text-white', current && 'border-[#101510] bg-[#101510] text-white')}>
              {done ? <Check aria-hidden="true" className="size-4" /> : stop.sequence}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{stop.name}</p>
                <span className={cn('text-xs text-muted-foreground', current && 'font-medium text-foreground')}>{stop.status}</span>
              </div>
              {!compact ? <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin aria-hidden="true" className="size-3" /> {stop.address}</p> : null}
              <p className="mt-1 text-sm text-muted-foreground">{stop.items}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
