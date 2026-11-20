import { ensureDatabase } from './bootstrap';
import { getD1 } from './index';
import { vehicleTractionsByCategory } from '@/lib/domain';
import {
  formatBrazilianPhone,
  isValidBrazilianPhone,
} from '@/lib/input-masks';
import type {
  DriverInput,
  DriverRecord,
  FleetAssignment,
  RoadRestriction,
  RoadRestrictionInput,
  Vehicle,
  VehicleInput,
  VehicleCategory,
  VehicleOperationalStatus,
  VehicleTraction,
} from '@/lib/domain';

type Row = Record<string, string | number | null>;

const activeRouteStatuses = ['CALCULADA', 'APROVADA', 'EM_ANDAMENTO', 'REVISAO_NECESSARIA'];

async function all<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  await ensureDatabase();
  const result = await getD1().prepare(sql).bind(...values).all<T>();
  return result.results ?? [];
}

export function normalizePlate(value: string) {
  return value.toLocaleUpperCase('pt-BR').replace(/[^A-Z0-9]/g, '');
}

export function formatPlate(value: string) {
  return normalizePlate(value);
}

export function validateVehicleInput(input: VehicleInput) {
  const plate = normalizePlate(input.plate);
  if (!/^[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})$/.test(plate)) {
    return 'Informe uma placa brasileira válida.';
  }
  if (!input.manufacturer?.trim() || !input.model?.trim()) {
    return 'Informe a marca e o modelo do veículo.';
  }
  const nextYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(input.modelYear) || input.modelYear < 1950 || input.modelYear > nextYear) {
    return `Informe um ano entre 1950 e ${nextYear}.`;
  }
  if (!['CAR', 'UTILITY', 'VAN', 'TRUCK'].includes(input.category)) {
    return 'Escolha uma categoria válida.';
  }
  if (!['4X2', '4X4', '6X2', '6X4', 'OTHER'].includes(input.traction)) {
    return 'Escolha uma configuração de tração válida.';
  }
  if (!vehicleTractionsByCategory[input.category].includes(input.traction)) {
    return 'A tração escolhida não é compatível com este tipo de veículo.';
  }
  if (input.category === 'TRUCK' && (!Number.isInteger(input.axleCount) || Number(input.axleCount) < 2)) {
    return 'Informe a quantidade de eixos do caminhão.';
  }
  if (!Number.isFinite(input.capacityKg) || input.capacityKg <= 0) {
    return 'Informe uma capacidade de carga em quilogramas maior que zero.';
  }
  if (!Number.isFinite(input.capacityM3) || input.capacityM3 <= 0) {
    return 'Informe um volume de carga maior que zero.';
  }
  if (!Number.isFinite(input.baseLatitude) || !Number.isFinite(input.baseLongitude)) {
    return 'Escolha a base de referência no mapa.';
  }
  if (!input.baseLabel?.trim()) return 'Informe o nome da base de referência.';
  return null;
}

