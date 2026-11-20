'use client';

import { AlertTriangle, Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DriverHeader } from '@/components/driver/driver-progress';
import { PersonaShell } from '@/components/layout/persona-shell';
import { buttonVariants, Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function RegisterCollectionPage() {
  const [quantity, setQuantity] = useState(160);
  const divergent = quantity !== 160;
  return <PersonaShell persona="driver"><DriverHeader eyebrow="Registrar coleta" title="Quanto foi coletado?" description="Fazenda Sol Nascente · parada 5 de 7" /><section className="mt-5 border bg-white p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Alface</p><p className="mt-1 text-xl font-semibold">Previsto: 160 unidades</p></div>{divergent ? <span className="inline-flex items-center gap-1 border border-[#ecdcae] bg-[#fff8df] px-2 py-1 text-xs font-medium text-[#765d12]"><AlertTriangle aria-hidden="true" className="size-3.5" /> Divergência</span> : null}</div><div className="mt-6"><Label htmlFor="collected" className="text-base">Quantidade coletada</Label><div className="mt-3 flex items-center gap-3"><Input id="collected" type="number" min="0" max="160" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="h-16 rounded-none text-2xl font-semibold tabular-nums" /><span className="text-sm text-muted-foreground">unidades</span></div></div><Button variant="outline" className="mt-4 h-12 w-full rounded-none" onClick={() => setQuantity(160)}><Check aria-hidden="true" /> Coletado como previsto</Button>{divergent ? <p className="mt-4 border-l-2 border-[#b18b21] pl-3 text-sm text-muted-foreground">O gestor verá uma diferença de {160 - quantity} unidades.</p> : null}</section><Link href="/coletor/entrega" className={cn(buttonVariants({ size: 'lg' }), 'mt-5 h-14 w-full rounded-none bg-[#245f0a] text-base')}>Confirmar coleta e seguir</Link></PersonaShell>;
}
