'use client';

import { ArrowLeft, Check, CheckCircle2, Minus, PackageCheck, X } from 'lucide-react';
import { useState } from 'react';

import { StatusPill } from '@/components/system/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { producerOffers } from '@/lib/mocks/operations';

type Result = { product: string; quantity: number; unit: string; date: string };

export function ProducerFlow() {
  const [editing, setEditing] = useState<(typeof producerOffers)[number] | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  if (result) return <ProducerConfirmation result={result} onBack={() => { setResult(null); setEditing(null); }} />;
  if (editing) return <QuantityEditor offer={editing} quantity={quantity} setQuantity={setQuantity} onCancel={() => setEditing(null)} onSave={(value) => setResult({ product: editing.product, quantity: value, unit: editing.unit, date: editing.collectionDate })} />;

  return <div><p className="text-sm font-medium text-primary">Olá, João</p><h1 className="mt-1 text-[1.8rem] font-semibold tracking-[-0.04em]">Sua produção</h1><p className="mt-2 text-base leading-6 text-muted-foreground">Confirme se o combinado continua disponível. Leva menos de um minuto.</p><div className="mt-6 space-y-4">{producerOffers.map((offer) => <article key={offer.id} className="border bg-white p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center bg-primary-soft text-primary"><PackageCheck aria-hidden="true" className="size-5" /></span><StatusPill tone={offer.status === 'Alterada' ? 'warning' : 'neutral'}>{offer.status}</StatusPill></div><p className="mt-5 text-sm text-muted-foreground">{offer.product}</p><p className="mt-1 text-4xl font-semibold tracking-[-0.04em] tabular-nums">{offer.quantity} <span className="text-lg font-normal text-muted-foreground">{offer.unit}</span></p><p className="mt-3 text-sm text-muted-foreground">Coleta em {offer.collectionDate}, por volta de {offer.collectionTime}</p>{offer.status === 'Alterada' ? <p className="mt-3 border-l-2 border-[#b18b21] pl-3 text-sm text-muted-foreground">A quantidade original era {offer.originalQuantity} {offer.unit}.</p> : null}<div className="mt-6 grid gap-3 sm:grid-cols-2"><Button className="h-14 rounded-none bg-[#245f0a] text-base font-medium" onClick={() => setResult({ product: offer.product, quantity: offer.quantity, unit: offer.unit, date: offer.collectionDate })}><Check aria-hidden="true" className="size-5" /> Está tudo certo</Button><Button variant="outline" className="h-14 rounded-none text-base font-medium" onClick={() => { setEditing(offer); setQuantity(offer.quantity); }}><Minus aria-hidden="true" className="size-5" /> Preciso alterar</Button></div></article>)}</div></div>;
}

function QuantityEditor({ offer, quantity, setQuantity, onCancel, onSave }: { offer: (typeof producerOffers)[number]; quantity: number; setQuantity: (value: number) => void; onCancel: () => void; onSave: (value: number) => void }) {
  return <section className="border bg-white p-5 sm:p-7"><button type="button" onClick={onCancel} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft aria-hidden="true" className="size-4" /> Voltar</button><p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-primary">Alterar quantidade</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{offer.product}</h1><p className="mt-2 text-sm text-muted-foreground">Você havia informado {offer.quantity} {offer.unit}.</p><div className="mt-7"><Label htmlFor="producer-quantity" className="text-base">Quanto você conseguirá fornecer?</Label><div className="mt-3 flex items-center gap-3"><Input id="producer-quantity" type="number" min="0" max={offer.quantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="h-16 rounded-none text-2xl font-semibold tabular-nums" /><span className="min-w-24 text-base text-muted-foreground">{offer.unit}</span></div><p className="mt-3 text-sm text-muted-foreground">Você não precisa explicar o motivo.</p></div><div className="mt-8 space-y-3"><Button className="h-14 w-full rounded-none bg-[#245f0a] text-base" disabled={quantity <= 0 || quantity > offer.quantity} onClick={() => onSave(quantity)}><Check aria-hidden="true" /> Salvar nova quantidade</Button><Button variant="destructive" className="h-14 w-full rounded-none text-base" onClick={() => onSave(0)}><X aria-hidden="true" /> Não terei este produto</Button></div><p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">Se a quantidade mudar, o gestor poderá precisar revisar a rota de coleta.</p></section>;
}

function ProducerConfirmation({ result, onBack }: { result: Result; onBack: () => void }) {
  return <section className="border bg-white p-7 text-center sm:p-10"><span className="mx-auto grid size-16 place-items-center bg-primary text-white"><CheckCircle2 aria-hidden="true" className="size-8" /></span><p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-primary">Informação registrada</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{result.quantity > 0 ? 'Quantidade atualizada' : 'Produto cancelado'}</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{result.quantity > 0 ? `Ficaram registrados ${result.quantity} ${result.unit} de ${result.product} para a coleta de ${result.date}.` : `Você informou que não terá ${result.product} para a coleta de ${result.date}. O gestor será avisado.`}</p><Button className="mt-7 h-14 w-full rounded-none bg-[#245f0a] text-base sm:w-auto sm:px-8" onClick={onBack}>Voltar para minha produção</Button></section>;
}
