import type { Metadata } from 'next';
import { MilkProvider } from '@/components/milk/provider';
import './globals.css';
export const metadata: Metadata = {
  title: 'Leitaria Cleiton | Rotas de coleta',
  description: 'Protótipo de planejamento e acompanhamento da coleta de leite.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <MilkProvider>{children}</MilkProvider>
      </body>
    </html>
  );
}
