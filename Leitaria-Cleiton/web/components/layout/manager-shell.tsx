'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Route,
  CalendarDays,
  Map,
  Database,
  LayoutGrid,
  Settings2,
  Milk,
  LogOut,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const navigation = [
  { label: 'Início', icon: LayoutGrid, href: '/gestor' },
  { label: 'Planejar rota', icon: Route, href: '/rotas' },
  { label: 'Acompanhar', icon: Map, href: '/acompanhamento' },
  { label: 'Agenda', icon: CalendarDays, href: '/agenda' },
  { label: 'Cadastros', icon: Database, href: '/cadastros' },
];

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <a
        href="#conteudo-principal"
        className="sr-only z-50 bg-white px-4 py-3 font-semibold text-foreground focus:fixed focus:left-3 focus:top-3 focus:not-sr-only"
      >
        Ir para o conteúdo
      </a>

      <aside className="sticky top-0 z-40 hidden h-screen self-start flex-col overflow-hidden bg-[#101510] lg:flex">
        <Link
          href="/gestor"
          aria-label="Ir para o início do gestor"
          className="flex h-[76px] w-full items-center gap-3 border-b border-white/10 px-4"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#245f0a] text-white">
            <Milk aria-hidden="true" className="size-6" />
          </span>
          <span className="text-sm font-semibold text-white">
            Leitaria Cleiton
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="w-full px-3 py-5">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.label}>
                  {active ? (
                    <Link
                      href={item.href}
                      aria-current="page"
                      aria-label={item.label}
                      title={item.label}
                      className="flex min-h-12 items-center gap-3 rounded-xl border border-[#3e7c20] bg-[#245f0a] px-3 text-sm font-semibold text-white"
                    >
                      <Icon aria-hidden="true" className="size-5" />
                      {item.label}
                    </Link>
                  ) : (
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      title={item.label}
                      className="flex min-h-12 items-center gap-3 rounded-xl border border-transparent px-3 text-sm font-medium text-white/65 transition-colors hover:bg-white/8 hover:text-white"
                    >
                      <Icon aria-hidden="true" className="size-5" />
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href="/historico"
          className="mx-3 flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/65 hover:bg-white/8 hover:text-white"
        >
          Histórico de viagens
        </Link>

        <Link
          href="/"
          className="mx-3 mt-auto flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-white/65 hover:bg-white/8"
        >
          <LogOut className="size-5" />
          Sair
        </Link>
        <Link
          href="/configuracoes"
          aria-label="Configurações"
          title="Configurações"
          className={cn(
            'mx-3 mb-4 flex min-h-12 items-center gap-3 rounded-xl border border-transparent px-3 text-sm font-medium text-white/65 transition-colors hover:bg-white/8 hover:text-white',
            pathname.startsWith('/configuracoes') &&
              'border-[#3e7c20] bg-[#245f0a] text-white',
          )}
        >
          <Settings2 aria-hidden="true" className="size-5" />
          Configurações
        </Link>
      </aside>

      <main id="conteudo-principal" className="min-w-0 pb-[70px] lg:pb-0">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b bg-[#101510] px-4 text-xs text-white lg:hidden">
          <span className="font-semibold">Leitaria Cleiton</span>
          <div className="flex gap-4">
            <Link href="/historico" className="py-3">
              Histórico
            </Link>
            <Link href="/configuracoes" className="py-3">
              Sobre
            </Link>
            <Link href="/" className="py-3">
              Sair
            </Link>
          </div>
        </div>
        {children}
      </main>

      <nav
        aria-label="Navegação principal móvel"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 bg-[#101510] px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
      >
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 truncate text-[10px] font-medium sm:text-xs',
                active ? 'text-[#75b94d]' : 'text-white/55',
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