export async function listVehicles(input: {
  query?: string;
  plate?: string;
  model?: string;
  driver?: string;
  category?: string;
  traction?: string;
  status?: string;
  base?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const pageSize = [10, 25, 50, 100].includes(Number(input.pageSize))
    ? Number(input.pageSize)
    : 10;
  const page = Math.max(1, Number(input.page) || 1);
  const where: string[] = [];
  const values: unknown[] = [];
  const query = input.query?.trim().toLocaleLowerCase('pt-BR');
  if (query) {
    where.push(`LOWER(v.plate || ' ' || COALESCE(v.internal_code, '') || ' ' || v.manufacturer || ' ' || v.model || ' ' || COALESCE(d.name, '') || ' ' || COALESCE(bl.name, v.base_label, '')) LIKE ?`);
    values.push(`%${query}%`);
  }
  const plate = input.plate?.replace(/[^a-zA-Z0-9]/g, '').toLocaleUpperCase('pt-BR');
  if (plate) {
    where.push(`UPPER(REPLACE(v.plate, '-', '')) LIKE ?`);
    values.push(`%${plate}%`);
  }
  const model = input.model?.trim().toLocaleLowerCase('pt-BR');
  if (model) {
    where.push('LOWER(v.model) LIKE ?');
    values.push(`%${model}%`);
  }
  const driver = input.driver?.trim().toLocaleLowerCase('pt-BR');
  if (driver) {
    where.push(`LOWER(COALESCE(d.name, '')) LIKE ?`);
    values.push(`%${driver}%`);
  }
  if (input.category) {
    where.push('v.category = ?');
    values.push(input.category);
  }
  if (input.traction) {
    where.push('v.traction = ?');
    values.push(input.traction);
  }
  if (input.status === 'INACTIVE') where.push('v.active = 0');
  if (input.status === 'MAINTENANCE') where.push(`v.active = 1 AND v.operational_status = 'MAINTENANCE'`);
  if (input.status === 'AVAILABLE') {
    where.push(`v.active = 1 AND v.operational_status = 'AVAILABLE' AND ar.id IS NULL`);
  }
  if (input.status === 'ON_ROUTE') where.push('ar.id IS NOT NULL');
  if (input.base) {
    where.push(`LOWER(COALESCE(bl.name, v.base_label, '')) LIKE ?`);
    values.push(`%${input.base.toLocaleLowerCase('pt-BR')}%`);
  }
  const predicate = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM vehicles v
    LEFT JOIN locations bl ON bl.id = v.base_location_id
    LEFT JOIN vehicle_driver_assignments f ON f.vehicle_id = v.id AND f.ended_at IS NULL
    LEFT JOIN drivers d ON d.id = f.driver_id
    LEFT JOIN route_plans ar ON ar.vehicle_id = v.id AND ar.status IN (${activeRouteStatuses.map(() => '?').join(',')})`;
  const sharedValues = [...activeRouteStatuses, ...values];
  const [items, count, activeCount] = await Promise.all([
    all<Row>(`SELECT v.*, COALESCE(bl.name, v.base_label) AS base_name,
      COALESCE(bl.latitude, v.base_latitude) AS resolved_base_latitude,
      COALESCE(bl.longitude, v.base_longitude) AS resolved_base_longitude,
      d.id AS current_driver_id, d.name AS current_driver_name, d.phone AS current_driver_phone,
      f.started_at AS assignment_started_at, ar.id AS active_route_id, ar.name AS active_route_name
      ${from} ${predicate}
      GROUP BY v.id ORDER BY v.active DESC, v.updated_at DESC, v.plate
      LIMIT ? OFFSET ?`, [...sharedValues, pageSize, (page - 1) * pageSize]),
    all<Row>(`SELECT COUNT(DISTINCT v.id) AS total ${from} ${predicate}`, sharedValues),
    all<Row>('SELECT COUNT(*) AS total FROM vehicles WHERE active = 1'),
  ]);
  return {
    items: items.map(mapVehicle),
    total: Number(count[0]?.total ?? 0),
    activeTotal: Number(activeCount[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getVehicle(id: string) {
  const result = await listVehicleRows('WHERE v.id = ?', [id]);
  return result[0] ? mapVehicle(result[0]) : null;
}

async function listVehicleRows(predicate = '', values: unknown[] = []) {
  return all<Row>(`SELECT v.*, COALESCE(bl.name, v.base_label) AS base_name,
    COALESCE(bl.latitude, v.base_latitude) AS resolved_base_latitude,
    COALESCE(bl.longitude, v.base_longitude) AS resolved_base_longitude,
    d.id AS current_driver_id, d.name AS current_driver_name, d.phone AS current_driver_phone,
    f.started_at AS assignment_started_at, ar.id AS active_route_id, ar.name AS active_route_name
    FROM vehicles v
    LEFT JOIN locations bl ON bl.id = v.base_location_id
    LEFT JOIN vehicle_driver_assignments f ON f.vehicle_id = v.id AND f.ended_at IS NULL
    LEFT JOIN drivers d ON d.id = f.driver_id
    LEFT JOIN route_plans ar ON ar.vehicle_id = v.id AND ar.status IN (${activeRouteStatuses.map(() => '?').join(',')})
    ${predicate} GROUP BY v.id`, [...activeRouteStatuses, ...values]);
}

export async function createVehicle(input: VehicleInput) {
  const validation = validateVehicleInput(input);
  if (validation) throw new FleetError(validation, 400);
  await ensureDatabase();
  const db = getD1();
  const normalizedPlate = normalizePlate(input.plate);
  const duplicate = await db.prepare('SELECT id FROM vehicles WHERE normalized_plate = ?').bind(normalizedPlate).first();
  if (duplicate) throw new FleetError('Já existe um veículo com esta placa.', 409);
  const now = new Date().toISOString();
  const id = `vehicle-${crypto.randomUUID()}`;
  let inserted = false;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
    const internalCode = await generateVehicleInternalCode(db);
    try {
      await db.prepare(`INSERT INTO vehicles (
        id, plate, normalized_plate, internal_code, manufacturer, model, model_year,
        category, traction, axle_count, capacity_kg, capacity_m3, operational_status,
        base_location_id, base_label, base_latitude, base_longitude, notes, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
        .bind(
          id, formatPlate(input.plate), normalizedPlate, internalCode, input.manufacturer.trim(),
          input.model.trim(), input.modelYear, input.category, input.traction,
          input.category === 'TRUCK' ? input.axleCount ?? null : null,
          input.capacityKg, input.capacityM3, input.operationalStatus,
          clean(input.baseLocationId), input.baseLabel.trim(), input.baseLatitude,
          input.baseLongitude, clean(input.notes), now, now,
        ).run();
      inserted = true;
    } catch (error) {
      lastError = error;
      const plateWasInserted = await db.prepare('SELECT id FROM vehicles WHERE normalized_plate = ?').bind(normalizedPlate).first();
      if (plateWasInserted) throw new FleetError('Já existe um veículo com esta placa.', 409);
    }
  }
  if (!inserted) throw lastError;
  return getVehicle(id);
}

