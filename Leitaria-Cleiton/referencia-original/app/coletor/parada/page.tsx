import { AlertTriangle, MapPin, Navigation, PackageCheck, Phone } from 'lucide-react';
import Link from 'next/link';

import { DriverHeader } from '@/components/driver/driver-progress';
import { PersonaShell } from '@/components/layout/persona-shell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CurrentStopPage() {
  return <PersonaShell persona="driver"><DriverHeader eyebrow="Parada 5 de 7" title="Fazenda Sol Nascente" description="Confira o combinado antes de registrar a coleta." /><section className="mt-5 border bg-white p-5"><dl className="space-y-3 text-sm"><Row icon={MapPin} label="Referência" value="GO-070, acesso 14 · porteira verde" /><Row icon={Phone} label="Telefone" value="(62) 99831-4402" /></dl><Link href="/coletor/mapa" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"><Navigation aria-hidden="true" className="size-4" /> Ver trajeto no mapa</Link></section><section className="mt-5 border bg-white p-5"><h2 className="flex items-center gap-2 font-semibold"><PackageCheck aria-hidden="true" className="size-5 text-primary" /> Produtos previstos</h2><div className="mt-4 flex items-center justify-between border-y py-4"><p className="font-medium">Alface</p><p className="text-lg font-semibold tabular-nums">160 unidades</p></div></section><div className="mt-5 space-y-3"><Link href="/coletor/coleta" className={cn(buttonVariants({ size: 'lg' }), 'h-14 w-full rounded-none bg-[#245f0a] text-base')}>Registrar coleta</Link><Link href="/coletor/problema" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-14 w-full rounded-none text-base text-alert')}><AlertTriangle aria-hidden="true" /> Não foi possível coletar</Link></div></PersonaShell>;
}
function Row({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) { return <div className="flex items-start gap-3"><Icon aria-hidden="true" className="mt-0.5 size-4 text-primary" /><dt className="w-20 text-muted-foreground">{label}</dt><dd className="flex-1 font-medium">{value}</dd></div>; }
