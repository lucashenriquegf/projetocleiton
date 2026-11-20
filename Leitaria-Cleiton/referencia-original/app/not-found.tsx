import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotFound() { return <main className="grid min-h-screen place-items-center bg-background p-4"><section className="max-w-lg border bg-white p-8 text-center"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Página não encontrada</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Este endereço não existe</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Volte para a tela inicial e escolha a área que deseja acessar.</p><Link href="/" className={cn(buttonVariants({ size: 'lg' }), 'mt-6 h-11 rounded-none bg-[#245f0a] px-5')}>Voltar ao início</Link></section></main>; }
