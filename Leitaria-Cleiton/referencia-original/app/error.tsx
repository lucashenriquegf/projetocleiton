'use client';

import { SystemState } from '@/components/system/system-state';

export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="grid min-h-screen place-items-center bg-background p-4"><SystemState kind="error" title="Não foi possível abrir esta tela" description="A conexão pode ter oscilado. Seus dados preenchidos continuam preservados neste dispositivo." actionLabel="Tentar novamente" onAction={reset} /></main>; }
