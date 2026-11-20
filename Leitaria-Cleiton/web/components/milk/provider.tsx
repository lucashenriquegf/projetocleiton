'use client';
import { useEffect, useRef, useState } from 'react';
import { KEY, initial, type State, type Point } from '@/lib/milk/model';
import { MilkContext as Store, type RoadRoute } from './context';
export function MilkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null),
    [message, notify] = useState(''),
    [error, setError] = useState('');
  const worker = useRef<Worker | null>(null),
    pending = useRef(
      new Map<
        string,
        {
          resolve: (v: unknown) => void;
          reject: (e: Error) => void;
          timer: ReturnType<typeof setTimeout>;
        }
      >(),
    );
  function request(payload: object): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.current.delete(id);
        reject(
          Error('O cálculo demorou mais que o esperado. Tente novamente.'),
        );
      }, 30000);
      pending.current.set(id, { resolve, reject, timer });
      worker.current!.postMessage({ ...payload, id });
    });
  }
  useEffect(() => {
    const requests = pending.current;
    const w = new Worker('/routing/worker.js', { type: 'module' });
    worker.current = w;
    w.onmessage = ({ data }) => {
      const p = pending.current.get(data.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.current.delete(data.id);
      if (data.error) p.reject(Error(data.error));
      else p.resolve(data.result);
    };
    w.onerror = () => {
      setError('O motor de rotas não carregou. Recarregue a página.');
      for (const p of pending.current.values()) {
        clearTimeout(p.timer);
        p.reject(Error('O motor de rotas foi interrompido.'));
      }
      pending.current.clear();
    };
    let live = true;
    request({ type: 'seed' })
      .then((value) => {
        if (!live) return;
        const seed = value as { points: Point[]; base: Point };
        let saved: State | null = null;
        try {
          const raw = localStorage.getItem(KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (
              parsed.version === 2 &&
              Array.isArray(parsed.trips) &&
              parsed.trips.length &&
              Array.isArray(parsed.points) &&
              Array.isArray(parsed.history)
            )
              saved = { ...parsed, base: parsed.base || seed.base };
            else
              notify(
                'Os dados locais eram incompatíveis. Foi carregada uma demonstração nova.',
              );
          }
        } catch {
          notify(
            'Não foi possível ler os dados locais. Foi carregada uma demonstração nova.',
          );
        }
        setState(saved || initial(seed.points, seed.base));
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
      w.terminate();
      for (const p of requests.values()) clearTimeout(p.timer);
      requests.clear();
    };
  }, []);
  function save(s: State) {
    setState(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      notify(
        'Não foi possível salvar neste navegador. Exporte um backup antes de sair.',
      );
    }
  }
  if (!state)
    return (
      <output className="block p-8">
        {error || 'Preparando os locais e a malha de ruas de Inhumas…'}
        {error && (
          <button onClick={() => location.reload()} className="block underline">
            Tentar novamente
          </button>
        )}
      </output>
    );
  return (
    <Store.Provider
      value={{
        state,
        save,
        calculate: (trip, optimize = false) =>
          request({
            type: 'route',
            trip,
            blocks: state.blocks,
            optimize,
          }) as Promise<RoadRoute>,
        message,
        notify,
      }}
    >
      {children}
    </Store.Provider>
  );
}
