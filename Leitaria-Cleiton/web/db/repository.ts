import { ensureDatabase } from './bootstrap';
import { getD1 } from './index';
import { calculateRouteProposals } from '@/lib/route-engine';
import { listRoadRestrictions, listVehicles } from './fleet-repository';
import type {
  DemandInput,
  DemandSummary,
  Driver,
  Location,
  PlanningData,
  Product,
  RouteProposal,
  StockBalance,
  Substitution,
  SupplyOffer,
} from '@/lib/domain';

type Row = Record<string, string | number | null>;

async function all<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  await ensureDatabase();
  const statement = getD1().prepare(sql).bind(...values);
  const result = await statement.all<T>();
  return result.results ?? [];
}

export async function getPlanningData(): Promise<PlanningData> {
  const [productRows, destinations, locations, stocks, offers, drivers, substitutions, config, vehicleResult, roadRestrictions] =
    await Promise.all([
      all<Row>(`SELECT id, name, normalized_name, unit, packaging_code, packaging_label,
        package_content_quantity, average_unit_weight_kg, perishable, active,
        created_at, updated_at FROM products WHERE active = 1 ORDER BY name`),
      all<Location>(`SELECT id, type, name, address, latitude, longitude FROM locations WHERE type = 'DESTINO' AND active = 1 ORDER BY name`),
      all<Location>(`SELECT id, type, name, address, latitude, longitude FROM locations WHERE active = 1 ORDER BY name`),
      all<Row>(`SELECT s.id, s.location_id, l.name AS location_name, s.product_id,
        p.name AS product_name, p.unit, s.quantity, s.updated_at
        FROM stock_balances s JOIN products p ON p.id = s.product_id
        JOIN locations l ON l.id = s.location_id ORDER BY p.name`),
      all<Row>(`SELECT o.id, o.location_id, l.name AS location_name, o.product_id,
        p.name AS product_name, p.unit, o.quantity, o.status, o.available_on, o.updated_at
        FROM supply_offers o JOIN products p ON p.id = o.product_id
        JOIN locations l ON l.id = o.location_id ORDER BY l.name, p.name`),
      all<Row>(`SELECT d.id, d.name, d.phone, d.base_location_id,
        COALESCE(l.name, d.base_label) AS base_name,
        COALESCE(l.latitude, d.base_latitude) AS base_latitude,
        COALESCE(l.longitude, d.base_longitude) AS base_longitude
        FROM drivers d LEFT JOIN locations l ON l.id = d.base_location_id
        WHERE d.active = 1 ORDER BY d.name`),
      all<Row>(`SELECT s.original_product_id, s.substitute_product_id,
        p.name AS substitute_name, p.unit AS substitute_unit,
        s.quantity_factor, s.priority
        FROM product_substitutions s JOIN products p ON p.id = s.substitute_product_id
        WHERE s.active = 1 ORDER BY s.priority`),
      all<Row>(`SELECT cost_per_kilometer, cost_per_hour, fixed_trip_cost
        FROM route_cost_config WHERE id = 'default' LIMIT 1`),
      listVehicles({ pageSize: 100 }),
      listRoadRestrictions(),
    ]);

  return {
    products: productRows.map(mapPlanningProduct),
    destinations,
    locations,
    stocks: stocks.map(mapStock),
    offers: offers.map(mapOffer),
    drivers: drivers.map(mapDriver),
    vehicles: vehicleResult.items,
    roadRestrictions,
    substitutions: substitutions.map(mapSubstitution),
    costConfig: {
      costPerKilometer: Number(config[0]?.cost_per_kilometer ?? 2.85),
      costPerHour: Number(config[0]?.cost_per_hour ?? 24),
      fixedTripCost: Number(config[0]?.fixed_trip_cost ?? 35),
    },
  };
}

