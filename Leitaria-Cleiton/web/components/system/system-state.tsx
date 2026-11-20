import { AlertTriangle, LockKeyhole, PackageOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Kind = 'error' | 'empty' | 'permission';

export function SystemState({ kind, title, description, actionLabel, onAction }: { kind: Kind; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  const Icon = kind === 'error' ? AlertTriangle : kind === 'permission' ? LockKeyhole : PackageOpen;
  return <section className="mx-auto max-w-lg border bg-white p-7 text-center sm:p-10"><span className={`mx-auto grid size-14 place-items-center ${kind === 'error' ? 'bg-alert-soft text-alert' : 'bg-primary-soft text-primary'}`}><Icon aria-hidden="true" className="size-6" /></span><h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>{actionLabel && onAction ? <Button className="mt-6 h-11 rounded-none bg-[#245f0a]" onClick={onAction}>{actionLabel}</Button> : null}</section>;
}
