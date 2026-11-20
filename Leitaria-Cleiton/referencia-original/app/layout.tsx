import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Vale do Meia-Ponte | Coletas e entregas',
    template: '%s | Vale do Meia-Ponte',
  },
  description:
    'Planejamento e acompanhamento de demandas, coletas e entregas da Cooperativa do Vale do Meia-Ponte.',
  openGraph: {
    title: 'Vale do Meia-Ponte',
    description: 'Demanda, coleta e entrega em uma operação simples e rastreável.',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Vale do Meia-Ponte — Demanda, coleta e entrega' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vale do Meia-Ponte',
    description: 'Demanda, coleta e entrega em uma operação simples e rastreável.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