export async function listDemands(): Promise<DemandSummary[]> {
  const rows = await all<Row>(`SELECT d.id, l.name AS destination_name, d.delivery_date,
    d.deadline, d.status, COUNT(i.id) AS item_count
    FROM demands d JOIN locations l ON l.id = d.destination_location_id
    LEFT JOIN demand_items i ON i.demand_id = d.id
    GROUP BY d.id, l.name, d.delivery_date, d.deadline, d.status
    ORDER BY d.delivery_date, d.deadline`);
  return rows.map((row) => ({
    id: String(row.id),
    destinationName: String(row.destination_name),
    deliveryDate: String(row.delivery_date),
    deadline: String(row.deadline),
    status: String(row.status),
    itemCount: Number(row.item_count),
  }));
}

export async function getProducerOffers(locationId = 'loc-boa-vista') {
  const data = await getPlanningData();
  return data.offers.filter((offer) => offer.locationId === locationId);
}

export async function updateProducerOffer(input: {
  id: string;
  status: 'CONFIRMADA' | 'ALTERADA' | 'CANCELADA';
  quantity?: number;
}) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const db = getD1();
  const current = await db
    .prepare(`SELECT id, product_id, quantity FROM supply_offers WHERE id = ?`)
    .bind(input.id)
    .first<{ id: string; product_id: string; quantity: number }>();
  if (!current) throw new Error('Oferta não encontrada.');

  const quantity =
    input.status === 'CANCELADA'
      ? 0
      : Math.max(0, Number(input.quantity ?? current.quantity));
  const status = quantity === 0 ? 'CANCELADA' : input.status;
  const eventId = crypto.randomUUID();
  const statements = [
    db
      .prepare(`UPDATE supply_offers SET quantity = ?, status = ?, updated_at = ? WHERE id = ?`)
      .bind(quantity, status, now, input.id),
    db
      .prepare(`INSERT INTO audit_events VALUES (?, 'OFERTA', ?, 'OFERTA_ATUALIZADA', 'PRODUTOR', ?, ?)`)
      .bind(
        eventId,
        input.id,
        JSON.stringify({ before: current.quantity, after: quantity, status }),
        now,
      ),
  ];

  if (quantity < current.quantity || status === 'CANCELADA') {
    statements.push(
      db
        .prepare(`UPDATE route_plans SET status = 'REVISAO_NECESSARIA'
          WHERE status IN ('CALCULADA', 'APROVADA', 'EM_ANDAMENTO')
          AND demand_id IN (SELECT demand_id FROM demand_items WHERE product_id = ?)`)
        .bind(current.product_id),
    );
  }
  await db.batch(statements);
  return { id: input.id, quantity, status };
}

export async function previewDemand(input: DemandInput) {
  const data = await getPlanningData();
  return calculateRouteProposals(input, data);
}

