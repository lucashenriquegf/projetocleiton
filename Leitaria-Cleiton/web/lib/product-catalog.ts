export type ProductUnitOption = {
  code: string;
  label: string;
  shortLabel: string;
  group: 'Massa' | 'Volume' | 'Contagem' | 'Comerciais';
  aliases: string[];
  weightFactorKg?: number;
};

export type PackagingOption = {
  code: string;
  label: string;
  suggestedContent?: number;
  compatibleUnit?: string;
};

export const productUnits: ProductUnitOption[] = [
  { code: 'mg', label: 'Miligrama', shortLabel: 'mg', group: 'Massa', aliases: ['miligramas'], weightFactorKg: 0.000001 },
  { code: 'g', label: 'Grama', shortLabel: 'g', group: 'Massa', aliases: ['gramas'], weightFactorKg: 0.001 },
  { code: 'kg', label: 'Quilograma', shortLabel: 'kg', group: 'Massa', aliases: ['quilo', 'quilos', 'quilogramas'], weightFactorKg: 1 },
  { code: 'arroba', label: 'Arroba', shortLabel: '@', group: 'Massa', aliases: ['arrobas'], weightFactorKg: 15 },
  { code: 't', label: 'Tonelada', shortLabel: 't', group: 'Massa', aliases: ['toneladas'], weightFactorKg: 1000 },
  { code: 'ml', label: 'Mililitro', shortLabel: 'mL', group: 'Volume', aliases: ['mililitros'] },
  { code: 'l', label: 'Litro', shortLabel: 'L', group: 'Volume', aliases: ['litros'] },
  { code: 'm3', label: 'Metro cúbico', shortLabel: 'm³', group: 'Volume', aliases: ['metros cubicos'] },
  { code: 'un', label: 'Unidade', shortLabel: 'un', group: 'Contagem', aliases: ['unidades'] },
  { code: 'par', label: 'Par', shortLabel: 'par', group: 'Contagem', aliases: ['pares'] },
  { code: 'duzia', label: 'Dúzia', shortLabel: 'dz', group: 'Contagem', aliases: ['duzia', 'duzias'] },
  { code: 'cento', label: 'Cento', shortLabel: 'cento', group: 'Contagem', aliases: ['centena'] },
  { code: 'milheiro', label: 'Milheiro', shortLabel: 'milheiro', group: 'Contagem', aliases: ['milhar'] },
  { code: 'cabeca', label: 'Cabeça', shortLabel: 'cabeça', group: 'Contagem', aliases: ['cabeca', 'cabecas', 'cabeças'] },
  { code: 'pe', label: 'Pé', shortLabel: 'pé', group: 'Contagem', aliases: ['pe', 'pes', 'pés'] },
  { code: 'cacho', label: 'Cacho', shortLabel: 'cacho', group: 'Contagem', aliases: ['cachos'] },
  { code: 'espiga', label: 'Espiga', shortLabel: 'espiga', group: 'Contagem', aliases: ['espigas'] },
  { code: 'cartela', label: 'Cartela', shortLabel: 'cartela', group: 'Contagem', aliases: ['cartelas'] },
  { code: 'maco', label: 'Maço', shortLabel: 'maço', group: 'Comerciais', aliases: ['maco', 'macos', 'maços'] },
  { code: 'feixe', label: 'Feixe', shortLabel: 'feixe', group: 'Comerciais', aliases: ['feixes'] },
  { code: 'bandeja', label: 'Bandeja', shortLabel: 'bandeja', group: 'Comerciais', aliases: ['bandejas'] },
  { code: 'pacote', label: 'Pacote', shortLabel: 'pct', group: 'Comerciais', aliases: ['pacotes'] },
  { code: 'saco', label: 'Saco', shortLabel: 'saco', group: 'Comerciais', aliases: ['sacos'] },
  { code: 'saca', label: 'Saca', shortLabel: 'saca', group: 'Comerciais', aliases: ['sacas'] },
  { code: 'caixa', label: 'Caixa', shortLabel: 'cx', group: 'Comerciais', aliases: ['caixas'] },
  { code: 'engradado', label: 'Engradado', shortLabel: 'engradado', group: 'Comerciais', aliases: ['engradados'] },
  { code: 'fardo', label: 'Fardo', shortLabel: 'fardo', group: 'Comerciais', aliases: ['fardos'] },
  { code: 'cesta', label: 'Cesta', shortLabel: 'cesta', group: 'Comerciais', aliases: ['cestas'] },
  { code: 'balde', label: 'Balde', shortLabel: 'balde', group: 'Comerciais', aliases: ['baldes'] },
  { code: 'lata', label: 'Lata', shortLabel: 'lata', group: 'Comerciais', aliases: ['latas'] },
  { code: 'garrafa', label: 'Garrafa', shortLabel: 'garrafa', group: 'Comerciais', aliases: ['garrafas'] },
  { code: 'frasco', label: 'Frasco', shortLabel: 'frasco', group: 'Comerciais', aliases: ['frascos'] },
  { code: 'galao', label: 'Galão', shortLabel: 'galão', group: 'Comerciais', aliases: ['galao', 'galoes', 'galões'] },
  { code: 'bombona', label: 'Bombona', shortLabel: 'bombona', group: 'Comerciais', aliases: ['bombonas'] },
  { code: 'tambor', label: 'Tambor', shortLabel: 'tambor', group: 'Comerciais', aliases: ['tambores'] },
  { code: 'botijao', label: 'Botijão', shortLabel: 'botijão', group: 'Comerciais', aliases: ['botijao', 'botijoes', 'botijões'] },
  { code: 'lote', label: 'Lote', shortLabel: 'lote', group: 'Comerciais', aliases: ['lotes'] },
];

