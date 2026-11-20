export type RegistryCategory =
  | 'produtos'
  | 'locais'
  | 'caminhoneiros'
  | 'vias-bloqueadas';

export type RegistryStatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export type RegistryItem = {
  id: string;
  category: RegistryCategory;
  name: string;
  summary: string;
  secondary: string;
  status: string;
  statusTone: RegistryStatusTone;
  active: boolean;
  updatedAt: string;
  fields: Record<string, string>;
};

export type RegistryCategoryMeta = {
  slug: RegistryCategory;
  label: string;
  singular: string;
  description: string;
  newLabel: string;
  newHref: string;
};

export const registryCategoryMeta: Record<
  RegistryCategory,
  RegistryCategoryMeta
> = {
  produtos: {
    slug: 'produtos',
    label: 'Produtos',
    singular: 'produto',
    description:
      'Itens e unidades usados nos cardápios, demandas, estoques e coletas.',
    newLabel: 'Novo produto',
    newHref: '/cadastros/produtos/novo',
  },
  locais: {
    slug: 'locais',
    label: 'Locais',
    singular: 'local',
    description:
      'Produtores, escolas, estoques e bases que participam da operação.',
    newLabel: 'Novo local',
    newHref: '/cadastros/locais/novo',
  },
  caminhoneiros: {
    slug: 'caminhoneiros',
    label: 'Caminhoneiros',
    singular: 'caminhoneiro',
    description:
      'Contatos, bases de referência e disponibilidade para receber rotas.',
    newLabel: 'Novo caminhoneiro',
    newHref: '/cadastros/caminhoneiros/novo',
  },
  'vias-bloqueadas': {
    slug: 'vias-bloqueadas',
    label: 'Vias com restrição',
    singular: 'via com restrição',
    description:
      'Trechos bloqueados ou permitidos somente para veículos compatíveis.',
    newLabel: 'Nova via com restrição',
    newHref: '/cadastros/vias-bloqueadas/nova',
  },
};

const productNames = [
  'Alface crespa',
  'Arroz',
  'Banana-prata',
  'Batata inglesa',
  'Beterraba',
  'Cenoura',
  'Feijão carioca',
  'Leite integral',
  'Ovos caipiras',
  'Tomate',
  'Abóbora cabotiá',
  'Abobrinha',
  'Açúcar cristal',
  'Alho',
  'Batata-doce',
  'Cebola',
  'Farinha de mandioca',
  'Laranja',
  'Mamão',
  'Mandioca',
  'Melancia',
  'Milho verde',
  'Pepino',
  'Repolho',
  'Vagem',
  'Couve',
  'Chuchu',
  'Inhame',
  'Limão',
  'Pimentão',
  'Queijo minas',
  'Iogurte natural',
];

const categoryByProduct = [
  'Hortaliças',
  'Grãos',
  'Frutas',
  'Tubérculos',
  'Hortaliças',
  'Hortaliças',
  'Grãos',
  'Laticínios',
  'Proteínas',
  'Hortaliças',
];

const unitByProduct = [
  'Quilograma',
  'Quilograma',
  'Quilograma',
  'Quilograma',
  'Quilograma',
  'Quilograma',
  'Quilograma',
  'Litro',
  'Dúzia',
  'Quilograma',
];

const products: RegistryItem[] = Array.from({ length: 68 }, (_, index) => {
  const baseName = productNames[index % productNames.length];
  const cycle = Math.floor(index / productNames.length);
  const name = cycle === 0 ? baseName : `${baseName} tipo ${cycle + 1}`;
  const category = categoryByProduct[index % categoryByProduct.length];
  const unit = unitByProduct[index % unitByProduct.length];
  const active = (index + 1) % 17 !== 0;

  return {
    id: `produto-${String(index + 1).padStart(3, '0')}`,
    category: 'produtos',
    name,
    summary: `${unit} · ${category}`,
    secondary: `Código PRD-${String(index + 1).padStart(3, '0')}`,
    status: active ? 'Ativo' : 'Inativo',
    statusTone: active ? 'success' : 'neutral',
    active,
    updatedAt: `2026-09-${String((index % 7) + 1).padStart(2, '0')}`,
    fields: {
      Código: `PRD-${String(index + 1).padStart(3, '0')}`,
      Categoria: category,
      Unidade: unit,
      Embalagem:
        index % 3 === 0 ? 'Caixa retornável' : 'Sem embalagem definida',
    },
  };
});

const municipalities = [
  'Inhumas',
  'Goianira',
  'Nerópolis',
  'Anápolis',
  'Trindade',
  'Itaberaí',
  'Goiás',
  'Itauçu',
];

const locationTypes = [
  'Produtor / fazenda',
  'Escola / destino',
  'Estoque',
  'Base operacional',
];

const locationNames = [
  'Sítio Recanto Verde',
  'Escola Municipal João Paulo',
  'Estoque Central',
  'Cooperativa Vale Verde',
  'Fazenda Boa Esperança',
  'Escola Municipal Serra Azul',
  'Chácara Primavera',
  'Escola Municipal Maria de Lourdes',
  'Sítio Santa Clara',
  'Base Operacional Norte',
];

