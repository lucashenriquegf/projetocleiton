import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    unit: text('unit').notNull(),
    category: text('category').notNull().default('ALIMENTO'),
    packagingCode: text('packaging_code').notNull().default('AVULSO'),
    packagingLabel: text('packaging_label'),
    packageContentQuantity: real('package_content_quantity').notNull().default(1),
    averageUnitWeightKg: real('average_unit_weight_kg').notNull().default(1),
    perishable: integer('perishable', { mode: 'boolean' }).notNull().default(false),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_products_normalized_name').on(table.normalizedName),
    index('idx_products_active_name').on(table.active, table.normalizedName),
  ],
);

export const locations = sqliteTable(
  'locations',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    address: text('address').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('idx_locations_type_active').on(table.type, table.active)],
);

export const stockBalances = sqliteTable(
  'stock_balances',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    quantity: real('quantity').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_stock_location_product').on(table.locationId, table.productId),
  ],
);

export const supplyOffers = sqliteTable(
  'supply_offers',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    quantity: real('quantity').notNull(),
    status: text('status').notNull().default('CONFIRMADA'),
    availableOn: text('available_on').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_offers_product_status').on(table.productId, table.status),
    index('idx_offers_location_date').on(table.locationId, table.availableOn),
  ],
);

export const productSubstitutions = sqliteTable(
  'product_substitutions',
  {
    id: text('id').primaryKey(),
    originalProductId: text('original_product_id')
      .notNull()
      .references(() => products.id),
    substituteProductId: text('substitute_product_id')
      .notNull()
      .references(() => products.id),
    quantityFactor: real('quantity_factor').notNull().default(1),
    priority: integer('priority').notNull().default(1),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    index('idx_substitutions_original_active').on(
      table.originalProductId,
      table.active,
    ),
  ],
);

