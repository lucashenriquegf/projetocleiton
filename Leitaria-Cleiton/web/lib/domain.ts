export type Product = {
  id: string;
  name: string;
  normalizedName: string;
  unit: string;
  packagingCode: string;
  packagingLabel: string | null;
  packageContentQuantity: number;
  averageUnitWeightKg: number;
  perishable: boolean;
  active: boolean;
  referenced: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductInput = Pick<
  Product,
  | 'name'
  | 'unit'
  | 'packagingCode'
  | 'packagingLabel'
  | 'packageContentQuantity'
  | 'averageUnitWeightKg'
  | 'perishable'
  | 'active'
>;

export type Location = {
  id: string;
  type: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type StockBalance = {
  id: string;
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  updatedAt: string;
};

export type SupplyOffer = {
  id: string;
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  status: string;
  availableOn: string;
  updatedAt: string;
};

export type Driver = {
  id: string;
  name: string;
  phone: string | null;
  baseLocationId: string | null;
  baseName: string | null;
  baseLatitude?: number | null;
  baseLongitude?: number | null;
};

export type DriverRecord = Driver & {
  active: boolean;
  currentVehicleId: string | null;
  currentVehicleLabel: string | null;
  currentVehiclePlate: string | null;
  activeRouteId: string | null;
  activeRouteName: string | null;
};

export type DriverInput = {
  name: string;
  phone: string;
  baseLocationId?: string | null;
  baseLabel: string;
  baseLatitude: number;
  baseLongitude: number;
  active?: boolean;
};

export type VehicleCategory = 'CAR' | 'UTILITY' | 'VAN' | 'TRUCK';
export type VehicleTraction = '4X2' | '4X4' | '6X2' | '6X4' | 'OTHER';
export type VehicleOperationalStatus = 'AVAILABLE' | 'MAINTENANCE';

export const vehicleTractionsByCategory: Record<VehicleCategory, readonly VehicleTraction[]> = {
  CAR: ['4X2', '4X4'],
  UTILITY: ['4X2', '4X4'],
  VAN: ['4X2', '4X4'],
  TRUCK: ['4X2', '4X4', '6X2', '6X4', 'OTHER'],
};

export type Vehicle = {
  id: string;
  plate: string;
  normalizedPlate: string;
  internalCode: string | null;
  manufacturer: string;
  model: string;
  modelYear: number;
  category: VehicleCategory;
  traction: VehicleTraction;
  axleCount: number | null;
  capacityKg: number;
  capacityM3: number;
  operationalStatus: VehicleOperationalStatus;
  baseLocationId: string | null;
  baseName: string | null;
  baseLatitude: number | null;
  baseLongitude: number | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  currentDriverId: string | null;
  currentDriverName: string | null;
  currentDriverPhone: string | null;
  assignmentStartedAt: string | null;
  activeRouteId: string | null;
  activeRouteName: string | null;
};

export type VehicleInput = {
  plate: string;
  manufacturer: string;
  model: string;
  modelYear: number;
  category: VehicleCategory;
  traction: VehicleTraction;
  axleCount?: number | null;
  capacityKg: number;
  capacityM3: number;
  operationalStatus: VehicleOperationalStatus;
  baseLocationId?: string | null;
  baseLabel: string;
  baseLatitude: number;
  baseLongitude: number;
  notes?: string | null;
};

export type FleetAssignment = {
  id: string;
  vehicleId: string;
  vehicleLabel: string;
  vehiclePlate: string;
  vehicleBase: string;
  driverId: string;
  driverName: string;
  driverPhone: string | null;
  driverBase: string;
  distanceKm: number | null;
  startedAt: string;
  endedAt: string | null;
  activeRouteId: string | null;
  activeRouteName: string | null;
};

export type RoadRestriction = {
  id: string;
  name: string;
  reference: string | null;
  notes: string | null;
  geometry: string;
  restrictionMode: 'BLOCK_ALL' | 'REQUIREMENTS';
  requiredTraction: VehicleTraction | null;
  maximumVehicleCategory: VehicleCategory | null;
  maximumAxles: number | null;
  active: boolean;
  updatedAt: string;
};

export type RoadRestrictionInput = Omit<RoadRestriction, 'id' | 'updatedAt'>;

export type DemandSummary = {
  id: string;
  destinationName: string;
  deliveryDate: string;
  deadline: string;
  status: string;
  itemCount: number;
};

export type Substitution = {
  originalProductId: string;
  substituteProductId: string;
  substituteName: string;
  substituteUnit: string;
  quantityFactor: number;
  priority: number;
};

export type CostConfig = {
  costPerKilometer: number;
  costPerHour: number;
  fixedTripCost: number;
};

export type PlanningData = {
  products: Product[];
  destinations: Location[];
  locations: Location[];
  stocks: StockBalance[];
  offers: SupplyOffer[];
  drivers: Driver[];
  vehicles: Vehicle[];
  roadRestrictions: RoadRestriction[];
  substitutions: Substitution[];
  costConfig: CostConfig;
};

export type DemandInput = {
  destinationId: string;
  deliveryDate: string;
  deadline: string;
  items: Array<{ productId: string; quantity: number }>;
};

export type Allocation = {
  sourceType: 'ESTOQUE' | 'PRODUTOR' | 'SUBSTITUICAO';
  locationId: string;
  locationName: string;
  requestedProductId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
};

export type RouteProposal = {
  id: 'economica' | 'equilibrada' | 'rapida';
  name: string;
  strategy: string;
  distanceKm: number;
  durationMinutes: number;
  estimatedCost: number;
  coveragePercent: number;
  estimatedLoadWeightKg: number;
  planningIssues: string[];
  loadBreakdown: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    packageCount: number;
    packagingLabel: string;
    estimatedWeightKg: number;
  }>;
  allocations: Allocation[];
  shortages: Array<{ productName: string; quantity: number; unit: string }>;
  stopLocationIds: string[];
  avoidedRoads: string[];
  fleetSuggestions: Array<{
    vehicleId: string;
    driverId: string;
    vehicleLabel: string;
    driverName: string;
    compatible: boolean;
    reasons: string[];
    score: number;
    weightUtilizationPercent: number;
  }>;
};
