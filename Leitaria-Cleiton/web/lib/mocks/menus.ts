export type MenuStatus = 'Aprovado' | 'Rascunho' | 'Em revisão';

export type MenuProduct = {
  id: string;
  name: string;
  unit: string;
  category: string;
  active: boolean;
};

export type MenuSubstitution = {
  id: string;
  productId: string;
  product: string;
  quantity: number;
  unit: string;
};

export type MenuItem = {
  id: string;
  productId: string;
  product: string;
  quantity: number;
  unit: string;
  substitutions: MenuSubstitution[];
};

export type AppliedSubstitution = {
  id: string;
  sourceItemId: string;
  substitutionId: string;
  origin: 'Escola' | 'Problema na entrega';
  status: 'Solicitada' | 'Confirmada' | 'Desfeita';
  reason: string;
  registeredAt: string;
};

export type MenuDay = {
  id: string;
  date: string;
  isoDate: string;
  weekday: string;
  items: MenuItem[];
  appliedSubstitutions: AppliedSubstitution[];
  status: MenuStatus;
  copiedFrom?: {
    menuDayId: string;
    originalDate: string;
    operationId: string;
  };
};

export const menuProducts: MenuProduct[] = [
  product('abobora', 'Abóbora', 'kg', 'Hortaliças'),
  product('alface', 'Alface', 'unidades', 'Hortaliças'),
  product('arroz', 'Arroz', 'kg', 'Grãos e cereais'),
  product('banana', 'Banana', 'unidades', 'Frutas'),
  product('batata', 'Batata', 'kg', 'Hortaliças'),
  product('beterraba', 'Beterraba', 'kg', 'Hortaliças'),
  product('canja-frango', 'Canja de frango', 'litros', 'Preparações'),
  product('carne-cozida', 'Carne cozida', 'kg', 'Proteínas'),
  product('carne-moida', 'Carne moída', 'kg', 'Proteínas'),
  product('cenoura', 'Cenoura', 'kg', 'Hortaliças'),
  product('couve', 'Couve', 'maços', 'Hortaliças'),
  product('feijao', 'Feijão', 'kg', 'Grãos e cereais'),
  product('frango', 'Frango', 'kg', 'Proteínas'),
  product('frango-assado', 'Frango assado', 'kg', 'Preparações'),
  product('frango-desfiado', 'Frango desfiado', 'kg', 'Preparações'),
  product('frango-ensopado', 'Frango ensopado', 'kg', 'Preparações'),
  product('laranja', 'Laranja', 'unidades', 'Frutas'),
  product('leite', 'Leite', 'litros', 'Laticínios'),
  product('maca', 'Maçã', 'unidades', 'Frutas'),
  product('macarrao', 'Macarrão', 'kg', 'Grãos e cereais'),
  product('mamao', 'Mamão', 'unidades', 'Frutas'),
  product('mandioca', 'Mandioca', 'kg', 'Hortaliças'),
  product('molho-carne', 'Molho de carne', 'kg', 'Preparações'),
  product('omelete-legumes', 'Omelete de legumes', 'dúzias', 'Preparações'),
  product('ovos', 'Ovos', 'dúzias', 'Proteínas'),
  product('ovos-mexidos', 'Ovos mexidos', 'dúzias', 'Preparações'),
  product('pao-caseiro', 'Pão caseiro', 'unidades', 'Panificados'),
  product('peixe', 'Peixe', 'kg', 'Proteínas'),
  product('peixe-assado', 'Peixe assado', 'kg', 'Preparações'),
  product('sopa-legumes', 'Sopa de legumes', 'litros', 'Preparações'),
  product('suco-laranja', 'Suco de laranja', 'litros', 'Bebidas'),
  product('tomate', 'Tomate', 'kg', 'Hortaliças'),
  product('repolho', 'Repolho', 'kg', 'Hortaliças', false),
];

export function findMenuProduct(productId: string) {
  return menuProducts.find((candidate) => candidate.id === productId);
}

export const schoolMenus = [
  {
    id: 'joao-paulo-setembro',
    school: 'Escola Municipal João Paulo II',
    city: 'Inhumas',
    month: 'Setembro de 2026',
    nutritionist: 'Dra. Helena Costa',
    phone: '(62) 99214-7780',
    filledDays: 21,
    totalDays: 22,
    substitutionCount: 6,
    pendingChanges: 1,
    updated: 'Hoje, 08h12',
    status: 'Em revisão',
  },
  {
    id: 'maria-terra-setembro',
    school: 'Escola Maria da Terra',
    city: 'Goianira',
    month: 'Setembro de 2026',
    nutritionist: 'Dra. Paula Nogueira',
    phone: '(62) 99108-4432',
    filledDays: 22,
    totalDays: 22,
    substitutionCount: 4,
    pendingChanges: 0,
    updated: 'Ontem, 16h40',
    status: 'Aprovado',
  },
  {
    id: 'sementes-cerrado-setembro',
    school: 'CMEI Sementes do Cerrado',
    city: 'Trindade',
    month: 'Setembro de 2026',
    nutritionist: 'Dra. Camila Alves',
    phone: '(62) 99802-1150',
    filledDays: 18,
    totalDays: 22,
    substitutionCount: 3,
    pendingChanges: 0,
    updated: '30 ago, 14h18',
    status: 'Rascunho',
  },
  {
    id: 'nova-esperanca-outubro',
    school: 'Escola Nova Esperança',
    city: 'Itaberaí',
    month: 'Outubro de 2026',
    nutritionist: 'Dr. André Martins',
    phone: '(62) 99671-2028',
    filledDays: 8,
    totalDays: 21,
    substitutionCount: 2,
    pendingChanges: 0,
    updated: '29 ago, 10h05',
    status: 'Rascunho',
  },
];

