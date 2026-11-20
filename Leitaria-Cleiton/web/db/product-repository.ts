import { ensureDatabase } from './bootstrap';
import { getD1 } from './index';
import type { Product, ProductInput } from '@/lib/domain';
import {
  getPackagingLabel,
  normalizeLegacyUnit,
  normalizeProductName,
  packagingOptions,
  productUnits,
} from '@/lib/product-catalog';

type Row = Record<string, string | number | null>;

export class ProductError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function listProducts(input: {
  query?: string;
  status?: string;
  unit?: string;
  packaging?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  await ensureDatabase();
  const pageSize = [10, 25, 50].includes(Number(input.pageSize)) ? Number(input.pageSize) : 25;
  const page = Math.max(1, Number(input.page) || 1);
  const where: string[] = [];
  const values: unknown[] = [];
  const query = normalizeProductName(input.query ?? '');
  if (query) {
    where.push('p.normalized_name LIKE ?');
    values.push(`%${query}%`);
  }
  if (input.status === 'ACTIVE') where.push('p.active = 1');
  if (input.status === 'INACTIVE') where.push('p.active = 0');
  if (input.unit) {
    where.push('p.unit = ?');
    values.push(input.unit);
  }
  if (input.packaging) {
    where.push('p.packaging_code = ?');
    values.push(input.packaging);
  }
  const predicate = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const db = getD1();
  const [items, count] = await Promise.all([
    db.prepare(`${productSelect} ${predicate} ORDER BY p.active DESC, p.normalized_name
      LIMIT ? OFFSET ?`).bind(...values, pageSize, (page - 1) * pageSize).all<Row>(),
    db.prepare(`SELECT COUNT(*) AS total FROM products p ${predicate}`).bind(...values).all<Row>(),
  ]);
  return {
    items: (items.results ?? []).map(mapProduct),
    total: Number(count.results?.[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getProduct(id: string) {
  await ensureDatabase();
  const result = await getD1().prepare(`${productSelect} WHERE p.id = ? LIMIT 1`).bind(id).all<Row>();
  return result.results?.[0] ? mapProduct(result.results[0]) : null;
}

export async function createProduct(input: ProductInput) {
  const clean = validateProduct(input);
  await ensureDatabase();
  const db = getD1();
  const duplicate = await db.prepare('SELECT id FROM products WHERE normalized_name = ? LIMIT 1')
    .bind(clean.normalizedName).first<{ id: string }>();
  if (duplicate) throw new ProductError('Já existe um produto com este nome.', 409);
  const id = `product-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  try {
    await db.prepare(`INSERT INTO products (
      id,name,normalized_name,unit,category,packaging_code,packaging_label,
      package_content_quantity,average_unit_weight_kg,perishable,active,created_at,updated_at
    ) VALUES (?, ?, ?, ?, 'ALIMENTO', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id, clean.name, clean.normalizedName, clean.unit, clean.packagingCode,
        clean.packagingLabel, clean.packageContentQuantity, clean.averageUnitWeightKg,
        Number(clean.perishable), Number(clean.active), now, now,
      ).run();
  } catch (error) {
    if (String(error).toLocaleLowerCase('pt-BR').includes('unique')) {
      throw new ProductError('Já existe um produto com este nome.', 409);
    }
    throw error;
  }
  return getProduct(id);
}

export async function updateProduct(id: string, input: ProductInput) {
  const clean = validateProduct(input);
  const current = await getProduct(id);
  if (!current) throw new ProductError('Produto não encontrado.', 404);
  if (current.referenced && current.unit !== clean.unit) {
    throw new ProductError('A unidade não pode ser alterada porque este produto já foi usado na operação.', 409);
  }
  const duplicate = await getD1().prepare('SELECT id FROM products WHERE normalized_name = ? AND id <> ? LIMIT 1')
    .bind(clean.normalizedName, id).first<{ id: string }>();
  if (duplicate) throw new ProductError('Já existe um produto com este nome.', 409);
  const now = new Date().toISOString();
  try {
    await getD1().prepare(`UPDATE products SET name = ?, normalized_name = ?, unit = ?,
      packaging_code = ?, packaging_label = ?, package_content_quantity = ?,
      average_unit_weight_kg = ?, perishable = ?, active = ?, updated_at = ? WHERE id = ?`)
      .bind(
        clean.name, clean.normalizedName, clean.unit, clean.packagingCode,
        clean.packagingLabel, clean.packageContentQuantity, clean.averageUnitWeightKg,
        Number(clean.perishable), Number(clean.active), now, id,
      ).run();
  } catch (error) {
    if (String(error).toLocaleLowerCase('pt-BR').includes('unique')) {
      throw new ProductError('Já existe um produto com este nome.', 409);
    }
    throw error;
  }
  return getProduct(id);
}

export async function setProductArchived(id: string, archived: boolean) {
  await ensureDatabase();
  const current = await getProduct(id);
  if (!current) throw new ProductError('Produto não encontrado.', 404);
  await getD1().prepare('UPDATE products SET active = ?, updated_at = ? WHERE id = ?')
    .bind(Number(!archived), new Date().toISOString(), id).run();
  return getProduct(id);
}

export async function findSimilarProducts(name: string, excludeId?: string) {
  await ensureDatabase();
  const normalized = normalizeProductName(name);
  if (normalized.length < 2) return [];
  const result = await getD1().prepare(`SELECT id,name,normalized_name,unit,packaging_code,
    packaging_label,active FROM products WHERE id <> ? ORDER BY active DESC, normalized_name`)
    .bind(excludeId ?? '').all<Row>();
  return (result.results ?? [])
    .map((row) => {
      const candidate = String(row.normalized_name);
      const exact = candidate === normalized;
      const containment = normalized.length >= 4 && candidate.length >= 4 &&
        (candidate.includes(normalized) || normalized.includes(candidate));
      const similarity = exact ? 1 : diceCoefficient(normalized, candidate);
      return {
        id: String(row.id),
        name: String(row.name),
        unit: String(row.unit),
        packaging: getPackagingLabel(String(row.packaging_code), nullableString(row.packaging_label)),
        active: Boolean(row.active),
        exact,
        similarity,
        match: exact || containment || similarity >= 0.68,
      };
    })
    .filter((candidate) => candidate.match)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.similarity - a.similarity)
    .slice(0, 5)
    .map(({ match: _match, ...candidate }) => candidate);
}

function validateProduct(input: ProductInput) {
  const name = input.name?.trim().replace(/\s+/g, ' ');
  if (!name || name.length < 2) throw new ProductError('Informe o nome do produto.');
  const normalizedName = normalizeProductName(name);
  const unit = normalizeLegacyUnit(input.unit ?? '');
  if (!productUnits.some((option) => option.code === unit)) throw new ProductError('Escolha uma unidade de medida válida.');
  if (!packagingOptions.some((option) => option.code === input.packagingCode)) throw new ProductError('Escolha um tipo de embalagem válido.');
  const packagingLabel = input.packagingCode === 'OUTRO' ? input.packagingLabel?.trim() || null : null;
  if (input.packagingCode === 'OUTRO' && !packagingLabel) throw new ProductError('Informe o nome da embalagem.');
  const packageContentQuantity = Number(input.packageContentQuantity);
  if (!Number.isFinite(packageContentQuantity) || packageContentQuantity <= 0) {
    throw new ProductError('Informe quanto produto cabe em cada embalagem.');
  }
  const averageUnitWeightKg = Number(input.averageUnitWeightKg);
  if (!Number.isFinite(averageUnitWeightKg) || averageUnitWeightKg <= 0) {
    throw new ProductError('Informe o peso médio do produto.');
  }
  return {
    name,
    normalizedName,
    unit,
    packagingCode: input.packagingCode,
    packagingLabel,
    packageContentQuantity,
    averageUnitWeightKg,
    perishable: Boolean(input.perishable),
    active: Boolean(input.active),
  };
}

function mapProduct(row: Row): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    normalizedName: String(row.normalized_name),
    unit: String(row.unit),
    packagingCode: String(row.packaging_code),
    packagingLabel: nullableString(row.packaging_label),
    packageContentQuantity: Number(row.package_content_quantity),
    averageUnitWeightKg: Number(row.average_unit_weight_kg),
    perishable: Boolean(row.perishable),
    active: Boolean(row.active),
    referenced: Boolean(row.referenced),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function nullableString(value: string | number | null) {
  return value == null || value === '' ? null : String(value);
}

function diceCoefficient(left: string, right: string) {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  let matches = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const count = pairs.get(pair) ?? 0;
    if (count > 0) {
      matches += 1;
      pairs.set(pair, count - 1);
    }
  }
  return (2 * matches) / (left.length + right.length - 2);
}

const productSelect = `SELECT p.*,
  CASE WHEN EXISTS(SELECT 1 FROM stock_balances s WHERE s.product_id = p.id)
    OR EXISTS(SELECT 1 FROM supply_offers o WHERE o.product_id = p.id)
    OR EXISTS(SELECT 1 FROM demand_items d WHERE d.product_id = p.id OR d.substituted_product_id = p.id)
    OR EXISTS(SELECT 1 FROM product_substitutions ps WHERE ps.original_product_id = p.id OR ps.substitute_product_id = p.id)
  THEN 1 ELSE 0 END AS referenced
  FROM products p`;
