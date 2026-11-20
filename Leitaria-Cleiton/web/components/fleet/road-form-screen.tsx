'use client';

import { CheckCircle2, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { SettingsMap, type SettingsMapPoint } from '@/components/settings/settings-map';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { RoadRestriction, VehicleCategory, VehicleTraction } from '@/lib/domain';
import { cn } from '@/lib/utils';

export function RoadFormScreen({ roadId }: { roadId?: string }) {
  const router = useRouter();
  const [name, setName] = useState(''); const [reference, setReference] = useState(''); const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'BLOCK_ALL' | 'REQUIREMENTS'>('BLOCK_ALL');
  const [traction, setTraction] = useState<VehicleTraction | ''>(''); const [category, setCategory] = useState<VehicleCategory | ''>(''); const [axles, setAxles] = useState('');
  const [roadPoints, setRoadPoints] = useState<SettingsMapPoint[]>([]); const [mapVersion, setMapVersion] = useState(0);
  const [active, setActive] = useState(true); const [loading, setLoading] = useState(Boolean(roadId)); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!roadId) return;
    let mounted = true;
    void fetch(`/api/roads/${roadId}`)
      .then(async (response) => {
        const body = await response.json() as RoadRestriction & { message?: string };
        if (!response.ok) throw new Error(body.message);
        return body;
      })
      .then((body) => {
        if (!mounted) return;
        setName(body.name);
        setReference(body.reference ?? '');
        setNotes(body.notes ?? '');
        setMode(body.restrictionMode);
        setTraction(body.requiredTraction ?? '');
        setCategory(body.maximumVehicleCategory ?? '');
        setAxles(body.maximumAxles == null ? '' : String(body.maximumAxles));
        setRoadPoints(parseRoadPoints(body.geometry));
        setActive(body.active);
      })
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a via.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [roadId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaved(false);
    if (roadPoints.length !== 2) {
      setError('Marque o início e o fim do trecho no mapa.');
      return;
    }
    setSaving(true);
    try {
      const geometry = JSON.stringify([
        roadPoints.map((point) => [point.lng, point.lat]),
      ]);
      const response = await fetch(roadId ? `/api/roads/${roadId}` : '/api/roads', {
        method: roadId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          reference: reference || null,
          notes: notes || null,
          geometry,
          restrictionMode: mode,
          requiredTraction: traction || null,
          maximumVehicleCategory: category || null,
          maximumAxles: axles ? Number(axles) : null,
          active,
        }),
      });
      const body = await response.json() as RoadRestriction & { message?: string };
      if (!response.ok) throw new Error(body.message);
      if (!roadId) {
        router.replace(`/cadastros/vias-bloqueadas/${body.id}`);
        return;
      }
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a via.');
    } finally {
      setSaving(false);
    }
  }
  return <ManagerShell><PageFrame eyebrow="Vias com restrição" title={roadId ? name || 'Via' : 'Cadastrar via com restrição'} description="Marque o trecho e informe quais veículos podem passar com segurança." backHref="/cadastros/vias-bloqueadas">
    {loading ? <div className="max-w-5xl border bg-white p-8 text-sm text-muted-foreground">Carregando via…</div> : <form onSubmit={submit} className="max-w-5xl border bg-white">{error ? <div role="alert" className="border-b border-alert/25 bg-alert-soft p-4 text-sm font-medium text-alert">{error}</div> : null}{saved ? <output className="flex items-center gap-3 border-b border-success/25 bg-success-soft p-4 text-sm"><CheckCircle2 aria-hidden="true" className="size-5 text-success" /><strong className="text-success">Alterações salvas.</strong></output> : null}
      <div className="space-y-8 p-5 sm:p-7"><section><h2 className="text-lg font-semibold">Identificação</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field id="road-name" label="Nome da via ou trecho"><Input id="road-name" value={name} onChange={(event) => setName(event.target.value)} required className="h-11 rounded-none" /></Field><Field id="road-reference" label="Referência de acesso"><Input id="road-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ex.: Estrada do Barreiro, km 6" className="h-11 rounded-none" /></Field><Field id="road-notes" label="Observação" className="sm:col-span-2"><Textarea id="road-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: risco de atolamento para veículos sem tração" className="min-h-24 resize-y rounded-none" /></Field></div></section>
        <section className="border-t pt-7"><h2 className="text-lg font-semibold">Condição de passagem</h2><p className="mt-1 text-sm text-muted-foreground">Escolha se ninguém pode usar o trecho ou quais requisitos o veículo precisa atender.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setMode('BLOCK_ALL')} className={cn('min-h-20 cursor-pointer border p-4 text-left', mode === 'BLOCK_ALL' && 'border-primary bg-primary-soft')}><strong>Bloqueada para todos</strong><span className="mt-1 block text-sm text-muted-foreground">Nenhuma rota poderá usar este trecho.</span></button><button type="button" onClick={() => setMode('REQUIREMENTS')} className={cn('min-h-20 cursor-pointer border p-4 text-left', mode === 'REQUIREMENTS' && 'border-primary bg-primary-soft')}><strong>Passagem condicionada</strong><span className="mt-1 block text-sm text-muted-foreground">Somente veículos compatíveis poderão passar.</span></button></div>{mode === 'REQUIREMENTS' ? <div className="mt-5 grid gap-5 sm:grid-cols-3"><Field id="road-traction" label="Tração mínima"><select id="road-traction" value={traction} onChange={(event) => setTraction(event.target.value as VehicleTraction | '')} className={selectClass}><option value="">Qualquer tração</option><option value="4X4">4x4</option><option value="6X4">6x4</option></select></Field><Field id="road-category" label="Maior porte permitido"><select id="road-category" value={category} onChange={(event) => setCategory(event.target.value as VehicleCategory | '')} className={selectClass}><option value="">Qualquer porte</option><option value="CAR">Carro</option><option value="UTILITY">Utilitário / picape</option><option value="VAN">Van</option><option value="TRUCK">Caminhão</option></select></Field><Field id="road-axles" label="Máximo de eixos"><Input id="road-axles" type="number" min="2" max="9" value={axles} onChange={(event) => setAxles(event.target.value)} placeholder="Sem limite" className="h-11 rounded-none" /></Field></div> : null}</section>
        <section className="border-t pt-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Trecho no mapa</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Marque o início e o fim. O sistema acompanha a estrada entre os dois pontos.
              </p>
            </div>
            {roadPoints.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRoadPoints([]);
                  setMapVersion((current) => current + 1);
                }}
                className="h-11 shrink-0 cursor-pointer rounded-none"
              >
                <RotateCcw aria-hidden="true" /> Redefinir trecho
              </Button>
            ) : null}
          </div>
          <div className="mt-5 overflow-hidden border">
            <SettingsMap
              key={mapVersion}
              mode="road"
              roadPoints={roadPoints}
              onRoadPointsChange={setRoadPoints}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-live="polite">
            <span className={roadPoints.length >= 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              1. {roadPoints.length >= 1 ? 'Início marcado' : 'Marque o início'}
            </span>
            <span className={roadPoints.length === 2 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              2. {roadPoints.length === 2 ? 'Fim marcado' : 'Marque o fim'}
            </span>
          </div>
        </section>
        <section className="flex items-center gap-4 border bg-subtle p-4"><div className="flex-1"><Label htmlFor="road-active">Restrição ativa</Label><p className="mt-1 text-sm text-muted-foreground">Quando desativada, o trecho volta a ser considerado normalmente.</p></div><Switch id="road-active" checked={active} onCheckedChange={setActive} /></section>
      </div><footer className="flex flex-col-reverse gap-3 border-t bg-subtle p-4 sm:flex-row sm:justify-end"><Link href="/cadastros/vias-bloqueadas" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-none')}>Cancelar</Link><Button type="submit" disabled={saving} className="h-11 cursor-pointer rounded-none bg-[#245f0a]"><Save aria-hidden="true" />{saving ? 'Salvando…' : 'Salvar restrição'}</Button></footer>
    </form>}
  </PageFrame></ManagerShell>;
}
function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) { return <div className={cn('flex min-w-0 flex-col', className)}><div className="flex min-h-10 items-end"><Label htmlFor={id}>{label}</Label></div><div className="mt-2">{children}</div></div>; }
const selectClass = 'h-11 w-full cursor-pointer border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';

function parseRoadPoints(geometry: string): SettingsMapPoint[] {
  try {
    const parsed = JSON.parse(geometry) as unknown;
    if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) return [];
    const coordinates = parsed[0].filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]),
    );
    if (coordinates.length < 2) return [];
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    return [
      { lat: first[1], lng: first[0] },
      { lat: last[1], lng: last[0] },
    ];
  } catch {
    return [];
  }
}