export async function createDemandWithRoute(input: {
  demand: DemandInput;
  proposal: RouteProposal;
  driverId: string;
  vehicleId: string;
}) {
  await ensureDatabase();
  const db = getD1();
  const now = new Date().toISOString();
  const demandId = `demand-${crypto.randomUUID()}`;
  const routeId = `route-${crypto.randomUUID()}`;
  const routeName = `Rota ${input.proposal.name}`;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(`INSERT INTO demands VALUES (?, ?, ?, ?, 'PLANEJADA', ?)`)
      .bind(
        demandId,
        input.demand.destinationId,
        input.demand.deliveryDate,
        input.demand.deadline,
        now,
      ),
  ];

  const assignment = await db.prepare(`SELECT f.id FROM vehicle_driver_assignments f
    JOIN vehicles v ON v.id = f.vehicle_id
    JOIN drivers d ON d.id = f.driver_id
    WHERE f.vehicle_id = ? AND f.driver_id = ? AND f.ended_at IS NULL
      AND v.active = 1 AND v.operational_status = 'AVAILABLE' AND d.active = 1`)
    .bind(input.vehicleId, input.driverId)
    .first();
  if (!assignment) {
    throw new Error('O veículo e o motorista precisam estar vinculados e disponíveis.');
  }
  const freshProposal = (await previewDemand(input.demand)).find(
    (proposal) => proposal.id === input.proposal.id,
  );
  const fleetOption = freshProposal?.fleetSuggestions.find(
    (option) => option.vehicleId === input.vehicleId && option.driverId === input.driverId,
  );
  if (!fleetOption?.compatible) {
    throw new Error(
      fleetOption?.reasons[0] ??
        'Este motorista e este veículo não podem assumir a rota neste momento.',
    );
  }
  if (!freshProposal) throw new Error('A proposta de rota não está mais disponível.');
  const approvedProposal = freshProposal;

  for (const item of input.demand.items.filter((candidate) => candidate.quantity > 0)) {
    statements.push(
      db
        .prepare(`INSERT INTO demand_items VALUES (?, ?, ?, ?, NULL)`)
        .bind(crypto.randomUUID(), demandId, item.productId, item.quantity),
    );
  }

  statements.push(
    db
      .prepare(`INSERT INTO route_plans (
        id, demand_id, name, strategy, status, driver_id, vehicle_id, distance_km,
        duration_minutes, estimated_cost, coverage_percent, estimated_load_weight_kg, geometry,
        current_stop, collected_quantity, created_at
      ) VALUES (?, ?, ?, ?, 'APROVADA', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`)
      .bind(
        routeId,
        demandId,
        routeName,
        approvedProposal.strategy,
        input.driverId,
        input.vehicleId,
        approvedProposal.distanceKm,
        approvedProposal.durationMinutes,
        approvedProposal.estimatedCost,
        approvedProposal.coveragePercent,
        approvedProposal.estimatedLoadWeightKg,
        JSON.stringify(approvedProposal.stopLocationIds),
        now,
      ),
  );

  const planningData = await getPlanningData();
  approvedProposal.stopLocationIds.forEach((locationId, index) => {
    const allocations = approvedProposal.allocations.filter(
      (allocation) => allocation.locationId === locationId,
    );
    const location = planningData.locations.find((candidate) => candidate.id === locationId);
    const isDestination = location?.type === 'DESTINO';
    const summary = isDestination
      ? 'Entrega da demanda'
      : allocations
          .map((allocation) => `${allocation.productName} ${allocation.quantity} ${allocation.unit}`)
          .join(' · ');
    statements.push(
      db
        .prepare(`INSERT INTO route_stops VALUES (?, ?, ?, ?, ?, 'PENDENTE', NULL, ?, NULL)`)
        .bind(
          crypto.randomUUID(),
          routeId,
          locationId,
          index + 1,
          location?.type === 'ESTOQUE'
            ? 'ESTOQUE'
            : isDestination
              ? 'ENTREGA'
              : 'PRODUTOR',
          summary || 'Coleta programada',
        ),
    );
  });

  statements.push(
    db
      .prepare(`INSERT INTO route_responsibility_periods VALUES (?, ?, ?, ?, ?, NULL, 'GESTOR', ?)`)
      .bind(
        `responsibility-${crypto.randomUUID()}`,
        routeId,
        input.vehicleId,
        input.driverId,
        now,
        'Responsabilidade inicial',
      ),
    db
      .prepare(`INSERT INTO audit_events VALUES (?, 'ROTA', ?, 'ROTA_APROVADA', 'GESTOR', ?, ?)`)
      .bind(
        crypto.randomUUID(),
        routeId,
        JSON.stringify({ proposal: approvedProposal.id, driverId: input.driverId, vehicleId: input.vehicleId }),
        now,
      ),
  );
  await db.batch(statements);
  return { demandId, routeId };
}

export async function getRouteTracking(routeId = 'route-norte') {
  const [routeRows, stops, pings, blocks] = await Promise.all([
    all<Row>(`SELECT r.*, d.name AS driver_name, v.plate AS vehicle_plate,
      v.manufacturer AS vehicle_manufacturer, v.model AS vehicle_model, l.name AS destination_name
      FROM route_plans r LEFT JOIN drivers d ON d.id = r.driver_id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      JOIN demands dm ON dm.id = r.demand_id
      JOIN locations l ON l.id = dm.destination_location_id
      WHERE r.id = ? LIMIT 1`, [routeId]),
    all<Row>(`SELECT s.id, s.sequence, s.type, s.status, s.planned_arrival,
      s.planned_summary, s.actual_summary, l.id AS location_id, l.name AS location_name,
      l.address, l.latitude, l.longitude
      FROM route_stops s JOIN locations l ON l.id = s.location_id
      WHERE s.route_plan_id = ? ORDER BY s.sequence`, [routeId]),
    all<Row>(`SELECT id, latitude, longitude, accuracy_meters, recorded_at
      FROM route_location_pings WHERE route_plan_id = ? ORDER BY recorded_at`, [routeId]),
    all<Row>(`SELECT id, name, notes, geometry FROM road_blocks WHERE active = 1 ORDER BY name`),
  ]);
  if (!routeRows[0]) return null;
  return { route: routeRows[0], stops, pings, blocks };
}

