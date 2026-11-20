export type DemandStatus =
  | 'Precisa planejar'
  | 'Precisa de revisão'
  | 'Planejada'
  | 'Em coleta'
  | 'Em entrega'
  | 'Concluída'
  | 'Cancelada';

export type DemandRoute = {
  id: string;
  name: string;
  driver: string;
  vehicle?: string;
};

export type DemandProductSummary = {
  name: string;
  quantity: string;
};

export type DemandIssue = {
  title: string;
  description: string;
  actionLabel: string;
};

export type DemandRecord = {
  id: string;
  school: string;
  date: string;
  dateLabel: string;
  dateGroup: string;
  deadline: string;
  menuLabel: 'Cardápio do dia';
  menuChangeCount?: number;
  productCount: number;
  products: DemandProductSummary[];
  coverage: number;
  status: DemandStatus;
  routes: DemandRoute[];
  issue?: DemandIssue;
};

export const demandRecords: DemandRecord[] = [
  {
    id: 'joao-paulo',
    school: 'Escola Municipal João Paulo II',
    date: '2026-09-08',
    dateLabel: '8 de setembro',
    dateGroup: 'Amanhã',
    deadline: '11h30',
    menuLabel: 'Cardápio do dia',
    menuChangeCount: 1,
    productCount: 6,
    products: [
      { name: 'Alface', quantity: '360 unidades' },
      { name: 'Batata', quantity: '200 kg' },
      { name: 'Ovos', quantity: '45 dúzias' },
      { name: 'Farinha', quantity: '60 kg' },
      { name: 'Feijão', quantity: '90 kg' },
      { name: 'Leite', quantity: '120 litros' },
    ],
    coverage: 94,
    status: 'Precisa planejar',
    routes: [],
    issue: {
      title: 'Faltam 15 dúzias de ovos',
      description:
        'Ainda não existe uma coleta possível para completar esta demanda.',
      actionLabel: 'Planejar demanda',
    },
  },
  {
    id: 'nova-esperanca',
    school: 'Escola Nova Esperança',
    date: '2026-09-07',
    dateLabel: '7 de setembro',
    dateGroup: 'Hoje',
    deadline: '14h20',
    menuLabel: 'Cardápio do dia',
    menuChangeCount: 1,
    productCount: 5,
    products: [
      { name: 'Leite', quantity: '120 litros' },
      { name: 'Farinha', quantity: '60 kg' },
      { name: 'Frango', quantity: '34 kg' },
      { name: 'Arroz', quantity: '85 kg' },
      { name: 'Cenoura', quantity: '70 kg' },
    ],
    coverage: 82,
    status: 'Precisa de revisão',
    routes: [{ id: 'rota-oeste', name: 'Rota Oeste', driver: 'Luciana Rocha' }],
    issue: {
      title: 'Um produto do cardápio foi substituído',
      description:
        'Revise a substituição e a nova quantidade antes de confirmar o planejamento.',
      actionLabel: 'Revisar quantidades',
    },
  },
  {
    id: 'serra-dourada',
    school: 'Escola Serra Dourada',
    date: '2026-09-09',
    dateLabel: '9 de setembro',
    dateGroup: 'Quarta-feira, 9 de setembro',
    deadline: '15h20',
    menuLabel: 'Cardápio do dia',
    productCount: 4,
    products: [
      { name: 'Tomate', quantity: '95 kg' },
      { name: 'Couve', quantity: '80 maços' },
      { name: 'Feijão', quantity: '72 kg' },
      { name: 'Mandioca', quantity: '130 kg' },
    ],
    coverage: 76,
    status: 'Precisa de revisão',
    routes: [
      { id: 'rota-serra', name: 'Rota Serra', driver: 'Paulo Henrique' },
    ],
    issue: {
      title: 'A rota não atende todos os produtos',
      description:
        'Os produtores disponíveis estão longe demais do caminho planejado.',
      actionLabel: 'Revisar planejamento',
    },
  },
  {
    id: 'vila-verde',
    school: 'Escola Municipal Vila Verde',
    date: '2026-09-07',
    dateLabel: '7 de setembro',
    dateGroup: 'Hoje',
    deadline: '15h40',
    menuLabel: 'Cardápio do dia',
    productCount: 5,
    products: [
      { name: 'Arroz', quantity: '92 kg' },
      { name: 'Feijão', quantity: '70 kg' },
      { name: 'Abóbora', quantity: '115 kg' },
      { name: 'Banana', quantity: '260 unidades' },
      { name: 'Leite', quantity: '105 litros' },
    ],
    coverage: 0,
    status: 'Precisa planejar',
    routes: [],
  },
  {
    id: 'sol-nascente',
    school: 'CMEI Sol Nascente',
    date: '2026-09-08',
    dateLabel: '8 de setembro',
    dateGroup: 'Amanhã',
    deadline: '09h30',
    menuLabel: 'Cardápio do dia',
    productCount: 4,
    products: [
      { name: 'Batata', quantity: '105 kg' },
      { name: 'Cenoura', quantity: '68 kg' },
      { name: 'Frango', quantity: '42 kg' },
      { name: 'Laranja', quantity: '230 unidades' },
    ],
    coverage: 0,
    status: 'Precisa planejar',
    routes: [],
  },
  {
    id: 'rio-das-pedras',
    school: 'Escola Rio das Pedras',
    date: '2026-09-08',
    dateLabel: '8 de setembro',
    dateGroup: 'Amanhã',
    deadline: '12h40',
    menuLabel: 'Cardápio do dia',
    productCount: 6,
    products: [
      { name: 'Arroz', quantity: '110 kg' },
      { name: 'Feijão', quantity: '84 kg' },
      { name: 'Alface', quantity: '320 unidades' },
      { name: 'Tomate', quantity: '96 kg' },
      { name: 'Ovos', quantity: '38 dúzias' },
      { name: 'Farinha', quantity: '64 kg' },
    ],
    coverage: 0,
    status: 'Precisa planejar',
    routes: [],
  },
  {
    id: 'sao-jose',
    school: 'Escola Municipal São José',
    date: '2026-09-09',
    dateLabel: '9 de setembro',
    dateGroup: 'Quarta-feira, 9 de setembro',
    deadline: '10h00',
    menuLabel: 'Cardápio do dia',
    productCount: 5,
    products: [
      { name: 'Mandioca', quantity: '145 kg' },
      { name: 'Couve', quantity: '75 maços' },
      { name: 'Leite', quantity: '98 litros' },
      { name: 'Banana', quantity: '280 unidades' },
      { name: 'Frango', quantity: '48 kg' },
    ],
    coverage: 0,
    status: 'Precisa planejar',
    routes: [],
  },
  {
    id: 'santa-clara',
    school: 'Escola Santa Clara',
    date: '2026-09-10',
    dateLabel: '10 de setembro',
    dateGroup: 'Quinta-feira, 10 de setembro',
    deadline: '13h30',
    menuLabel: 'Cardápio do dia',
    productCount: 4,
    products: [
      { name: 'Arroz', quantity: '88 kg' },
      { name: 'Feijão', quantity: '66 kg' },
      { name: 'Cenoura', quantity: '74 kg' },
      { name: 'Laranja', quantity: '250 unidades' },
    ],
    coverage: 0,
    status: 'Precisa planejar',
    routes: [],
  },
  {
    id: 'maria-terra',
    school: 'Escola Maria da Terra',
    date: '2026-09-07',
    dateLabel: '7 de setembro',
    dateGroup: 'Hoje',
    deadline: '10h30',
    menuLabel: 'Cardápio do dia',
    productCount: 5,
    products: [
      { name: 'Alface', quantity: '300 unidades' },
      { name: 'Batata', quantity: '200 kg' },
      { name: 'Ovos', quantity: '30 dúzias' },
      { name: 'Farinha', quantity: '55 kg' },
      { name: 'Banana', quantity: '290 unidades' },
    ],
    coverage: 100,
    status: 'Em entrega',
    routes: [{ id: 'rota-norte', name: 'Rota Norte', driver: 'Carlos Mendes' }],
  },
  {
    id: 'boa-uniao',
    school: 'Escola Boa União',
    date: '2026-09-07',
    dateLabel: '7 de setembro',
    dateGroup: 'Hoje',
    deadline: '11h20',
    menuLabel: 'Cardápio do dia',
    productCount: 4,
    products: [
      { name: 'Tomate', quantity: '110 kg' },
      { name: 'Mandioca', quantity: '160 kg' },
      { name: 'Leite', quantity: '90 litros' },
      { name: 'Arroz', quantity: '76 kg' },
    ],
    coverage: 100,
    status: 'Em coleta',
    routes: [{ id: 'rota-leste', name: 'Rota Leste', driver: 'João Ribeiro' }],
  },
  {
    id: 'sementes-cerrado',
    school: 'CMEI Sementes do Cerrado',
    date: '2026-09-08',
    dateLabel: '8 de setembro',
    dateGroup: 'Amanhã',
    deadline: '14h00',
    menuLabel: 'Cardápio do dia',
    productCount: 6,
    products: [
      { name: 'Alface', quantity: '280 unidades' },
      { name: 'Feijão', quantity: '85 kg' },
      { name: 'Laranja', quantity: '300 unidades' },
      { name: 'Arroz', quantity: '90 kg' },
      { name: 'Leite', quantity: '110 litros' },
      { name: 'Tomate', quantity: '82 kg' },
    ],
    coverage: 100,
    status: 'Planejada',
    routes: [
      { id: 'rota-sul', name: 'Rota Sul', driver: 'Marcos Silva' },
      { id: 'rota-vale', name: 'Rota Vale', driver: 'Ana Ferreira' },
    ],
  },
  {
    id: 'caminhos-do-vale',
    school: 'Escola Caminhos do Vale',
    date: '2026-09-09',
    dateLabel: '9 de setembro',
    dateGroup: 'Quarta-feira, 9 de setembro',
    deadline: '13h15',
    menuLabel: 'Cardápio do dia',
    productCount: 5,
    products: [
      { name: 'Arroz', quantity: '95 kg' },
      { name: 'Abóbora', quantity: '140 kg' },
      { name: 'Banana', quantity: '310 unidades' },
      { name: 'Leite', quantity: '115 litros' },
      { name: 'Cenoura', quantity: '78 kg' },
    ],
    coverage: 100,
    status: 'Planejada',
    routes: [{ id: 'rota-vale', name: 'Rota Vale', driver: 'Ana Ferreira' }],
  },
  {
    id: 'flores-do-cerrado',
    school: 'Escola Flores do Cerrado',
    date: '2026-09-10',
    dateLabel: '10 de setembro',
    dateGroup: 'Quinta-feira, 10 de setembro',
    deadline: '12h00',
    menuLabel: 'Cardápio do dia',
    productCount: 4,
    products: [
      { name: 'Arroz', quantity: '80 kg' },
      { name: 'Feijão', quantity: '65 kg' },
      { name: 'Cenoura', quantity: '90 kg' },
      { name: 'Frango', quantity: '44 kg' },
    ],
    coverage: 100,
    status: 'Planejada',
    routes: [{ id: 'rota-sul', name: 'Rota Sul', driver: 'Marcos Silva' }],
  },
  ...createHistoricalDemands(),
];