export async function updateVehicle(id: string, input: VehicleInput) {
  const validation = validateVehicleInput(input);
  if (validation) throw new FleetError(validation, 400);
  await ensureDatabase();
  const db = getD1();
  const existing = await db.prepare('SELECT id FROM vehicles WHERE id = ?').bind(id).first();
  if (!existing) throw new FleetError('Veículo não encontrado.', 404);
  const normalizedPlate = normalizePlate(input.plate);
  const duplicate = await db.prepare('SELECT id FROM vehicles WHERE normalized_plate = ? AND id != ?').bind(normalizedPlate, id).first();
  if (duplicate) throw new FleetError('Já existe outro veículo com esta placa.', 409);
  await db.prepare(`UPDATE vehicles SET plate = ?, normalized_plate = ?,
    manufacturer = ?, model = ?, model_year = ?, category = ?, traction = ?, axle_count = ?,
    capacity_kg = ?, capacity_m3 = ?, operational_status = ?, base_location_id = ?,
    base_label = ?, base_latitude = ?, base_longitude = ?, notes = ?, updated_at = ? WHERE id = ?`)
    .bind(
      formatPlate(input.plate), normalizedPlate, input.manufacturer.trim(),
      input.model.trim(), input.modelYear, input.category, input.traction,
      input.category === 'TRUCK' ? input.axleCount ?? null : null,
      input.capacityKg, input.capacityM3, input.operationalStatus,
      clean(input.baseLocationId), input.baseLabel.trim(), input.baseLatitude,
      input.baseLongitude, clean(input.notes), new Date().toISOString(), id,
    ).run();
  return getVehicle(id);
}

async function generateVehicleInternalCode(db: D1Database) {
  const result = await db.prepare(`SELECT COALESCE(
    MAX(CASE WHEN internal_code GLOB 'V-[0-9]*' THEN CAST(SUBSTR(internal_code, 3) AS INTEGER) END),
    0
  ) + 1 AS next_code FROM vehicles`).first<{ next_code: number | string }>();
  const sequence = Number(result?.next_code ?? 1);
  return `V-${String(sequence).padStart(3, '0')}`;
}

export async function setVehicleArchived(id: string, archived: boolean) {
  await ensureDatabase();
  const db = getD1();
  const vehicle = await db.prepare('SELECT id, active FROM vehicles WHERE id = ?').bind(id).first<{ id: string; active: number }>();
  if (!vehicle) throw new FleetError('Veículo não encontrado.', 404);
  if (archived) {
    const activeRoute = await db.prepare(`SELECT id FROM route_plans WHERE vehicle_id = ? AND status IN (${activeRouteStatuses.map(() => '?').join(',')}) LIMIT 1`)
      .bind(id, ...activeRouteStatuses).first();
    if (activeRoute) throw new FleetError('Transfira ou conclua a rota antes de arquivar este veículo.', 409);
  }
  const now = new Date().toISOString();
  const statements = [
    db.prepare('UPDATE vehicles SET active = ?, updated_at = ? WHERE id = ?').bind(archived ? 0 : 1, now, id),
  ];
  if (archived) {
    statements.push(db.prepare('UPDATE vehicle_driver_assignments SET ended_at = ? WHERE vehicle_id = ? AND ended_at IS NULL').bind(now, id));
  }
  await db.batch(statements);
  return getVehicle(id);
}

