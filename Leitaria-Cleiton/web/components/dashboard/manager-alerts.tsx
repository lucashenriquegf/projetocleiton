'use client';

import { AlertTriangle, ArrowRight, Bell, Clock3 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ManagerAlert } from '@/lib/mocks/dashboard';
import { cn } from '@/lib/utils';

export function ManagerAlerts({
  alerts,
  onSelectRoute,
}: {
  alerts: ManagerAlert[];
  onSelectRoute: (routeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visibleAlerts = showAll ? alerts : alerts.slice(0, 3);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Abrir ${alerts.length} alertas`}
        className="relative h-11 rounded-xl bg-white px-3"
      >
        <Bell aria-hidden="true" />
        <span className="hidden sm:inline">Alertas</span>
        <span
          className="grid min-w-6 place-items-center bg-alert px-1.5 py-0.5 text-xs font-semibold text-white"
          aria-label={`${alerts.length} alertas`}
        >
          {alerts.length}
        </span>
      </Button>

      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setShowAll(false);
        }}
      >
        <SheetContent
          side="right"
          className="w-[min(92vw,430px)] max-w-none gap-0"
          showCloseButton
        >
          <SheetHeader className="border-b px-5 py-5 pr-14">
            <SheetTitle className="text-xl font-semibold tracking-[-0.025em]">
              Alertas
            </SheetTitle>
            <SheetDescription className="mt-1 text-sm">
              Somente situações que precisam da sua atenção.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <ol className="space-y-3">
              {visibleAlerts.map((alert) => (
                <li key={alert.id}>
                  <article
                    className={`rounded-xl border p-4 ${alert.priority === 'critical' ? 'border-alert/30 bg-alert-soft/60' : 'bg-white'}`}
                  >
                    <div
                      className={`flex items-center gap-2 text-xs font-semibold ${alert.priority === 'critical' ? 'text-alert' : 'text-primary'}`}
                    >
                      <AlertTriangle aria-hidden="true" className="size-4" />
                      {alert.eyebrow}
                    </div>
                    <h3 className="mt-3 font-semibold leading-snug">
                      {alert.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {alert.description}
                    </p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 aria-hidden="true" className="size-3.5" />
                      {alert.context}
                    </p>

                    {alert.routeId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          onSelectRoute(alert.routeId!);
                          setOpen(false);
                        }}
                        className="mt-4 h-11 w-full justify-between rounded-xl"
                      >
                        {alert.action}
                        <ArrowRight aria-hidden="true" />
                      </Button>
                    ) : alert.href ? (
                      <Link
                        href={alert.href}
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'lg' }),
                          'mt-4 h-11 w-full justify-between rounded-xl',
                        )}
                      >
                        {alert.action}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    ) : null}
                  </article>
                </li>
              ))}
            </ol>

            {alerts.length > 3 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAll((current) => !current)}
                className="mt-3 h-11 w-full rounded-xl"
              >
                {showAll
                  ? 'Mostrar menos'
                  : `Ver todos os ${alerts.length} alertas`}
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