export async function updateRouteProgress(input: {
  routeId: string;
  stopId: string;
  status: 'EM_CURSO' | 'CONCLUIDA';
}) {
  await ensureDatabase();
  const db = getD1();
  const stop = await db
    .prepare(`SELECT sequence FROM route_stops WHERE id = ? AND route_plan_id = ?`)
    .bind(input.stopId, input.routeId)
    .first<{ sequence: number }>();
  if (!stop) throw new Error('Parada não encontrada.');
  await db.batch([
    db
      .prepare(`UPDATE route_stops SET status = ?, actual_summary = ? WHERE id = ?`)
      .bind(
        input.status,
        input.status === 'CONCLUIDA' ? 'Confirmação registrada' : null,
        input.stopId,
      ),
    db
      .prepare(`UPDATE route_plans SET status = 'EM_ANDAMENTO', current_stop = ? WHERE id = ?`)
      .bind(stop.sequence, input.routeId),
  ]);
  return { ok: true };
}

export async function recordRouteLocation(input: {
  routeId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}) {
  await ensureDatabase();
  const db = getD1();
  const route = await db
    .prepare(`SELECT driver_id, vehicle_id FROM route_plans WHERE id = ?`)
    .bind(input.routeId)
    .first<{ driver_id: string; vehicle_id: string | null }>();
  if (!route?.driver_id) throw new Error('Rota sem caminhoneiro definido.');
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO route_location_pings (
      id, route_plan_id, driver_id, vehicle_id, latitude, longitude,
      accuracy_meters, recorded_at, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      input.routeId,
      route.driver_id,
      route.vehicle_id,
      input.latitude,
      input.longitude,
      input.accuracyMeters ?? null,
      now,
      now,
    )
    .run();
  return { recordedAt: now };
}

function mapStock(row: Row): StockBalance {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    locationName: String(row.location_name),
    productId: String(row.product_id),
    productName: String(row.product_name),
    unit: String(row.unit),
    quantity: Number(row.quantity),
    updatedAt: String(row.updated_at),
  };
}

function mapPlanningProduct(row: Row): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    normalizedName: String(row.normalized_name),
    unit: String(row.unit),
    packagingCode: String(row.packaging_code),
    packagingLabel: row.packaging_label == null ? null : String(row.packaging_label),
    packageContentQuantity: Number(row.package_content_quantity),
    averageUnitWeightKg: Number(row.average_unit_weight_kg),
    perishable: Boolean(row.perishable),
    active: Boolean(row.active),
    referenced: true,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapOffer(row: Row): SupplyOffer {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    locationName: String(row.location_name),
    productId: String(row.product_id),
    productName: String(row.product_name),
    unit: String(row.unit),
    quantity: Number(row.quantity),
    status: String(row.status),
    availableOn: String(row.available_on),
    updatedAt: String(row.updated_at),
  };
}

function mapDriver(row: Row): Driver {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : null,
    baseLocationId: row.base_location_id ? String(row.base_location_id) : null,
    baseName: row.base_name ? String(row.base_name) : null,
    baseLatitude: row.base_latitude == null ? null : Number(row.base_latitude),
    baseLongitude: row.base_longitude == null ? null : Number(row.base_longitude),
  };
}

function mapSubstitution(row: Row): Substitution {
  return {
    originalProductId: String(row.original_product_id),
    substituteProductId: String(row.substitute_product_id),
    substituteName: String(row.substitute_name),
    substituteUnit: String(row.substitute_unit),
    quantityFactor: Number(row.quantity_factor),
    priority: Number(row.priority),
  };
}