export const septemberMenuDays: MenuDay[] = [
  {
    id: '2026-09-01',
    date: '1º de setembro',
    isoDate: '2026-09-01',
    weekday: 'Terça-feira',
    items: [
      item('sep01-arroz', 'Arroz', 42, 'kg'),
      item('sep01-feijao', 'Feijão', 28, 'kg'),
      item('sep01-frango', 'Frango ensopado', 36, 'kg', [
        substitution('sep01-ovos', 'Ovos', 54, 'dúzias'),
      ]),
      item('sep01-alface', 'Alface', 320, 'unidades', [
        substitution('sep01-couve', 'Couve', 80, 'maços'),
      ]),
      item('sep01-banana', 'Banana', 320, 'unidades'),
    ],
    appliedSubstitutions: [],
    status: 'Aprovado',
  },
  {
    id: '2026-09-02',
    date: '2 de setembro',
    isoDate: '2026-09-02',
    weekday: 'Quarta-feira',
    items: [
      item('sep02-arroz', 'Arroz', 42, 'kg'),
      item('sep02-feijao', 'Feijão', 28, 'kg'),
      item('sep02-carne', 'Carne moída', 34, 'kg', [
        substitution('sep02-frango', 'Frango desfiado', 36, 'kg'),
      ]),
      item('sep02-batata', 'Batata', 48, 'kg', [
        substitution('sep02-mandioca', 'Mandioca', 50, 'kg'),
      ]),
      item('sep02-laranja', 'Laranja', 320, 'unidades'),
    ],
    appliedSubstitutions: [
      {
        id: 'applied-sep02-frango',
        sourceItemId: 'sep02-carne',
        substitutionId: 'sep02-frango',
        origin: 'Escola',
        status: 'Confirmada',
        reason: 'A escola pediu uma preparação sem carne bovina nesta data.',
        registeredAt: 'Hoje, 08h35',
      },
    ],
    status: 'Aprovado',
  },
  {
    id: '2026-09-03',
    date: '3 de setembro',
    isoDate: '2026-09-03',
    weekday: 'Quinta-feira',
    items: [
      item('sep03-macarrao', 'Macarrão', 45, 'kg'),
      item('sep03-molho', 'Molho de carne', 38, 'kg', [
        substitution('sep03-ovos', 'Ovos mexidos', 54, 'dúzias'),
      ]),
      item('sep03-cenoura', 'Cenoura', 32, 'kg'),
      item('sep03-leite', 'Leite', 64, 'litros'),
    ],
    appliedSubstitutions: [],
    status: 'Aprovado',
  },
  {
    id: '2026-09-04',
    date: '4 de setembro',
    isoDate: '2026-09-04',
    weekday: 'Sexta-feira',
    items: [
      item('sep04-arroz', 'Arroz', 42, 'kg'),
      item('sep04-feijao', 'Feijão', 28, 'kg'),
      item('sep04-peixe', 'Peixe assado', 38, 'kg', [
        substitution('sep04-frango', 'Frango assado', 36, 'kg'),
      ]),
      item('sep04-abobora', 'Abóbora', 35, 'kg'),
      item('sep04-mamao', 'Mamão', 160, 'unidades'),
    ],
    appliedSubstitutions: [],
    status: 'Aprovado',
  },
  {
    id: '2026-09-08',
    date: '8 de setembro',
    isoDate: '2026-09-08',
    weekday: 'Terça-feira',
    items: [
      item('sep08-arroz', 'Arroz', 50, 'kg'),
      item('sep08-feijao', 'Feijão', 25, 'kg'),
      item('sep08-beterraba', 'Beterraba', 20, 'kg'),
      item('sep08-ovos', 'Ovos', 10, 'dúzias', [
        substitution('sep08-leite', 'Leite', 60, 'litros'),
      ]),
    ],
    appliedSubstitutions: [
      {
        id: 'requested-sep08-leite',
        sourceItemId: 'sep08-ovos',
        substitutionId: 'sep08-leite',
        origin: 'Escola',
        status: 'Solicitada',
        reason: 'A escola pediu a troca dos ovos neste dia.',
        registeredAt: 'Hoje, 09h10',
      },
    ],
    status: 'Em revisão',
  },
  {
    id: '2026-09-09',
    date: '9 de setembro',
    isoDate: '2026-09-09',
    weekday: 'Quarta-feira',
    items: [
      item('sep09-arroz', 'Arroz', 42, 'kg'),
      item('sep09-feijao', 'Feijão', 28, 'kg'),
      item('sep09-carne', 'Carne cozida', 38, 'kg', [
        substitution('sep09-omelete', 'Omelete de legumes', 54, 'dúzias'),
      ]),
      item('sep09-mandioca', 'Mandioca', 50, 'kg'),
      item('sep09-banana', 'Banana', 320, 'unidades'),
    ],
    appliedSubstitutions: [],
    status: 'Aprovado',
  },
  {
    id: '2026-09-10',
    date: '10 de setembro',
    isoDate: '2026-09-10',
    weekday: 'Quinta-feira',
    items: [
      item('sep10-sopa', 'Sopa de legumes', 96, 'litros', [
        substitution('sep10-canja', 'Canja de frango', 96, 'litros'),
      ]),
      item('sep10-pao', 'Pão caseiro', 320, 'unidades'),
      item('sep10-leite', 'Leite', 64, 'litros', [
        substitution('sep10-suco', 'Suco de laranja', 64, 'litros'),
      ]),
      item('sep10-maca', 'Maçã', 320, 'unidades'),
    ],
    appliedSubstitutions: [],
    status: 'Aprovado',
  },
  {
    id: '2026-09-11',
    date: '11 de setembro',
    isoDate: '2026-09-11',
    weekday: 'Sexta-feira',
    items: [
      item('sep11-arroz', 'Arroz', 42, 'kg'),
      item('sep11-feijao', 'Feijão', 28, 'kg'),
      item('sep11-frango', 'Frango assado', 36, 'kg', [
        substitution('sep11-carne', 'Carne moída', 34, 'kg'),
      ]),
      item('sep11-couve', 'Couve', 80, 'maços'),
      item('sep11-laranja', 'Laranja', 320, 'unidades'),
    ],
    appliedSubstitutions: [],
    status: 'Rascunho',
  },
];