const locations: RegistryItem[] = Array.from({ length: 84 }, (_, index) => {
  const type = locationTypes[index % locationTypes.length];
  const municipality = municipalities[index % municipalities.length];
  const baseName = locationNames[index % locationNames.length];
  const cycle = Math.floor(index / locationNames.length);
  const name = cycle === 0 ? baseName : `${baseName} ${cycle + 1}`;
  const active = (index + 1) % 19 !== 0;
  const phone = `(62) 99${String(100 + index).padStart(3, '0')}-${String(2100 + index)}`;

  return {
    id: `local-${String(index + 1).padStart(3, '0')}`,
    category: 'locais',
    name,
    summary: `${type} · ${municipality}`,
    secondary: `Contato: ${index % 2 === 0 ? 'Maria' : 'João'} · ${phone}`,
    status: active ? 'Ativo' : 'Inativo',
    statusTone: active ? 'success' : 'neutral',
    active,
    updatedAt: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
    fields: {
      Tipo: type,
      Município: municipality,
      Endereço: `Estrada Municipal ${index + 1}, km ${(index % 18) + 1}`,
      Contato: index % 2 === 0 ? 'Maria Ferreira' : 'João Oliveira',
      Telefone: phone,
    },
  };
});

const firstNames = [
  'Carlos',
  'Ana',
  'Marcos',
  'Joana',
  'Paulo',
  'Luciana',
  'Roberto',
  'Fernanda',
  'Antônio',
  'Márcia',
  'José',
  'Patrícia',
];

const lastNames = [
  'Silva',
  'Souza',
  'Oliveira',
  'Ferreira',
  'Santos',
  'Pereira',
];

const availabilities = ['Em rota', 'Disponível', 'Indisponível'];

const drivers: RegistryItem[] = Array.from({ length: 72 }, (_, index) => {
  const name = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]}`;
  const availability = availabilities[index % availabilities.length];
  const municipality = municipalities[(index + 2) % municipalities.length];
  const active = (index + 1) % 23 !== 0;
  const phone = `(62) 98${String(200 + index).padStart(3, '0')}-${String(3100 + index)}`;

  return {
    id: `caminhoneiro-${String(index + 1).padStart(3, '0')}`,
    category: 'caminhoneiros',
    name,
    summary: `${availability} · Base em ${municipality}`,
    secondary: phone,
    status: active ? availability : 'Inativo',
    statusTone: !active
      ? 'neutral'
      : availability === 'Disponível'
        ? 'success'
        : availability === 'Em rota'
          ? 'warning'
          : 'danger',
    active,
    updatedAt: `2026-09-${String((index % 7) + 1).padStart(2, '0')}`,
    fields: {
      Telefone: phone,
      Base: municipality,
      Disponibilidade: availability,
    },
  };
});

const roadNames = [
  'Ponte do Córrego Fundo',
  'Estrada do Barreiro',
  'Acesso à Fazenda Boa Vista',
  'Ponte da Mata',
  'Trecho da Serra Azul',
  'Vicinal do Cedro',
  'Acesso ao Córrego Seco',
  'Estrada da Gameleira',
];

const roads: RegistryItem[] = Array.from({ length: 38 }, (_, index) => {
  const municipality = municipalities[(index + 3) % municipalities.length];
  const baseName = roadNames[index % roadNames.length];
  const cycle = Math.floor(index / roadNames.length);
  const name = cycle === 0 ? baseName : `${baseName} — trecho ${cycle + 1}`;
  const active = (index + 1) % 6 !== 0;

  return {
    id: `via-${String(index + 1).padStart(3, '0')}`,
    category: 'vias-bloqueadas',
    name,
    summary: `${municipality} · Estrada rural`,
    secondary: active
      ? 'Trecho fora do cálculo de rotas'
      : 'Trecho liberado para novas rotas',
    status: active ? 'Bloqueio ativo' : 'Liberada',
    statusTone: active ? 'danger' : 'success',
    active,
    updatedAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
    fields: {
      Município: municipality,
      Referência: `Acesso rural ${index + 1}, km ${(index % 12) + 1}`,
      Motivo: 'Risco permanente de atolamento',
    },
  };
});

export const registryItems: Record<RegistryCategory, RegistryItem[]> = {
  produtos: products,
  locais: locations,
  caminhoneiros: drivers,
  'vias-bloqueadas': roads,
};

export function normalizeRegistrySearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchesRegistrySearch(item: RegistryItem, query: string) {
  const normalizedQuery = normalizeRegistrySearch(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeRegistrySearch(
    [
      item.name,
      item.summary,
      item.secondary,
      ...Object.values(item.fields),
    ].join(' '),
  );

  return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
}

export function findRegistryItem(category: RegistryCategory, id: string) {
  return registryItems[category].find((item) => item.id === id);
}
