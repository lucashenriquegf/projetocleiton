import { ArrowLeftRight, ClipboardCheck, Sprout, Truck } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

export function PersonaShell({
  persona,
  children,
  contentClassName,
}: {
  persona: 'producer' | 'driver' | 'nutritionist';
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const profile = persona === 'producer'
    ? { label: 'Minha produção', icon: Sprout }
    : persona === 'driver'
      ? { label: 'Minha rota', icon: Truck }
      : { label: 'Cardápios da escola', icon: ClipboardCheck };
  const ProfileIcon = profile.icon;
  return (
    <div className="min-h-screen bg-[#eef2eb]">
      <header className="border-b border-white/10 bg-[#101510] text-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center bg-[#245f0a]">
              <ProfileIcon aria-hidden="true" className="size-[18px]" />
            </span>
            <p className="text-sm font-medium">{profile.label}</p>
          </div>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-xs text-white/70 hover:text-white">
            <ArrowLeftRight aria-hidden="true" className="size-4" /> Trocar acesso
          </Link>
        </div>
      </header>
      <main className={cn('mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8', contentClassName)}>{children}</main>
    </div>
  );
}
