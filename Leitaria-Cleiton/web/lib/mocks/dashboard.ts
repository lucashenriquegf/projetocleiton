export type ManagerAlert = {
  id: string;
  priority: 'critical' | 'high' | 'normal';
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  context: string;
  routeId?: string;
  href?: string;
};

export const dashboardAlerts: ManagerAlert[] = [
  {
    id: 'decision-offer-change',
    priority: 'critical',
    eyebrow: 'Redução necessária',
    title: 'A quantidade de alface precisa ser ajustada',
    description:
      'Uma das demandas foi desfeita. A quantidade planejada precisa ser reduzida para 180 unidades.',
    action: 'Revisar redução',
    context: 'Escola João Paulo II',
    href: '/demandas/joao-paulo',
  },
  {
    id: 'decision-demand',
    priority: 'high',
    eyebrow: 'Rota precisa de revisão',
    title: 'A Rota Serra não atende todo o pedido',
    description:
      'Os produtores disponíveis estão longe demais do caminho atual. O trajeto precisa ser revisto.',
    action: 'Ver no mapa',
    context: 'Rota Serra · Petrolina de Goiás',
    routeId: 'rota-serra',
  },
  {
    id: 'decision-driver',
    priority: 'normal',
    eyebrow: 'Quantidade indisponível',
    title: 'Uma coleta da Rota Leste foi reduzida',
    description:
      'O produtor informou que não conseguirá entregar toda a quantidade prevista.',
    action: 'Ver rota',
    context: 'Rota Leste · entrega às 11h20',
    routeId: 'rota-leste',
  },
  {
    id: 'decision-menu-change',
    priority: 'normal',
    eyebrow: 'Substituição necessária',
    title: 'Um produto do cardápio da Escola João Paulo II mudou',
    description:
      '10 dúzias de ovos foram trocadas por 60 litros de leite. Revise o planejamento.',
    action: 'Ver cardápio',
    context: 'Cardápio de quarta-feira',
    href: '/cardapios/joao-paulo',
  },
];
