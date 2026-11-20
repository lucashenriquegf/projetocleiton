'use client';

import { AlertTriangle, CheckCircle2, PackageCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DriverHeader } from '@/components/driver/driver-progress';
import { PersonaShell } from '@/components/layout/persona-shell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ConfirmDeliveryPage() {
  const [confirmed, setConfirmed] = useState(false);
  return <PersonaShell persona="driver"><DriverHeader eyebrow="Parada 6 de 6" title="Confirmar entrega" description="Escola Maria da Terra · confira o resumo antes de concluir a rota." /><section className="mt-5 border bg-white p-5"><h2 className="flex items-center gap-2 font-semibold"><PackageCheck aria-hidden="true" className="size-5 text-primary" /> Carga para entrega</h2><dl className="mt-4 divide-y border-y text-sm"><Pair label="Volumes coletados" value="420 itens" /><Pair label="Produtos" value="6 tipos" /><Pair label="Paradas realizadas" value="5 de 5 coletas" /></dl><div className="mt-5 flex gap-3 border border-[#ecdcae] bg-[#fff8df] p-4 text-sm"><AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-[#765d12]" /><p>Existe uma divergência de 12 unidades de alface. Ela será enviada ao gestor junto com a conclusão.</p></div><label className="mt-5 flex min-h-14 cursor-pointer items-center gap-3 border p-4 text-sm font-medium"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="size-5 accent-primary" /> Confirmo que os produtos foram entregues à escola</label></section><Link href={confirmed ? '/coletor/concluida' : '#confirmar'} aria-disabled={!confirmed} className={cn(buttonVariants({ size: 'lg' }), 'mt-5 h-14 w-full rounded-none bg-[#245f0a] text-base', !confirmed && 'pointer-events-none opacity-45')}><CheckCircle2 aria-hidden="true" /> Confirmar entrega e concluir rota</Link></PersonaShell>;
}
function Pair({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>; }
