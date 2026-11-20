import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

export function PageFrame({
  eyebrow,
  title,
  description,
  action,
  backHref,
  children,
  wide = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 xl:px-8', wide ? 'max-w-[1500px]' : 'max-w-[1260px]')}>
      {backHref ? (
        <Link href={backHref} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" /> Voltar
        </Link>
      ) : null}
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p> : null}
          <h1 className="mt-1.5 text-[1.75rem] font-semibold leading-tight tracking-[-0.04em] sm:text-[2rem]">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="pt-6">{children}</div>
    </div>
  );
}
