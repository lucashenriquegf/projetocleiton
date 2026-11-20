import { AlertTriangle, Check, Clock3, Radio } from 'lucide-react';

import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'danger' | 'live' | 'neutral';

const tones: Record<Tone, string> = {
  success: 'border-[#cfe3c3] bg-[#edf6e8] text-[#35691c]',
  warning: 'border-[#ecdcae] bg-[#fff8df] text-[#765d12]',
  danger: 'border-[#efccc7] bg-alert-soft text-alert',
  live: 'border-[#cfe3c3] bg-[#edf6e8] text-[#35691c]',
  neutral: 'border-border bg-muted text-muted-foreground',
};

export function StatusPill({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  const Icon = tone === 'success' ? Check : tone === 'danger' ? AlertTriangle : tone === 'live' ? Radio : Clock3;
  return (
    <span className={cn('inline-flex min-h-7 items-center gap-1.5 border px-2.5 text-xs font-medium', tones[tone], className)}>
      <Icon aria-hidden="true" className="size-3.5" />
      {children}
    </span>
  );
}