export async function listFleet(input: { view?: 'current' | 'history'; query?: string; status?: string; driver?: string; driverId?: string; vehicle?: string; vehicleId?: string; base?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = [10, 25, 50].includes(Number(input.pageSize)) ? Number(input.pageSize) : 10;
  const page = Math.max(1, Number(input.page) || 1);
  const currentOnly = input.view !== 'history';
  const where = [currentOnly ? 'f.ended_at IS NULL' : '1 = 1'];
  const values: unknown[] = [...activeRouteStatuses];
  if (input.query?.trim()) {
    where.push(`LOWER(v.plate || ' ' || v.manufacturer || ' ' || v.model || ' ' || d.name || ' ' || COALESCE(r.name, '')) LIKE ?`);
    values.push(`%${input.query.trim().toLocaleLowerCase('pt-BR')}%`);
  }
  if (input.driver?.trim()) { where.push('LOWER(d.name) LIKE ?'); values.push(`%${input.driver.trim().toLocaleLowerCase('pt-BR')}%`); }
  if (input.driverId) { where.push('d.id = ?'); values.push(input.driverId); }
  if (input.vehicle?.trim()) { where.push(`LOWER(v.plate || ' ' || v.manufacturer || ' ' || v.model) LIKE ?`); values.push(`%${input.vehicle.trim().toLocaleLowerCase('pt-BR')}%`); }
  if (input.vehicleId) { where.push('v.id = ?'); values.push(input.vehicleId); }
  if (input.base?.trim()) { where.push(`LOWER(COALESCE(vb.name, v.base_label, '') || ' ' || COALESCE(db.name, d.base_label, '')) LIKE ?`); values.push(`%${input.base.trim().toLocaleLowerCase('pt-BR')}%`); }
  if (input.status === 'ON_ROUTE') where.push('r.id IS NOT NULL');
  if (input.status === 'NO_ROUTE') where.push('r.id IS NULL');
  if (input.from) { where.push('f.started_at >= ?'); values.push(`${input.from}T00:00:00.000Z`); }
  if (input.to) { where.push('f.started_at <= ?'); values.push(`${input.to}T23:59:59.999Z`); }
  const from = `FROM vehicle_driver_assignments f
    JOIN vehicles v ON v.id = f.vehicle_id
    JOIN drivers d ON d.id = f.driver_id
    LEFT JOIN locations vb ON vb.id = v.base_location_id
    LEFT JOIN locations db ON db.id = d.base_location_id
    LEFT JOIN route_plans r ON r.vehicle_id = v.id AND r.driver_id = d.id AND r.status IN (${activeRouteStatuses.map(() => '?').join(',')})`;
  const [rows, count, unassignedVehicles, unassignedDrivers] = await Promise.all([
    all<Row>(`SELECT f.*, v.plate, v.manufacturer, v.model,
      COALESCE(vb.name, v.base_label, 'Base não informada') AS vehicle_base,
      v.base_latitude AS vehicle_latitude, v.base_longitude AS vehicle_longitude,
      d.name AS driver_name, d.phone AS driver_phone,
      COALESCE(db.name, d.base_label, 'Base não informada') AS driver_base,
      d.base_latitude AS driver_latitude, d.base_longitude AS driver_longitude,
      r.id AS active_route_id, r.name AS active_route_name
      ${from} WHERE ${where.join(' AND ')} ORDER BY ${currentOnly ? 'f.started_at DESC' : 'COALESCE(f.ended_at, f.started_at) DESC'}
      LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]),
    all<Row>(`SELECT COUNT(DISTINCT f.id) AS total ${from} WHERE ${where.join(' AND ')}`, values),
    all<Row>(`SELECT COUNT(*) AS total FROM vehicles v WHERE v.active = 1 AND NOT EXISTS (
      SELECT 1 FROM vehicle_driver_assignments f WHERE f.vehicle_id = v.id AND f.ended_at IS NULL)`),
    all<Row>(`SELECT COUNT(*) AS total FROM drivers d WHERE d.active = 1 AND NOT EXISTS (
      SELECT 1 FROM vehicle_driver_assignments f WHERE f.driver_id = d.id AND f.ended_at IS NULL)`),
  ]);
  return {
    items: rows.map(mapAssignment),
    total: Number(count[0]?.total ?? 0),
    page,
    pageSize,
    unassignedVehicles: Number(unassignedVehicles[0]?.total ?? 0),
    unassignedDrivers: Number(unassignedDrivers[0]?.total ?? 0),
  };
}

export async function getFleetAssignment(id: string) {
  const rows = await all<Row>(`SELECT f.*, v.plate, v.manufacturer, v.model,
    COALESCE(vb.name, v.base_label, 'Base não informada') AS vehicle_base,
    v.base_latitude AS vehicle_latitude, v.base_longitude AS vehicle_longitude,
    d.name AS driver_name, d.phone AS driver_phone,
    COALESCE(db.name, d.base_label, 'Base não informada') AS driver_base,
    d.base_latitude AS driver_latitude, d.base_longitude AS driver_longitude,
    r.id AS active_route_id, r.name AS active_route_name
    FROM vehicle_driver_assignments f
    JOIN vehicles v ON v.id = f.vehicle_id
    JOIN drivers d ON d.id = f.driver_id
    LEFT JOIN locations vb ON vb.id = v.base_location_id
    LEFT JOIN locations db ON db.id = d.base_location_id
    LEFT JOIN route_plans r ON r.vehicle_id = v.id AND r.driver_id = d.id
      AND r.status IN (${activeRouteStatuses.map(() => '?').join(',')})
    WHERE f.id = ? GROUP BY f.id LIMIT 1`, [...activeRouteStatuses, id]);
  return rows[0] ? mapAssignment(rows[0]) : null;
}

export async function listFleetOptions(input: {
  type: 'vehicles' | 'drivers';
  query?: string;
  plate?: string;
  model?: string;
  driver?: string;
  name?: string;
  phone?: string;
  vehiclePlate?: string;
  status?: string;
  category?: string;
  base?: string;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = [10, 20, 30].includes(Number(input.pageSize)) ? Number(input.pageSize) : 10;
  const page = Math.max(1, Number(input.page) || 1);
  if (input.type === 'vehicles') {
    return listVehicles({
      query: input.query,
      plate: input.plate,
      model: input.model,
      driver: input.driver,
      category: input.category,
      status: input.status,
      base: input.base,
      page,
      pageSize,
    });
  }

  const drivers = await listDrivers({ query: input.query });
  const normalizedBase = input.base?.trim().toLocaleLowerCase('pt-BR');
  const normalizedName = input.name?.trim().toLocaleLowerCase('pt-BR');
  const normalizedPhone = input.phone?.replace(/\D/g, '');
  const normalizedVehiclePlate = input.vehiclePlate?.replace(/[^a-zA-Z0-9]/g, '').toLocaleUpperCase('pt-BR');
  const filtered = drivers.filter((driver) => {
    if (normalizedName && !driver.name.toLocaleLowerCase('pt-BR').includes(normalizedName)) return false;
    if (normalizedPhone && !driver.phone?.replace(/\D/g, '').includes(normalizedPhone)) return false;
    if (normalizedVehiclePlate && !driver.currentVehiclePlate?.replace(/[^a-zA-Z0-9]/g, '').toLocaleUpperCase('pt-BR').includes(normalizedVehiclePlate)) return false;
    if (normalizedBase && !driver.baseName?.toLocaleLowerCase('pt-BR').includes(normalizedBase)) return false;
    if (input.status === 'AVAILABLE') return driver.active && !driver.activeRouteId;
    if (input.status === 'ON_ROUTE') return Boolean(driver.activeRouteId);
    if (input.status === 'INACTIVE') return !driver.active;
    return true;
  });
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export async function assignFleet(input: { vehicleId: string; driverId: string; notes?: string }) {
  await ensureDatabase();
  const db = getD1();
  const [vehicle, driver] = await Promise.all([
    db.prepare('SELECT id, active, operational_status FROM vehicles WHERE id = ?').bind(input.vehicleId).first<{ id: string; active: number; operational_status: string }>(),
    db.prepare('SELECT id, active FROM drivers WHERE id = ?').bind(input.driverId).first<{ id: string; active: number }>(),
  ]);
  if (!vehicle || !vehicle.active) throw new FleetError('O veículo está inativo ou não existe.', 400);
  if (vehicle.operational_status === 'MAINTENANCE') throw new FleetError('O veículo está em manutenção.', 400);
  if (!driver || !driver.active) throw new FleetError('O motorista está inativo ou não existe.', 400);
  const activeConflict = await db.prepare(`SELECT id FROM route_plans WHERE status IN (${activeRouteStatuses.map(() => '?').join(',')})
    AND (vehicle_id = ? OR driver_id = ?) LIMIT 1`).bind(...activeRouteStatuses, input.vehicleId, input.driverId).first();
  if (activeConflict) throw new FleetError('Existe uma rota ativa. Use “Transferir responsabilidade” para fazer esta troca.', 409);
  const current = await db.prepare('SELECT id, vehicle_id, driver_id FROM vehicle_driver_assignments WHERE ended_at IS NULL AND vehicle_id = ? AND driver_id = ?')
    .bind(input.vehicleId, input.driverId).first();
  if (current) return { id: String(current.id), unchanged: true };
  const now = new Date().toISOString();
  const id = `fleet-${crypto.randomUUID()}`;
  try {
    await db.batch([
      db.prepare('UPDATE vehicle_driver_assignments SET ended_at = ? WHERE ended_at IS NULL AND (vehicle_id = ? OR driver_id = ?)').bind(now, input.vehicleId, input.driverId),
      db.prepare('INSERT INTO vehicle_driver_assignments VALUES (?, ?, ?, ?, NULL, ?, ?)').bind(id, input.vehicleId, input.driverId, now, 'GESTOR', clean(input.notes)),
      db.prepare(`INSERT INTO audit_events VALUES (?, 'FROTA', ?, 'VINCULO_ATUALIZADO', 'GESTOR', ?, ?)`).bind(crypto.randomUUID(), id, JSON.stringify(input), now),
    ]);
  } catch (error) {
    throw new FleetError('A frota mudou enquanto você confirmava. Atualize a página e tente novamente.', 409, error);
  }
  return { id, unchanged: false };
}

export async function unassignFleet(id: string) {
  await ensureDatabase();
  const db = getD1();
  const assignment = await db.prepare('SELECT vehicle_id, driver_id FROM vehicle_driver_assignments WHERE id = ? AND ended_at IS NULL').bind(id).first<{ vehicle_id: string; driver_id: string }>();
  if (!assignment) throw new FleetError('Este vínculo já foi encerrado.', 409);
  const activeRoute = await db.prepare(`SELECT id FROM route_plans WHERE status IN (${activeRouteStatuses.map(() => '?').join(',')})
    AND vehicle_id = ? AND driver_id = ? LIMIT 1`).bind(...activeRouteStatuses, assignment.vehicle_id, assignment.driver_id).first();
  if (activeRoute) throw new FleetError('Transfira ou conclua a rota antes de desvincular.', 409);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE vehicle_driver_assignments SET ended_at = ? WHERE id = ? AND ended_at IS NULL').bind(now, id),
    db.prepare(`INSERT INTO audit_events VALUES (?, 'FROTA', ?, 'VINCULO_ENCERRADO', 'GESTOR', NULL, ?)`).bind(crypto.randomUUID(), id, now),
  ]);
  return { ok: true };
}

export async function transferRouteResponsibility(input: { routeId: string; vehicleId: string; driverId: string; notes?: string }) {
  await ensureDatabase();
  const db = getD1();
  const route = await db.prepare(`SELECT id, status, vehicle_id, driver_id FROM route_plans WHERE id = ?`).bind(input.routeId).first<Row>();
  if (!route) throw new FleetError('Rota não encontrada.', 404);
  if (!activeRouteStatuses.includes(String(route.status))) throw new FleetError('Esta rota não está mais ativa.', 409);
  const [vehicle, driver] = await Promise.all([
    db.prepare('SELECT active, operational_status FROM vehicles WHERE id = ?').bind(input.vehicleId).first<Row>(),
    db.prepare('SELECT active FROM drivers WHERE id = ?').bind(input.driverId).first<Row>(),
  ]);
  if (!vehicle || Number(vehicle.active) !== 1) throw new FleetError('O veículo escolhido está inativo.', 400);
  if (vehicle.operational_status === 'MAINTENANCE') throw new FleetError('O veículo escolhido está em manutenção.', 400);
  if (!driver || Number(driver.active) !== 1) throw new FleetError('O motorista escolhido está inativo.', 400);
  const otherRoute = await db.prepare(`SELECT id FROM route_plans WHERE id != ? AND status IN (${activeRouteStatuses.map(() => '?').join(',')})
    AND (vehicle_id = ? OR driver_id = ?) LIMIT 1`).bind(input.routeId, ...activeRouteStatuses, input.vehicleId, input.driverId).first();
  if (otherRoute) throw new FleetError('O motorista ou o veículo já está executando outra rota.', 409);
  const now = new Date().toISOString();
  const responsibilityId = `responsibility-${crypto.randomUUID()}`;
  const fleetId = `fleet-${crypto.randomUUID()}`;
  await db.batch([
    db.prepare('UPDATE route_responsibility_periods SET ended_at = ? WHERE route_plan_id = ? AND ended_at IS NULL').bind(now, input.routeId),
    db.prepare('UPDATE vehicle_driver_assignments SET ended_at = ? WHERE ended_at IS NULL AND (vehicle_id = ? OR driver_id = ?)').bind(now, input.vehicleId, input.driverId),
    db.prepare('INSERT INTO vehicle_driver_assignments VALUES (?, ?, ?, ?, NULL, ?, ?)').bind(fleetId, input.vehicleId, input.driverId, now, 'GESTOR', clean(input.notes)),
    db.prepare('INSERT INTO route_responsibility_periods VALUES (?, ?, ?, ?, ?, NULL, ?, ?)').bind(responsibilityId, input.routeId, input.vehicleId, input.driverId, now, 'GESTOR', clean(input.notes)),
    db.prepare('UPDATE route_plans SET vehicle_id = ?, driver_id = ? WHERE id = ?').bind(input.vehicleId, input.driverId, input.routeId),
    db.prepare(`INSERT INTO audit_events VALUES (?, 'ROTA', ?, 'RESPONSABILIDADE_TRANSFERIDA', 'GESTOR', ?, ?)`).bind(crypto.randomUUID(), input.routeId, JSON.stringify({ vehicleId: input.vehicleId, driverId: input.driverId, notes: clean(input.notes) }), now),
  ]);
  return { ok: true, responsibilityId };
}

export async function listReferenceLocations() {
  return all<Row>(`SELECT id, name, address, latitude, longitude FROM locations WHERE active = 1 ORDER BY name`);
}

export async function listRoadRestrictions(query = '') {
  const values: unknown[] = [];
  const predicate = query.trim() ? `WHERE LOWER(name || ' ' || COALESCE(reference, '') || ' ' || COALESCE(notes, '')) LIKE ?` : '';
  if (predicate) values.push(`%${query.trim().toLocaleLowerCase('pt-BR')}%`);
  const rows = await all<Row>(`SELECT * FROM road_blocks ${predicate} ORDER BY active DESC, updated_at DESC`, values);
  return rows.map(mapRoadRestriction);
}

export async function getRoadRestriction(id: string) {
  const rows = await all<Row>('SELECT * FROM road_blocks WHERE id = ?', [id]);
  return rows[0] ? mapRoadRestriction(rows[0]) : null;
}

export async function saveRoadRestriction(id: string | null, input: RoadRestrictionInput) {
  if (!input.name?.trim()) throw new FleetError('Informe o nome da via ou do trecho.', 400);
  if (!hasValidRoadSegment(input.geometry)) {
    throw new FleetError('Marque um ponto inicial e um ponto final diferentes no mapa.', 400);
  }
  if (input.restrictionMode === 'REQUIREMENTS' && !input.requiredTraction && !input.maximumVehicleCategory && !input.maximumAxles) {
    throw new FleetError('Informe ao menos uma condição para a passagem.', 400);
  }
  await ensureDatabase();
  const db = getD1();
  const now = new Date().toISOString();
  const roadId = id ?? `road-${crypto.randomUUID()}`;
  const values = [
    input.name.trim(), clean(input.reference), clean(input.notes), input.geometry,
    input.restrictionMode, input.restrictionMode === 'REQUIREMENTS' ? clean(input.requiredTraction) : null,
    input.restrictionMode === 'REQUIREMENTS' ? clean(input.maximumVehicleCategory) : null,
    input.restrictionMode === 'REQUIREMENTS' ? input.maximumAxles ?? null : null,
    input.active ? 1 : 0, now,
  ];
  if (id) {
    const current = await db.prepare('SELECT id FROM road_blocks WHERE id = ?').bind(id).first();
    if (!current) throw new FleetError('Via não encontrada.', 404);
    await db.prepare(`UPDATE road_blocks SET name = ?, reference = ?, notes = ?, geometry = ?, restriction_mode = ?, required_traction = ?, maximum_vehicle_category = ?, maximum_axles = ?, active = ?, updated_at = ? WHERE id = ?`).bind(...values, id).run();
  } else {
    await db.prepare(`INSERT INTO road_blocks (id,name,reference,notes,geometry,restriction_mode,required_traction,maximum_vehicle_category,maximum_axles,active,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(roadId, ...values).run();
  }
  return getRoadRestriction(roadId);
}

function hasValidRoadSegment(geometry: string) {
  try {
    const parsed = JSON.parse(geometry) as unknown;
    if (!Array.isArray(parsed) || !Array.isArray(parsed[0]) || parsed[0].length < 2) return false;
    const points = parsed[0] as unknown[];
    const valid = points.every((point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number' &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      point[0] >= -180 && point[0] <= 180 &&
      point[1] >= -90 && point[1] <= 90,
    );
    if (!valid) return false;
    const first = points[0] as number[];
    const last = points[points.length - 1] as number[];
    return first[0] !== last[0] || first[1] !== last[1];
  } catch {
    return false;
  }
}

export async function listDrivers(input: { query?: string; status?: string } = {}) {
  const where: string[] = [];
  const values: unknown[] = [...activeRouteStatuses];
  if (input.query?.trim()) {
    where.push(`LOWER(d.name || ' ' || COALESCE(d.phone, '') || ' ' || COALESCE(bl.name, d.base_label, '') || ' ' || COALESCE(v.plate, '')) LIKE ?`);
    values.push(`%${input.query.trim().toLocaleLowerCase('pt-BR')}%`);
  }
  if (input.status === 'ACTIVE') where.push('d.active = 1');
  if (input.status === 'INACTIVE') where.push('d.active = 0');
  const predicate = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await all<Row>(`SELECT d.*,
    COALESCE(bl.name, d.base_label) AS base_name,
    COALESCE(bl.latitude, d.base_latitude) AS resolved_base_latitude,
    COALESCE(bl.longitude, d.base_longitude) AS resolved_base_longitude,
    v.id AS current_vehicle_id, v.plate AS current_vehicle_plate,
    CASE WHEN v.id IS NULL THEN NULL ELSE v.manufacturer || ' ' || v.model END AS current_vehicle_label,
    r.id AS active_route_id, r.name AS active_route_name
    FROM drivers d LEFT JOIN locations bl ON bl.id = d.base_location_id
    LEFT JOIN vehicle_driver_assignments f ON f.driver_id = d.id AND f.ended_at IS NULL
    LEFT JOIN vehicles v ON v.id = f.vehicle_id
    LEFT JOIN route_plans r ON r.driver_id = d.id AND r.status IN (${activeRouteStatuses.map(() => '?').join(',')})
    ${predicate} GROUP BY d.id ORDER BY d.active DESC, d.name`, values);
  return rows.map(mapDriverRecord);
}

export async function getDriver(id: string) {
  const rows = await listDrivers();
  return rows.find((driver) => driver.id === id) ?? null;
}

export async function createDriver(input: DriverInput) {
  validateDriverInput(input);
  await ensureDatabase();
  const id = `driver-${crypto.randomUUID()}`;
  await getD1().prepare(`INSERT INTO drivers (
    id, name, phone, base_location_id, base_label, base_latitude, base_longitude, active
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.name.trim(), formatBrazilianPhone(input.phone), clean(input.baseLocationId), input.baseLabel.trim(), input.baseLatitude, input.baseLongitude, input.active === false ? 0 : 1)
    .run();
  return getDriver(id);
}

export async function updateDriver(id: string, input: DriverInput) {
  validateDriverInput(input);
  await ensureDatabase();
  const db = getD1();
  const current = await db.prepare('SELECT id FROM drivers WHERE id = ?').bind(id).first();
  if (!current) throw new FleetError('Motorista não encontrado.', 404);
  if (input.active === false) {
    const activeRoute = await db.prepare(`SELECT id FROM route_plans WHERE driver_id = ? AND status IN (${activeRouteStatuses.map(() => '?').join(',')}) LIMIT 1`).bind(id, ...activeRouteStatuses).first();
    if (activeRoute) throw new FleetError('Transfira ou conclua a rota antes de inativar este motorista.', 409);
  }
  const now = new Date().toISOString();
  const statements = [db.prepare(`UPDATE drivers SET name = ?, phone = ?, base_location_id = ?, base_label = ?, base_latitude = ?, base_longitude = ?, active = ? WHERE id = ?`)
    .bind(input.name.trim(), formatBrazilianPhone(input.phone), clean(input.baseLocationId), input.baseLabel.trim(), input.baseLatitude, input.baseLongitude, input.active === false ? 0 : 1, id)];
  if (input.active === false) statements.push(db.prepare('UPDATE vehicle_driver_assignments SET ended_at = ? WHERE driver_id = ? AND ended_at IS NULL').bind(now, id));
  await db.batch(statements);
  return getDriver(id);
}

function validateDriverInput(input: DriverInput) {
  if (!input.name?.trim()) throw new FleetError('Informe o nome do motorista.', 400);
  if (!input.phone?.trim()) throw new FleetError('Informe o telefone do motorista.', 400);
  if (!isValidBrazilianPhone(input.phone)) throw new FleetError('Informe um telefone com DDD e 10 ou 11 dígitos.', 400);
  if (!input.baseLabel?.trim() || !Number.isFinite(input.baseLatitude) || !Number.isFinite(input.baseLongitude)) {
    throw new FleetError('Escolha uma base de referência no mapa.', 400);
  }
}

function mapVehicle(row: Row): Vehicle {
  return {
    id: String(row.id), plate: String(row.plate), normalizedPlate: String(row.normalized_plate),
    internalCode: nullableString(row.internal_code), manufacturer: String(row.manufacturer), model: String(row.model),
    modelYear: Number(row.model_year), category: String(row.category) as VehicleCategory,
    traction: String(row.traction) as VehicleTraction, axleCount: nullableNumber(row.axle_count),
    capacityKg: Number(row.capacity_kg), capacityM3: Number(row.capacity_m3),
    operationalStatus: String(row.operational_status) as VehicleOperationalStatus,
    baseLocationId: nullableString(row.base_location_id), baseName: nullableString(row.base_name ?? row.base_label),
    baseLatitude: nullableNumber(row.resolved_base_latitude ?? row.base_latitude), baseLongitude: nullableNumber(row.resolved_base_longitude ?? row.base_longitude),
    notes: nullableString(row.notes), active: Boolean(row.active), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    currentDriverId: nullableString(row.current_driver_id), currentDriverName: nullableString(row.current_driver_name),
    currentDriverPhone: nullableString(row.current_driver_phone), assignmentStartedAt: nullableString(row.assignment_started_at),
    activeRouteId: nullableString(row.active_route_id), activeRouteName: nullableString(row.active_route_name),
  };
}

function mapDriverRecord(row: Row): DriverRecord {
  return {
    id: String(row.id), name: String(row.name), phone: nullableString(row.phone),
    baseLocationId: nullableString(row.base_location_id), baseName: nullableString(row.base_name ?? row.base_label),
    baseLatitude: nullableNumber(row.resolved_base_latitude ?? row.base_latitude),
    baseLongitude: nullableNumber(row.resolved_base_longitude ?? row.base_longitude),
    active: Boolean(row.active), currentVehicleId: nullableString(row.current_vehicle_id),
    currentVehicleLabel: nullableString(row.current_vehicle_label), currentVehiclePlate: nullableString(row.current_vehicle_plate),
    activeRouteId: nullableString(row.active_route_id), activeRouteName: nullableString(row.active_route_name),
  };
}

function mapAssignment(row: Row): FleetAssignment {
  const vehicleLat = nullableNumber(row.vehicle_latitude);
  const vehicleLng = nullableNumber(row.vehicle_longitude);
  const driverLat = nullableNumber(row.driver_latitude);
  const driverLng = nullableNumber(row.driver_longitude);
  return {
    id: String(row.id), vehicleId: String(row.vehicle_id),
    vehicleLabel: `${row.manufacturer} ${row.model}`, vehiclePlate: String(row.plate), vehicleBase: String(row.vehicle_base),
    driverId: String(row.driver_id), driverName: String(row.driver_name), driverPhone: nullableString(row.driver_phone),
    driverBase: String(row.driver_base), distanceKm: vehicleLat != null && vehicleLng != null && driverLat != null && driverLng != null
      ? Math.round(haversine(vehicleLat, vehicleLng, driverLat, driverLng) * 10) / 10 : null,
    startedAt: String(row.started_at), endedAt: nullableString(row.ended_at),
    activeRouteId: nullableString(row.active_route_id), activeRouteName: nullableString(row.active_route_name),
  };
}

function mapRoadRestriction(row: Row): RoadRestriction {
  return {
    id: String(row.id), name: String(row.name), reference: nullableString(row.reference), notes: nullableString(row.notes),
    geometry: String(row.geometry), restrictionMode: String(row.restriction_mode) as RoadRestriction['restrictionMode'],
    requiredTraction: nullableString(row.required_traction) as RoadRestriction['requiredTraction'],
    maximumVehicleCategory: nullableString(row.maximum_vehicle_category) as RoadRestriction['maximumVehicleCategory'],
    maximumAxles: nullableNumber(row.maximum_axles), active: Boolean(row.active), updatedAt: String(row.updated_at),
  };
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nullableString(value: unknown) {
  if (value == null || value === '') return null;
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : null;
}

function nullableNumber(value: unknown) {
  return value == null || value === '' ? null : Number(value);
}

function clean(value: unknown) {
  const result =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value).trim()
      : '';
  return result || null;
}

export class FleetError extends Error {
  status: number;
  cause?: unknown;

  constructor(message: string, status = 500, cause?: unknown) {
    super(message);
    this.status = status;
    this.cause = cause;
  }
}
