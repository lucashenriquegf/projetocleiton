import { ArrowRight, ClipboardCheck, LayoutGrid, Sprout, Truck } from 'lucide-react';
import Link from 'next/link';

const access = [
  { href: '/gestor', title: 'Entrar como gestor', description: 'Planejar demandas, aprovar rotas e acompanhar coletas.', icon: LayoutGrid },
  { href: '/nutricionista', title: 'Entrar como nutricionista', description: 'Cadastrar os cardápios A e B da escola para cada dia.', icon: ClipboardCheck },
  { href: '/produtor', title: 'Ver área do produtor', description: 'Confirmar ou alterar uma quantidade futura.', icon: Sprout },
  { href: '/coletor', title: 'Abrir rota do caminhoneiro', description: 'Executar paradas, coletas e entrega.', icon: Truck },
];

export default function EntryPage() {
  return <main className="grid min-h-screen bg-[#101510] text-white lg:grid-cols-[.85fr_1.15fr]"><section className="flex flex-col justify-between border-b border-white/10 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-14"><span className="grid size-12 place-items-center bg-[#245f0a]"><Sprout aria-hidden="true" className="size-6" /></span><div className="py-16 lg:py-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8fc66c]">Vale do Meia-Ponte</p><h1 className="mt-4 max-w-lg text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">Da demanda à entrega, sem perder o controle.</h1><p className="mt-5 max-w-md text-base leading-7 text-white/60">Escolha uma experiência para apresentar o fluxo com dados fictícios.</p></div><p className="text-xs text-white/40">Ambiente de demonstração · nenhuma alteração é permanente</p></section><section className="flex items-center p-4 sm:p-8 lg:p-14"><div className="w-full max-w-2xl"><p className="mb-5 text-sm font-medium text-white/65">Como você quer acessar?</p><div className="divide-y divide-white/10 border-y border-white/10">{access.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="group flex min-h-32 items-center gap-4 py-5"><span className="grid size-12 shrink-0 place-items-center border border-white/15 text-[#8fc66c]"><Icon aria-hidden="true" className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-medium">{item.title}</h2><p className="mt-1 text-sm leading-5 text-white/50">{item.description}</p></div><ArrowRight aria-hidden="true" className="size-5 text-white/45 transition-transform group-hover:translate-x-1 group-hover:text-white" /></Link>; })}</div></div></section></main>;
}