export function isHistoricalDemand(demand: DemandRecord) {
  return demand.status === 'Concluída' || demand.status === 'Cancelada';
}

function createHistoricalDemands(): DemandRecord[] {
  const seeds = [
    [
      'hist-01',
      'Escola Parque das Flores',
      '2026-09-06',
      '6 de setembro',
      'Carlos Mendes',
    ],
    [
      'hist-02',
      'CMEI Pequeno Agricultor',
      '2026-09-05',
      '5 de setembro',
      'Ana Ferreira',
    ],
    [
      'hist-03',
      'Escola Campo Limpo',
      '2026-09-04',
      '4 de setembro',
      'Luciana Rocha',
    ],
    [
      'hist-04',
      'Escola Monte Verde',
      '2026-09-03',
      '3 de setembro',
      'João Ribeiro',
    ],
    [
      'hist-05',
      'CMEI Sementinha',
      '2026-09-02',
      '2 de setembro',
      'Marcos Silva',
    ],
    [
      'hist-06',
      'Escola São Bento',
      '2026-09-01',
      '1º de setembro',
      'Carlos Mendes',
    ],
    [
      'hist-07',
      'Escola Água Clara',
      '2026-08-31',
      '31 de agosto',
      'Ana Ferreira',
    ],
    [
      'hist-08',
      'Escola Riacho Doce',
      '2026-08-30',
      '30 de agosto',
      'Paulo Henrique',
    ],
    [
      'hist-09',
      'CMEI Ipê Amarelo',
      '2026-08-29',
      '29 de agosto',
      'Luciana Rocha',
    ],
    [
      'hist-10',
      'Escola Boa Colheita',
      '2026-08-28',
      '28 de agosto',
      'João Ribeiro',
    ],
    [
      'hist-11',
      'Escola Novo Horizonte',
      '2026-08-27',
      '27 de agosto',
      'Marcos Silva',
    ],
    ['hist-12', 'CMEI Girassol', '2026-08-26', '26 de agosto', 'Ana Ferreira'],
    [
      'hist-13',
      'Escola Vale Verde',
      '2026-08-25',
      '25 de agosto',
      'Carlos Mendes',
    ],
    [
      'hist-14',
      'Escola Raízes do Campo',
      '2026-08-24',
      '24 de agosto',
      'Paulo Henrique',
    ],
    [
      'hist-15',
      'CMEI Criança Feliz',
      '2026-08-23',
      '23 de agosto',
      'Luciana Rocha',
    ],
    [
      'hist-16',
      'Escola Morro Alto',
      '2026-08-22',
      '22 de agosto',
      'João Ribeiro',
    ],
    [
      'hist-17',
      'Escola Caminho das Águas',
      '2026-08-21',
      '21 de agosto',
      'Marcos Silva',
    ],
    [
      'hist-18',
      'CMEI Pingo de Gente',
      '2026-08-20',
      '20 de agosto',
      'Ana Ferreira',
    ],
    [
      'hist-19',
      'Escola Santa Luzia',
      '2026-08-19',
      '19 de agosto',
      'Carlos Mendes',
    ],
    [
      'hist-20',
      'Escola Recanto Feliz',
      '2026-08-18',
      '18 de agosto',
      'Paulo Henrique',
    ],
    [
      'hist-21',
      'CMEI Primeiros Passos',
      '2026-08-17',
      '17 de agosto',
      'Luciana Rocha',
    ],
    [
      'hist-22',
      'Escola Vereda Grande',
      '2026-08-16',
      '16 de agosto',
      'João Ribeiro',
    ],
  ] as const;

  return seeds.map(([id, school, date, dateLabel, driver], index) => {
    const cancelled = index === 7 || index === 18;
    return {
      id,
      school,
      date,
      dateLabel,
      dateGroup: dateLabel,
      deadline: index % 2 === 0 ? '11h30' : '13h00',
      menuLabel: 'Cardápio do dia',
      productCount: 3,
      products: [
        { name: 'Arroz', quantity: '80 kg' },
        { name: 'Feijão', quantity: '65 kg' },
        { name: 'Hortaliças', quantity: '240 unidades' },
      ],
      coverage: cancelled ? 0 : 100,
      status: cancelled ? 'Cancelada' : 'Concluída',
      routes: [
        {
          id: `rota-historica-${index + 1}`,
          name: `Rota ${index + 1}`,
          driver,
        },
      ],
    } satisfies DemandRecord;
  });
}

export function findDemand(id: string) {
  return demandRecords.find((demand) => demand.id === id);
}