function item(
  id: string,
  product: string,
  quantity: number,
  unit: string,
  substitutions: MenuSubstitution[] = [],
): MenuItem {
  const catalogueProduct = findProductByName(product);
  if (catalogueProduct.unit !== unit) {
    throw new Error(`Unidade diferente do catálogo para ${product}`);
  }
  return {
    id,
    productId: catalogueProduct.id,
    product: catalogueProduct.name,
    quantity,
    unit: catalogueProduct.unit,
    substitutions,
  };
}

function substitution(
  id: string,
  product: string,
  quantity: number,
  unit: string,
): MenuSubstitution {
  const catalogueProduct = findProductByName(product);
  if (catalogueProduct.unit !== unit) {
    throw new Error(`Unidade diferente do catálogo para ${product}`);
  }
  return {
    id,
    productId: catalogueProduct.id,
    product: catalogueProduct.name,
    quantity,
    unit: catalogueProduct.unit,
  };
}

function product(
  id: string,
  name: string,
  unit: string,
  category: string,
  active = true,
): MenuProduct {
  return { id, name, unit, category, active };
}

function findProductByName(name: string) {
  const catalogueProduct = menuProducts.find(
    (candidate) => candidate.name === name,
  );
  if (!catalogueProduct) {
    throw new Error(`Produto não encontrado no catálogo: ${name}`);
  }
  return catalogueProduct;
}

export const menuHistoryDays: MenuDay[] = [
  ...createHistoricalMonth(2025, 8),
  ...createHistoricalMonth(2026, 7),
];

function createHistoricalMonth(year: number, monthIndex: number): MenuDay[] {
  const templateDays = septemberMenuDays.filter((day) => day.items.length > 0);
  const result: MenuDay[] = [];
  const monthLength = new Date(year, monthIndex + 1, 0).getDate();

  for (let dayNumber = 1; dayNumber <= monthLength; dayNumber += 1) {
    const date = new Date(year, monthIndex, dayNumber);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const isoDate = isoFromDate(date);
    const template = templateDays[result.length % templateDays.length];
    result.push({
      id: isoDate,
      isoDate,
      date: formatHistoricalDate(date),
      weekday: capitalize(
        new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date),
      ),
      items: template.items.map((menuItem, itemIndex) => ({
        ...menuItem,
        id: `${isoDate}-item-${itemIndex}`,
        substitutions: menuItem.substitutions.map(
          (menuSubstitution, substitutionIndex) => ({
            ...menuSubstitution,
            id: `${isoDate}-sub-${itemIndex}-${substitutionIndex}`,
          }),
        ),
      })),
      appliedSubstitutions: [],
      status: 'Aprovado',
    });
  }

  return result;
}

function isoFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHistoricalDate(date: Date) {
  const day = date.getDate() === 1 ? '1º' : String(date.getDate());
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    date,
  );
  return `${day} de ${month}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