export const packagingOptions: PackagingOption[] = [
  { code: 'AVULSO', label: 'Sem embalagem / avulso', suggestedContent: 1 },
  { code: 'CAIXA_PLASTICA', label: 'Caixa plástica' },
  { code: 'CAIXA_PAPELAO', label: 'Caixa de papelão' },
  { code: 'ENGRADADO', label: 'Engradado' },
  { code: 'BANDEJA', label: 'Bandeja' },
  { code: 'PACOTE', label: 'Pacote' },
  { code: 'SACO', label: 'Saco' },
  { code: 'SACA', label: 'Saca' },
  { code: 'FARDO', label: 'Fardo' },
  { code: 'CESTA', label: 'Cesta' },
  { code: 'BALDE', label: 'Balde' },
  { code: 'LATA', label: 'Lata' },
  { code: 'GARRAFA', label: 'Garrafa' },
  { code: 'FRASCO', label: 'Frasco' },
  { code: 'GALAO_5L', label: 'Galão de 5 litros', suggestedContent: 5, compatibleUnit: 'l' },
  { code: 'GALAO_10L', label: 'Galão de 10 litros', suggestedContent: 10, compatibleUnit: 'l' },
  { code: 'GALAO_20L', label: 'Galão de 20 litros', suggestedContent: 20, compatibleUnit: 'l' },
  { code: 'BOMBONA', label: 'Bombona' },
  { code: 'TAMBOR', label: 'Tambor' },
  { code: 'BOTIJAO', label: 'Botijão' },
  { code: 'PALLET', label: 'Pallet' },
  { code: 'OUTRO', label: 'Outro tipo' },
];

export function normalizeProductName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function findProductUnit(code: string) {
  return productUnits.find((unit) => unit.code === normalizeLegacyUnit(code));
}

export function getProductUnitLabel(code: string) {
  return findProductUnit(code)?.label ?? code;
}

export function getProductUnitShortLabel(code: string) {
  return findProductUnit(code)?.shortLabel ?? code;
}

export function getPackagingLabel(code: string, customLabel?: string | null) {
  if (code === 'OUTRO' && customLabel) return customLabel;
  return packagingOptions.find((option) => option.code === code)?.label ?? customLabel ?? code;
}

export function normalizeLegacyUnit(value: string) {
  const normalized = normalizeProductName(value);
  const aliases: Record<string, string> = {
    unidade: 'un', unidades: 'un', quilograma: 'kg', quilogramas: 'kg', quilo: 'kg', quilos: 'kg',
    litro: 'l', litros: 'l', l: 'l', duzia: 'duzia', duzias: 'duzia', caixa: 'caixa', caixas: 'caixa',
    pes: 'pe', pe: 'pe', cabeca: 'cabeca', cabecas: 'cabeca', cachos: 'cacho', espigas: 'espiga',
  };
  return aliases[normalized] ?? value.toLocaleLowerCase('pt-BR');
}

export function unitSearchText(unit: ProductUnitOption) {
  return normalizeProductName([unit.label, unit.shortLabel, unit.group, ...unit.aliases].join(' '));
}
