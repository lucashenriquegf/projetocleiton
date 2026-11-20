import { getD1 } from './index';
import { normalizeLegacyUnit, normalizeProductName } from '@/lib/product-catalog';

let bootstrapPromise: Promise<void> | undefined;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'ALIMENTO',
    packaging_code TEXT NOT NULL DEFAULT 'AVULSO', packaging_label TEXT,
    package_content_quantity REAL NOT NULL DEFAULT 1,
    average_unit_weight_kg REAL NOT NULL DEFAULT 1,
    perishable INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, phone TEXT,
    address TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS stock_balances (
    id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES locations(id),
    product_id TEXT NOT NULL REFERENCES products(id), quantity REAL NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS supply_offers (
    id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES locations(id),
    product_id TEXT NOT NULL REFERENCES products(id), quantity REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMADA', available_on TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS product_substitutions (
    id TEXT PRIMARY KEY, original_product_id TEXT NOT NULL REFERENCES products(id),
    substitute_product_id TEXT NOT NULL REFERENCES products(id),
    quantity_factor REAL NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT,
    base_location_id TEXT REFERENCES locations(id), base_label TEXT,
    base_latitude REAL, base_longitude REAL, active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY, plate TEXT NOT NULL, normalized_plate TEXT NOT NULL UNIQUE,
    internal_code TEXT, manufacturer TEXT NOT NULL, model TEXT NOT NULL,
    model_year INTEGER NOT NULL, category TEXT NOT NULL, traction TEXT NOT NULL,
    axle_count INTEGER, capacity_kg REAL NOT NULL, capacity_m3 REAL NOT NULL,
    operational_status TEXT NOT NULL DEFAULT 'AVAILABLE',
    base_location_id TEXT REFERENCES locations(id), base_label TEXT,
    base_latitude REAL, base_longitude REAL, notes TEXT,
    active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS vehicle_driver_assignments (
    id TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
    driver_id TEXT NOT NULL REFERENCES drivers(id), started_at TEXT NOT NULL,
    ended_at TEXT, actor TEXT NOT NULL DEFAULT 'GESTOR', notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS demands (
    id TEXT PRIMARY KEY, destination_location_id TEXT NOT NULL REFERENCES locations(id),
    delivery_date TEXT NOT NULL, deadline TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RASCUNHO', created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS demand_items (
    id TEXT PRIMARY KEY, demand_id TEXT NOT NULL REFERENCES demands(id),
    product_id TEXT NOT NULL REFERENCES products(id), quantity REAL NOT NULL,
    substituted_product_id TEXT REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS road_blocks (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT, notes TEXT, geometry TEXT NOT NULL,
    restriction_mode TEXT NOT NULL DEFAULT 'BLOCK_ALL', required_traction TEXT,
    maximum_vehicle_category TEXT, maximum_axles INTEGER,
    active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS route_cost_config (
    id TEXT PRIMARY KEY, cost_per_kilometer REAL NOT NULL,
    cost_per_hour REAL NOT NULL, fixed_trip_cost REAL NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS route_plans (
    id TEXT PRIMARY KEY, demand_id TEXT NOT NULL REFERENCES demands(id), name TEXT NOT NULL,
    strategy TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'CALCULADA',
    driver_id TEXT REFERENCES drivers(id), vehicle_id TEXT REFERENCES vehicles(id),
    distance_km REAL NOT NULL,
    duration_minutes INTEGER NOT NULL, estimated_cost REAL NOT NULL,
    coverage_percent REAL NOT NULL, estimated_load_weight_kg REAL NOT NULL DEFAULT 0,
    geometry TEXT NOT NULL,
    current_stop INTEGER NOT NULL DEFAULT 0, collected_quantity REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS route_responsibility_periods (
    id TEXT PRIMARY KEY, route_plan_id TEXT NOT NULL REFERENCES route_plans(id),
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id), driver_id TEXT NOT NULL REFERENCES drivers(id),
    started_at TEXT NOT NULL, ended_at TEXT, actor TEXT NOT NULL DEFAULT 'GESTOR', notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS route_stops (
    id TEXT PRIMARY KEY, route_plan_id TEXT NOT NULL REFERENCES route_plans(id),
    location_id TEXT NOT NULL REFERENCES locations(id), sequence INTEGER NOT NULL,
    type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDENTE',
    planned_arrival TEXT, planned_summary TEXT NOT NULL, actual_summary TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS route_location_pings (
    id TEXT PRIMARY KEY, route_plan_id TEXT NOT NULL REFERENCES route_plans(id),
    driver_id TEXT NOT NULL REFERENCES drivers(id), vehicle_id TEXT REFERENCES vehicles(id), latitude REAL NOT NULL,
    longitude REAL NOT NULL, accuracy_meters REAL, recorded_at TEXT NOT NULL,
    received_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
    event_type TEXT NOT NULL, actor TEXT NOT NULL, payload TEXT, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_migrations (
    id TEXT PRIMARY KEY, applied_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_locations_type_active ON locations(type, active)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_location_product ON stock_balances(location_id, product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_offers_product_status ON supply_offers(product_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_offers_location_date ON supply_offers(location_id, available_on)`,
  `CREATE INDEX IF NOT EXISTS idx_substitutions_original_active ON product_substitutions(original_product_id, active)`,
  `CREATE INDEX IF NOT EXISTS idx_vehicles_status_category ON vehicles(operational_status, category)`,
  `CREATE INDEX IF NOT EXISTS idx_vehicles_base ON vehicles(base_location_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_internal_code ON vehicles(internal_code) WHERE internal_code IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_vehicle_current ON vehicle_driver_assignments(vehicle_id) WHERE ended_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_driver_current ON vehicle_driver_assignments(driver_id) WHERE ended_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_fleet_vehicle_started ON vehicle_driver_assignments(vehicle_id, started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_fleet_driver_started ON vehicle_driver_assignments(driver_id, started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_demands_date_status ON demands(delivery_date, status)`,
  `CREATE INDEX IF NOT EXISTS idx_demand_items_demand ON demand_items(demand_id)`,
  `CREATE INDEX IF NOT EXISTS idx_routes_status_created ON route_plans(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_routes_driver_status ON route_plans(driver_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_route_responsibility_route_started ON route_responsibility_periods(route_plan_id, started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_route_stops_route_sequence ON route_stops(route_plan_id, sequence)`,
  `CREATE INDEX IF NOT EXISTS idx_pings_route_recorded ON route_location_pings(route_plan_id, recorded_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id)`,
];

const seedStatements = [
  `INSERT OR IGNORE INTO products (
    id,name,normalized_name,unit,category,packaging_code,packaging_label,
    package_content_quantity,average_unit_weight_kg,perishable,active,created_at,updated_at
  ) VALUES
    ('prod-alface','Alface','alface','un','ALIMENTO','CAIXA_PLASTICA',NULL,20,0.3,1,1,'2026-08-01T12:00:00Z','2026-08-01T12:00:00Z'),
    ('prod-batata','Batata','batata','kg','ALIMENTO','SACA',NULL,20,1,1,1,'2026-08-01T12:00:00Z','2026-08-01T12:00:00Z'),
    ('prod-ovos','Ovos','ovos','duzia','ALIMENTO','BANDEJA',NULL,1,0.75,1,1,'2026-08-01T12:00:00Z','2026-08-01T12:00:00Z'),
    ('prod-farinha','Farinha de mandioca','farinha de mandioca','kg','ALIMENTO','PACOTE',NULL,1,1,0,1,'2026-08-01T12:00:00Z','2026-08-01T12:00:00Z'),
    ('prod-feijao','Feijão carioca','feijao carioca','kg','ALIMENTO','PACOTE',NULL,1,1,0,1,'2026-08-01T12:00:00Z','2026-08-01T12:00:00Z'),
    ('prod-polvilho','Polvilho','polvilho','kg','ALIMENTO','PACOTE',NULL,1,1,0,1,'2026-08-01T12:00:00Z','2026-08-01T12:00:00Z'),
    ('prod-leite','Leite','leite','l','ALIMENTO','GALAO_10L',NULL,10,1.03,1,1,'2026-08-01T12:00:00Z','2026-08-01T12:00:00Z'),
    ('prod-frango','Frango','frango','kg','ALIMENTO','CAIXA_PLASTICA',NULL,20,1,1,1,'2026-08-01T12:00:00Z','2026-08-01T12:00:00Z')`,
  `INSERT OR IGNORE INTO locations VALUES
    ('loc-estoque','ESTOQUE','Estoque da Cooperativa','(62) 3333-1000','Rod. GO-070, km 12',-16.575,-49.415,1),
    ('loc-escola-maria','DESTINO','Escola Maria da Terra','(62) 3333-2100','Av. das Palmeiras, 120',-16.505,-49.345,1),
    ('loc-escola-joao','DESTINO','Escola Municipal João Paulo II','(62) 3333-2200','Rua do Cerrado, 45',-16.535,-49.295,1),
    ('loc-boa-vista','PRODUTOR','Sítio Boa Vista','(62) 99111-1010','Estrada Boa Vista, km 4',-16.615,-49.465,1),
    ('loc-primavera','PRODUTOR','Sítio Primavera','(62) 99111-2020','Estrada Primavera, km 7',-16.555,-49.505,1),
    ('loc-esperanca','PRODUTOR','Chácara Esperança','(62) 99111-3030','Via Esperança, km 2',-16.475,-49.455,1),
    ('loc-sol-nascente','PRODUTOR','Fazenda Sol Nascente','(62) 99111-4040','Estrada do Cedro, km 9',-16.445,-49.385,1),
    ('loc-santa-rita','PRODUTOR','Sítio Santa Rita','(62) 99111-5050','Vicinal Santa Rita, km 3',-16.525,-49.425,1),
    ('loc-base-norte','BASE','Base Norte','(62) 3333-3000','Praça Central, 10',-16.565,-49.385,1)`,
  `INSERT OR IGNORE INTO stock_balances VALUES
    ('stock-farinha','loc-estoque','prod-farinha',80,'2026-08-31T19:10:00Z'),
    ('stock-feijao','loc-estoque','prod-feijao',120,'2026-08-31T19:10:00Z'),
    ('stock-polvilho','loc-estoque','prod-polvilho',45,'2026-08-31T19:10:00Z'),
    ('stock-leite','loc-estoque','prod-leite',180,'2026-08-31T19:10:00Z'),
    ('stock-alface','loc-estoque','prod-alface',80,'2026-08-31T19:10:00Z')`,
  `INSERT OR IGNORE INTO supply_offers VALUES
    ('offer-alface-boa','loc-boa-vista','prod-alface',180,'ALTERADA','2026-09-01','2026-08-31T18:20:00Z'),
    ('offer-alface-primavera','loc-primavera','prod-alface',220,'CONFIRMADA','2026-09-01','2026-08-31T17:20:00Z'),
    ('offer-batata-esperanca','loc-esperanca','prod-batata',260,'CONFIRMADA','2026-09-01','2026-08-31T17:20:00Z'),
    ('offer-ovos-sol','loc-sol-nascente','prod-ovos',30,'CONFIRMADA','2026-09-01','2026-08-31T17:20:00Z'),
    ('offer-frango-santa','loc-santa-rita','prod-frango',55,'CONFIRMADA','2026-09-01','2026-08-31T17:20:00Z'),
    ('offer-leite-santa','loc-santa-rita','prod-leite',240,'CONFIRMADA','2026-09-01','2026-08-31T17:20:00Z')`,
  `INSERT OR IGNORE INTO product_substitutions VALUES
    ('sub-ovos-feijao','prod-ovos','prod-feijao',1.25,1,1),
    ('sub-ovos-frango','prod-ovos','prod-frango',0.8,2,1),
    ('sub-batata-farinha','prod-batata','prod-farinha',0.7,1,1)`,
  `INSERT OR IGNORE INTO drivers (id,name,phone,base_location_id,base_label,base_latitude,base_longitude,active) VALUES
    ('driver-carlos','Carlos Mendes','(62) 99910-1111','loc-base-norte','Base Norte',-16.565,-49.385,1),
    ('driver-ana','Ana Paula','(62) 99910-2222','loc-estoque','Estoque da Cooperativa',-16.575,-49.415,1)`,
  `INSERT OR IGNORE INTO vehicles VALUES
    ('vehicle-001','QTN4A21','QTN4A21','V-001','Mercedes-Benz','Accelo 1016',2023,'TRUCK','4X2',2,6000,28,'AVAILABLE','loc-base-norte','Base Norte',-16.565,-49.385,'Baú para alimentos','1','2026-08-20T12:00:00Z','2026-08-31T12:00:00Z'),
    ('vehicle-002','PRD8B42','PRD8B42','V-002','Toyota','Hilux',2024,'UTILITY','4X4',2,1000,5.5,'AVAILABLE','loc-estoque','Estoque da Cooperativa',-16.575,-49.415,'Apta para vias rurais restritas','1','2026-08-22T12:00:00Z','2026-08-31T12:00:00Z'),
    ('vehicle-003','ONX2C13','ONX2C13','V-003','Volkswagen','Delivery 11.180',2022,'TRUCK','6X2',3,8500,36,'MAINTENANCE','loc-estoque','Estoque da Cooperativa',-16.575,-49.415,'Revisão programada','1','2026-08-25T12:00:00Z','2026-08-31T12:00:00Z')`,
  `INSERT OR IGNORE INTO vehicle_driver_assignments VALUES
    ('fleet-carlos','vehicle-001','driver-carlos','2026-08-31T10:00:00Z',NULL,'GESTOR','Vínculo inicial'),
    ('fleet-ana','vehicle-002','driver-ana','2026-08-31T10:00:00Z',NULL,'GESTOR','Vínculo inicial')`,
  `UPDATE drivers SET
    base_label = COALESCE(base_label, (SELECT name FROM locations WHERE id = drivers.base_location_id)),
    base_latitude = COALESCE(base_latitude, (SELECT latitude FROM locations WHERE id = drivers.base_location_id)),
    base_longitude = COALESCE(base_longitude, (SELECT longitude FROM locations WHERE id = drivers.base_location_id))
    WHERE base_location_id IS NOT NULL`,
  `INSERT OR IGNORE INTO demands VALUES
    ('demand-maria','loc-escola-maria','2026-09-01','10:30','EM_ROTA','2026-08-31T13:00:00Z'),
    ('demand-joao','loc-escola-joao','2026-09-01','11:30','PLANEJAR','2026-08-31T14:00:00Z')`,
  `INSERT OR IGNORE INTO demand_items VALUES
    ('di-maria-alface','demand-maria','prod-alface',300,NULL),
    ('di-maria-feijao','demand-maria','prod-feijao',100,NULL),
    ('di-maria-leite','demand-maria','prod-leite',180,NULL),
    ('di-joao-alface','demand-joao','prod-alface',360,NULL),
    ('di-joao-batata','demand-joao','prod-batata',200,NULL),
    ('di-joao-ovos','demand-joao','prod-ovos',45,NULL)`,
  `INSERT OR IGNORE INTO road_blocks (id,name,reference,notes,geometry,restriction_mode,required_traction,maximum_vehicle_category,maximum_axles,active,updated_at) VALUES
    ('block-ponte','Ponte do Córrego Fundo','Estrada do Barreiro, km 6','Risco permanente de atolamento.','[[[-49.48,-16.53],[-49.44,-16.50]]]','REQUIREMENTS','4X4',NULL,NULL,1,'2026-08-31T12:00:00Z')`,
  `INSERT OR IGNORE INTO route_cost_config VALUES
    ('default',2.85,24,35,'2026-08-31T12:00:00Z')`,
  `INSERT OR IGNORE INTO route_plans (id,demand_id,name,strategy,status,driver_id,vehicle_id,distance_km,duration_minutes,estimated_cost,coverage_percent,estimated_load_weight_kg,geometry,current_stop,collected_quantity,created_at) VALUES
    ('route-norte','demand-maria','Rota Norte','MENOR_TEMPO','EM_ANDAMENTO','driver-carlos','vehicle-001',42.6,178,227.61,100,495.4,'[[-49.415,-16.575],[-49.425,-16.525],[-49.465,-16.615],[-49.505,-16.555],[-49.385,-16.445],[-49.345,-16.505]]',4,420,'2026-08-31T13:10:00Z')`,
  `INSERT OR IGNORE INTO route_responsibility_periods VALUES
    ('responsibility-route-norte','route-norte','vehicle-001','driver-carlos','2026-08-31T13:10:00Z',NULL,'GESTOR','Responsabilidade inicial')`,
  `UPDATE route_plans SET vehicle_id = 'vehicle-001' WHERE id = 'route-norte' AND vehicle_id IS NULL`,
  `INSERT OR IGNORE INTO route_stops VALUES
    ('stop-1','route-norte','loc-estoque',1,'ESTOQUE','CONCLUIDA','07:30','Farinha 80 kg · Feijão 100 kg · Leite 180 L','Coleta confirmada'),
    ('stop-2','route-norte','loc-santa-rita',2,'PRODUTOR','CONCLUIDA','08:05','Frango 40 kg','Coleta confirmada'),
    ('stop-3','route-norte','loc-boa-vista',3,'PRODUTOR','CONCLUIDA','08:40','Alface 180 un','Coleta confirmada'),
    ('stop-4','route-norte','loc-primavera',4,'PRODUTOR','CONCLUIDA','09:15','Alface 120 un','Coleta confirmada'),
    ('stop-5','route-norte','loc-sol-nascente',5,'PRODUTOR','EM_CURSO','09:45','Ovos 20 dúzias',NULL),
    ('stop-6','route-norte','loc-escola-maria',6,'ENTREGA','PENDENTE','10:05','Entrega completa',NULL)`,
  `INSERT OR IGNORE INTO route_location_pings (id,route_plan_id,driver_id,vehicle_id,latitude,longitude,accuracy_meters,recorded_at,received_at) VALUES
    ('ping-1','route-norte','driver-carlos','vehicle-001',-16.575,-49.415,14,'2026-08-31T11:32:00Z','2026-08-31T11:32:03Z'),
    ('ping-2','route-norte','driver-carlos','vehicle-001',-16.535,-49.425,11,'2026-08-31T12:04:00Z','2026-08-31T12:04:02Z'),
    ('ping-3','route-norte','driver-carlos','vehicle-001',-16.603,-49.462,12,'2026-08-31T12:42:00Z','2026-08-31T12:42:02Z'),
    ('ping-4','route-norte','driver-carlos','vehicle-001',-16.555,-49.505,9,'2026-08-31T13:15:00Z','2026-08-31T13:15:01Z'),
    ('ping-5','route-norte','driver-carlos','vehicle-001',-16.490,-49.446,8,'2026-08-31T13:37:00Z','2026-08-31T13:37:01Z')`,
  `UPDATE route_location_pings SET vehicle_id = 'vehicle-001' WHERE route_plan_id = 'route-norte' AND vehicle_id IS NULL`,
];

export function ensureDatabase(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().catch((error) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }
  return bootstrapPromise;
}

async function bootstrap() {
  const db = getD1();
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await ensureCompatibilityColumns();
  await backfillProductLogistics();
  await applyProductLogisticsSeedMigration();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_normalized_name ON products(normalized_name)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_products_active_name ON products(active, normalized_name)').run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_routes_vehicle_status ON route_plans(vehicle_id, status)`).run();
  await db.batch(seedStatements.map((statement) => db.prepare(statement)));
  await applyVehiclePlateFormatMigration();
  await db.prepare('PRAGMA optimize').run();
}

async function applyVehiclePlateFormatMigration() {
  const db = getD1();
  const migrationId = '2026-09-vehicle-plates-without-hyphen';
  const applied = await db.prepare('SELECT id FROM app_migrations WHERE id = ? LIMIT 1')
    .bind(migrationId).first();
  if (applied) return;

  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE vehicles SET plate = normalized_plate, updated_at = ?
      WHERE plate != normalized_plate`).bind(now),
    db.prepare('INSERT INTO app_migrations (id, applied_at) VALUES (?, ?)')
      .bind(migrationId, now),
  ]);
}

async function applyProductLogisticsSeedMigration() {
  const db = getD1();
  const migrationId = '2026-09-product-logistics-profiles';
  const applied = await db.prepare('SELECT id FROM app_migrations WHERE id = ? LIMIT 1')
    .bind(migrationId).first();
  if (applied) return;

  const profiles = [
    ['prod-alface', 'CAIXA_PLASTICA', 20, 0.3],
    ['prod-batata', 'SACA', 20, 1],
    ['prod-ovos', 'BANDEJA', 1, 0.75],
    ['prod-farinha', 'PACOTE', 1, 1],
    ['prod-feijao', 'PACOTE', 1, 1],
    ['prod-polvilho', 'PACOTE', 1, 1],
    ['prod-leite', 'GALAO_10L', 10, 1.03],
    ['prod-frango', 'CAIXA_PLASTICA', 20, 1],
  ] as const;
  const now = new Date().toISOString();
  await db.batch([
    ...profiles.map(([id, packagingCode, contentQuantity, unitWeight]) =>
      db.prepare(`UPDATE products SET packaging_code = ?, package_content_quantity = ?,
        average_unit_weight_kg = ?, updated_at = ? WHERE id = ?`)
        .bind(packagingCode, contentQuantity, unitWeight, now, id),
    ),
    db.prepare('INSERT INTO app_migrations (id, applied_at) VALUES (?, ?)')
      .bind(migrationId, now),
  ]);
}

async function ensureCompatibilityColumns() {
  const db = getD1();
  const additions = [
    ['products', 'normalized_name', 'normalized_name TEXT'],
    ['products', 'packaging_code', "packaging_code TEXT NOT NULL DEFAULT 'AVULSO'"],
    ['products', 'packaging_label', 'packaging_label TEXT'],
    ['products', 'package_content_quantity', 'package_content_quantity REAL NOT NULL DEFAULT 1'],
    ['products', 'average_unit_weight_kg', 'average_unit_weight_kg REAL NOT NULL DEFAULT 1'],
    ['products', 'created_at', 'created_at TEXT'],
    ['products', 'updated_at', 'updated_at TEXT'],
    ['drivers', 'base_label', 'base_label TEXT'],
    ['drivers', 'base_latitude', 'base_latitude REAL'],
    ['drivers', 'base_longitude', 'base_longitude REAL'],
    ['road_blocks', 'reference', 'reference TEXT'],
    ['road_blocks', 'restriction_mode', "restriction_mode TEXT NOT NULL DEFAULT 'BLOCK_ALL'"],
    ['road_blocks', 'required_traction', 'required_traction TEXT'],
    ['road_blocks', 'maximum_vehicle_category', 'maximum_vehicle_category TEXT'],
    ['road_blocks', 'maximum_axles', 'maximum_axles INTEGER'],
    ['route_plans', 'vehicle_id', 'vehicle_id TEXT REFERENCES vehicles(id)'],
    ['route_plans', 'estimated_load_weight_kg', 'estimated_load_weight_kg REAL NOT NULL DEFAULT 0'],
    ['route_location_pings', 'vehicle_id', 'vehicle_id TEXT REFERENCES vehicles(id)'],
  ] as const;

  for (const [table, column, definition] of additions) {
    const existing = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
    if (!(existing.results ?? []).some((item) => item.name === column)) {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run();
    }
  }
}

async function backfillProductLogistics() {
  const db = getD1();
  const result = await db.prepare(`SELECT id, name, unit, normalized_name,
    package_content_quantity, average_unit_weight_kg, created_at, updated_at
    FROM products ORDER BY id`).all<{
      id: string;
      name: string;
      unit: string;
      normalized_name: string | null;
      package_content_quantity: number | null;
      average_unit_weight_kg: number | null;
      created_at: string | null;
      updated_at: string | null;
    }>();
  const usedNames = new Set<string>();
  const now = new Date().toISOString();
  const statements = (result.results ?? []).map((product) => {
    const baseName = normalizeProductName(product.name) || `produto-${product.id}`;
    const normalizedName = usedNames.has(baseName) ? `${baseName}-${product.id}` : baseName;
    usedNames.add(normalizedName);
    const unit = normalizeLegacyUnit(product.unit);
    const knownWeight = unit === 'mg' ? 0.000001 : unit === 'g' ? 0.001 : unit === 'kg' ? 1 : unit === 'arroba' ? 15 : unit === 't' ? 1000 : unit === 'l' ? 1 : 1;
    return db.prepare(`UPDATE products SET normalized_name = ?, unit = ?,
      package_content_quantity = COALESCE(package_content_quantity, 1),
      average_unit_weight_kg = COALESCE(average_unit_weight_kg, ?),
      created_at = COALESCE(created_at, ?), updated_at = COALESCE(updated_at, ?)
      WHERE id = ?`).bind(normalizedName, unit, knownWeight, now, now, product.id);
  });
  if (statements.length) await db.batch(statements);
}