export const drivers = sqliteTable('drivers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  baseLocationId: text('base_location_id').references(() => locations.id),
  baseLabel: text('base_label'),
  baseLatitude: real('base_latitude'),
  baseLongitude: real('base_longitude'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const vehicles = sqliteTable(
  'vehicles',
  {
    id: text('id').primaryKey(),
    plate: text('plate').notNull(),
    normalizedPlate: text('normalized_plate').notNull(),
    internalCode: text('internal_code'),
    manufacturer: text('manufacturer').notNull(),
    model: text('model').notNull(),
    modelYear: integer('model_year').notNull(),
    category: text('category').notNull(),
    traction: text('traction').notNull(),
    axleCount: integer('axle_count'),
    capacityKg: real('capacity_kg').notNull(),
    capacityM3: real('capacity_m3').notNull(),
    operationalStatus: text('operational_status').notNull().default('AVAILABLE'),
    baseLocationId: text('base_location_id').references(() => locations.id),
    baseLabel: text('base_label'),
    baseLatitude: real('base_latitude'),
    baseLongitude: real('base_longitude'),
    notes: text('notes'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_vehicles_normalized_plate').on(table.normalizedPlate),
    uniqueIndex('idx_vehicles_internal_code')
      .on(table.internalCode)
      .where(sql`${table.internalCode} IS NOT NULL`),
    index('idx_vehicles_status_category').on(
      table.operationalStatus,
      table.category,
    ),
    index('idx_vehicles_base').on(table.baseLocationId),
  ],
);

export const vehicleDriverAssignments = sqliteTable(
  'vehicle_driver_assignments',
  {
    id: text('id').primaryKey(),
    vehicleId: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    driverId: text('driver_id')
      .notNull()
      .references(() => drivers.id),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    actor: text('actor').notNull().default('GESTOR'),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('idx_fleet_vehicle_current')
      .on(table.vehicleId)
      .where(sql`${table.endedAt} IS NULL`),
    uniqueIndex('idx_fleet_driver_current')
      .on(table.driverId)
      .where(sql`${table.endedAt} IS NULL`),
    index('idx_fleet_vehicle_started').on(table.vehicleId, table.startedAt),
    index('idx_fleet_driver_started').on(table.driverId, table.startedAt),
  ],
);

export const demands = sqliteTable(
  'demands',
  {
    id: text('id').primaryKey(),
    destinationLocationId: text('destination_location_id')
      .notNull()
      .references(() => locations.id),
    deliveryDate: text('delivery_date').notNull(),
    deadline: text('deadline').notNull(),
    status: text('status').notNull().default('RASCUNHO'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_demands_date_status').on(table.deliveryDate, table.status)],
);

export const demandItems = sqliteTable(
  'demand_items',
  {
    id: text('id').primaryKey(),
    demandId: text('demand_id')
      .notNull()
      .references(() => demands.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    quantity: real('quantity').notNull(),
    substitutedProductId: text('substituted_product_id').references(
      () => products.id,
    ),
  },
  (table) => [index('idx_demand_items_demand').on(table.demandId)],
);

export const roadBlocks = sqliteTable('road_blocks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  reference: text('reference'),
  notes: text('notes'),
  geometry: text('geometry').notNull(),
  restrictionMode: text('restriction_mode').notNull().default('BLOCK_ALL'),
  requiredTraction: text('required_traction'),
  maximumVehicleCategory: text('maximum_vehicle_category'),
  maximumAxles: integer('maximum_axles'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull(),
});

export const routeCostConfig = sqliteTable('route_cost_config', {
  id: text('id').primaryKey(),
  costPerKilometer: real('cost_per_kilometer').notNull(),
  costPerHour: real('cost_per_hour').notNull(),
  fixedTripCost: real('fixed_trip_cost').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const routePlans = sqliteTable(
  'route_plans',
  {
    id: text('id').primaryKey(),
    demandId: text('demand_id')
      .notNull()
      .references(() => demands.id),
    name: text('name').notNull(),
    strategy: text('strategy').notNull(),
    status: text('status').notNull().default('CALCULADA'),
    driverId: text('driver_id').references(() => drivers.id),
    vehicleId: text('vehicle_id').references(() => vehicles.id),
    distanceKm: real('distance_km').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    estimatedCost: real('estimated_cost').notNull(),
    coveragePercent: real('coverage_percent').notNull(),
    estimatedLoadWeightKg: real('estimated_load_weight_kg').notNull().default(0),
    geometry: text('geometry').notNull(),
    currentStop: integer('current_stop').notNull().default(0),
    collectedQuantity: real('collected_quantity').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_routes_status_created').on(table.status, table.createdAt),
    index('idx_routes_driver_status').on(table.driverId, table.status),
    index('idx_routes_vehicle_status').on(table.vehicleId, table.status),
  ],
);

export const routeResponsibilityPeriods = sqliteTable(
  'route_responsibility_periods',
  {
    id: text('id').primaryKey(),
    routePlanId: text('route_plan_id')
      .notNull()
      .references(() => routePlans.id),
    vehicleId: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    driverId: text('driver_id')
      .notNull()
      .references(() => drivers.id),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    actor: text('actor').notNull().default('GESTOR'),
    notes: text('notes'),
  },
  (table) => [
    index('idx_route_responsibility_route_started').on(
      table.routePlanId,
      table.startedAt,
    ),
  ],
);

export const routeStops = sqliteTable(
  'route_stops',
  {
    id: text('id').primaryKey(),
    routePlanId: text('route_plan_id')
      .notNull()
      .references(() => routePlans.id),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    sequence: integer('sequence').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull().default('PENDENTE'),
    plannedArrival: text('planned_arrival'),
    plannedSummary: text('planned_summary').notNull(),
    actualSummary: text('actual_summary'),
  },
  (table) => [index('idx_route_stops_route_sequence').on(table.routePlanId, table.sequence)],
);

export const routeLocationPings = sqliteTable(
  'route_location_pings',
  {
    id: text('id').primaryKey(),
    routePlanId: text('route_plan_id')
      .notNull()
      .references(() => routePlans.id),
    driverId: text('driver_id')
      .notNull()
      .references(() => drivers.id),
    vehicleId: text('vehicle_id').references(() => vehicles.id),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    accuracyMeters: real('accuracy_meters'),
    recordedAt: text('recorded_at').notNull(),
    receivedAt: text('received_at').notNull(),
  },
  (table) => [
    index('idx_pings_route_recorded').on(table.routePlanId, table.recordedAt),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    eventType: text('event_type').notNull(),
    actor: text('actor').notNull(),
    payload: text('payload'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_audit_entity').on(table.entityType, table.entityId)],
);
