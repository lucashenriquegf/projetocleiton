'use client';

import { AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DriverHeader } from '@/components/driver/driver-progress';
import { PersonaShell } from '@/components/layout/persona-shell';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const reasons = ['Nada disponível', 'Local fechado', 'Outro problema'];

export default function CollectionProblemPage() {
  const [reason, setReason] = useState(reasons[0]);
  return <PersonaShell persona="driver"><DriverHeader eyebrow="Coleta não realizada" title="O que aconteceu?" description="Escolha uma opção simples. A observação é opcional." /><section className="mt-5 border bg-white p-5"><fieldset><legend className="font-medium">Motivo</legend><div className="mt-4 space-y-2">{reasons.map((item) => <label key={item} className={`flex min-h-14 cursor-pointer items-center gap-3 border p-3 text-sm font-medium ${reason === item ? 'border-primary bg-primary-soft/50' : ''}`}><input type="radio" name="reason" checked={reason === item} onChange={() => setReason(item)} className="size-4 accent-primary" />{item}</label>)}</div></fieldset><div className="mt-6"><Label htmlFor="note">Observação opcional</Label><textarea id="note" maxLength={160} className="mt-2 min-h-24 w-full resize-none border bg-white p-3 text-sm" placeholder="Escreva apenas se ajudar o gestor" /></div><div className="mt-5 flex gap-3 border border-[#ecdcae] bg-[#fff8df] p-4 text-sm"><AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-[#765d12]" /><p>O gestor será avisado e a próxima parada continuará disponível.</p></div></section><Link href="/coletor/entrega" className={cn(buttonVariants({ size: 'lg' }), 'mt-5 h-14 w-full rounded-none bg-[#245f0a] text-base')}>Registrar e seguir<ArrowRight aria-hidden="true" /></Link></PersonaShell>;
}
