import type {
  Allocation,
  DemandInput,
  Location,
  PlanningData,
  RouteProposal,
} from './domain';
import { getPackagingLabel } from './product-catalog';

type MutableAvailability = {
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
};

export function calculateRouteProposals(
  input: DemandInput,
  data: PlanningData,
): RouteProposal[] {
  const stocks: MutableAvailability[] = data.stocks.map((item) => ({ ...item }));
  const offers: MutableAvailability[] = data.offers
    .filter((offer) => offer.status !== 'CANCELADA')
    .map((item) => ({ ...item }));
  const allocations: Allocation[] = [];
  const shortages: RouteProposal['shortages'] = [];
  let requestedTotal = 0;
  let satisfiedTotal = 0;

  for (const item of input.items.filter((candidate) => candidate.quantity > 0)) {
    const product = data.products.find((candidate) => candidate.id === item.productId);
    if (!product) continue;
    requestedTotal += item.quantity;
    let remaining = item.quantity;

    remaining = allocateFrom(
      stocks,
      item.productId,
      remaining,
      'ESTOQUE',
      item.productId,
      allocations,
    );
    remaining = allocateFrom(
      offers,
      item.productId,
      remaining,
      'PRODUTOR',
      item.productId,
      allocations,
    );

    if (remaining > 0) {
      const candidates = data.substitutions
        .filter((candidate) => candidate.originalProductId === item.productId)
        .sort((a, b) => a.priority - b.priority);

      for (const substitution of candidates) {
        if (remaining <= 0) break;
        const requiredSubstitute = remaining * substitution.quantityFactor;
        let substituteRemainder = allocateFrom(
          stocks,
          substitution.substituteProductId,
          requiredSubstitute,
          'SUBSTITUICAO',
          item.productId,
          allocations,
        );
        substituteRemainder = allocateFrom(
          offers,
          substitution.substituteProductId,
          substituteRemainder,
          'SUBSTITUICAO',
          item.productId,
          allocations,
        );
        const substituteAllocated = requiredSubstitute - substituteRemainder;
        remaining -= substituteAllocated / substitution.quantityFactor;
      }
    }

    const satisfied = Math.max(0, item.quantity - remaining);
    satisfiedTotal += satisfied;
    if (remaining > 0.001) {
      shortages.push({
        productName: product.name,
        quantity: round(remaining, 1),
        unit: product.unit,
      });
    }
  }

  const destination = data.destinations.find(
    (candidate) => candidate.id === input.destinationId,
  );
  const stockStops = unique(
    allocations
      .filter((allocation) => allocation.sourceType === 'ESTOQUE')
      .map((allocation) => allocation.locationId),
  );
  const producerStops = nearestNeighbor(
    unique(
      allocations
        .filter((allocation) => allocation.sourceType !== 'ESTOQUE')
        .map((allocation) => allocation.locationId),
    ),
    data.locations,
    stockStops.at(-1) ?? 'loc-estoque',
  );
  const stopLocationIds = [
    ...stockStops,
    ...producerStops,
    ...(destination ? [destination.id] : []),
  ];
  const baseDistance = Math.max(
    12,
    calculateDistance(stopLocationIds, data.locations) * 1.16,
  );
  const baseMinutes = Math.round(baseDistance * 3.1 + producerStops.length * 15 + 18);
  const coveragePercent = requestedTotal
    ? Math.min(100, (satisfiedTotal / requestedTotal) * 100)
    : 0;
  const { estimatedLoadWeightKg, loadBreakdown, planningIssues } =
    calculateLoad(allocations, data.products);

  const variants = [
    {
      id: 'economica' as const,
      name: 'Menor custo',
      strategy: 'ECONOMICA',
      distanceFactor: 0.85,
      durationFactor: 1.03,
    },
    {
      id: 'equilibrada' as const,
      name: 'Equilibrada',
      strategy: 'EQUILIBRADA',
      distanceFactor: 1,
      durationFactor: 1,
    },
    {
      id: 'rapida' as const,
      name: 'Menor tempo',
      strategy: 'RAPIDA',
      distanceFactor: 1.09,
      durationFactor: 0.87,
    },
  ];

  return variants.map((variant) => {
    const distanceKm = round(baseDistance * variant.distanceFactor, 1);
    const durationMinutes = Math.round(baseMinutes * variant.durationFactor);
    const estimatedCost = round(
      data.costConfig.fixedTripCost +
        distanceKm * data.costConfig.costPerKilometer +
        (durationMinutes / 60) * data.costConfig.costPerHour,
      2,
    );

    return {
      ...variant,
      distanceKm,
      durationMinutes,
      estimatedCost,
      coveragePercent: round(coveragePercent, 0),
      estimatedLoadWeightKg,
      planningIssues,
      loadBreakdown,
      allocations,
      shortages,
      stopLocationIds,
      avoidedRoads: ['Ponte do Córrego Fundo'],
      fleetSuggestions: buildFleetSuggestions(
        data,
        stopLocationIds,
        estimatedLoadWeightKg,
        planningIssues,
      ),
    };
  });
}

function buildFleetSuggestions(
  data: PlanningData,
  stopLocationIds: string[],
  requiredKg: number,
  planningIssues: string[],
) {
  const firstStop = data.locations.find((location) => location.id === stopLocationIds[0]);

  return data.vehicles
    .filter((vehicle) => vehicle.currentDriverId)
    .map((vehicle) => {
      const driver = data.drivers.find((candidate) => candidate.id === vehicle.currentDriverId);
      const reasons: string[] = [];
      if (!vehicle.active) reasons.push('O veículo está arquivado.');
      if (vehicle.operationalStatus === 'MAINTENANCE') reasons.push('O veículo está em manutenção.');
      if (vehicle.activeRouteId) reasons.push('O motorista ou o veículo já está executando outra rota.');
      if (planningIssues.length > 0) {
        reasons.push('Complete os dados de peso dos produtos antes de escolher o veículo.');
      }
      if (requiredKg > vehicle.capacityKg) {
        reasons.push(
          `Carga estimada em ${formatKilograms(requiredKg)}; capacidade do veículo: ${formatKilograms(vehicle.capacityKg)}.`,
        );
      }

      const restrictedRoad = data.roadRestrictions.find(
        (road) =>
          road.active &&
          road.restrictionMode === 'REQUIREMENTS' &&
          routeTouchesRoad(stopLocationIds, data.locations, road.geometry) &&
          !meetsRoadRequirements(vehicle, road),
      );
      if (restrictedRoad) reasons.push(`Este veículo não atende à condição de acesso de ${restrictedRoad.name}.`);

      const distanceToDriver = driver && driver.baseLatitude != null && driver.baseLongitude != null && vehicle.baseLatitude != null && vehicle.baseLongitude != null
        ? haversineCoordinates(driver.baseLatitude, driver.baseLongitude, vehicle.baseLatitude, vehicle.baseLongitude)
        : 30;
      const distanceToStart = firstStop && vehicle.baseLatitude != null && vehicle.baseLongitude != null
        ? haversineCoordinates(vehicle.baseLatitude, vehicle.baseLongitude, firstStop.latitude, firstStop.longitude)
        : 30;
      return {
        vehicleId: vehicle.id,
        driverId: vehicle.currentDriverId!,
        vehicleLabel: `${vehicle.plate} · ${vehicle.manufacturer} ${vehicle.model}`,
        driverName: driver?.name ?? vehicle.currentDriverName ?? 'Motorista não informado',
        compatible: reasons.length === 0,
        reasons,
        score: Math.round((distanceToDriver + distanceToStart) * 10) / 10,
        weightUtilizationPercent:
          vehicle.capacityKg > 0 ? round((requiredKg / vehicle.capacityKg) * 100, 1) : 0,
      };
    })
    .sort((a, b) => Number(b.compatible) - Number(a.compatible) || a.score - b.score);
}

function calculateLoad(allocations: Allocation[], products: PlanningData['products']) {
  const grouped = new Map<string, { quantity: number; productName: string; unit: string }>();

  for (const allocation of allocations) {
    const current = grouped.get(allocation.productId);
    grouped.set(allocation.productId, {
      productName: allocation.productName,
      unit: allocation.unit,
      quantity: (current?.quantity ?? 0) + allocation.quantity,
    });
  }

  const planningIssues: string[] = [];
  const loadBreakdown = [...grouped.entries()].map(([productId, item]) => {
    const product = products.find((candidate) => candidate.id === productId);
    const packageContent = Number(product?.packageContentQuantity ?? 0);
    const unitWeight = Number(product?.averageUnitWeightKg ?? 0);
    if (!product || packageContent <= 0 || unitWeight <= 0) {
      planningIssues.push(
        `${item.productName} precisa ter embalagem, quantidade por embalagem e peso médio preenchidos.`,
      );
    }
    return {
      productId,
      productName: item.productName,
      quantity: round(item.quantity, 3),
      unit: item.unit,
      packageCount: packageContent > 0 ? Math.ceil(item.quantity / packageContent) : 0,
      packagingLabel: product
        ? getPackagingLabel(product.packagingCode, product.packagingLabel)
        : 'Embalagem não informada',
      estimatedWeightKg: unitWeight > 0 ? round(item.quantity * unitWeight, 2) : 0,
    };
  });

  return {
    loadBreakdown,
    planningIssues,
    estimatedLoadWeightKg: round(
      loadBreakdown.reduce((total, item) => total + item.estimatedWeightKg, 0),
      2,
    ),
  };
}

function formatKilograms(value: number) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} kg`;
}

function routeTouchesRoad(ids: string[], locations: Location[], geometry: string) {
  try {
    const parsed = JSON.parse(geometry) as number[][][];
    const roadPoints = parsed.flat().filter((point) => point.length >= 2);
    const routePoints = ids
      .map((id) => locations.find((location) => location.id === id))
      .filter((location): location is Location => Boolean(location))
      .map((location) => [location.longitude, location.latitude]);
    return roadPoints.some(([longitude, latitude]) =>
      routePoints.some(
        ([routeLongitude, routeLatitude]) =>
          Math.hypot(longitude - routeLongitude, latitude - routeLatitude) < 0.025,
      ),
    );
  } catch {
    return false;
  }
}

function meetsRoadRequirements(
  vehicle: PlanningData['vehicles'][number],
  road: PlanningData['roadRestrictions'][number],
) {
  if (road.requiredTraction && vehicle.traction !== road.requiredTraction) return false;
  if (road.maximumAxles && (vehicle.axleCount ?? 2) > road.maximumAxles) return false;
  if (road.maximumVehicleCategory) {
    const order = { CAR: 1, UTILITY: 2, VAN: 3, TRUCK: 4 } as const;
    if (order[vehicle.category] > order[road.maximumVehicleCategory]) return false;
  }
  return true;
}

function haversineCoordinates(lat1: number, lng1: number, lat2: number, lng2: number) {
  return haversine(
    { id: '', type: '', name: '', address: '', latitude: lat1, longitude: lng1 },
    { id: '', type: '', name: '', address: '', latitude: lat2, longitude: lng2 },
  );
}

function allocateFrom(
  available: MutableAvailability[],
  productId: string,
  requested: number,
  sourceType: Allocation['sourceType'],
  requestedProductId: string,
  allocations: Allocation[],
) {
  let remaining = requested;
  for (const source of available.filter(
    (candidate) => candidate.productId === productId && candidate.quantity > 0,
  )) {
    if (remaining <= 0) break;
    const quantity = Math.min(source.quantity, remaining);
    allocations.push({
      sourceType,
      locationId: source.locationId,
      locationName: source.locationName,
      requestedProductId,
      productId,
      productName: source.productName,
      quantity: round(quantity, 1),
      unit: source.unit,
    });
    source.quantity -= quantity;
    remaining -= quantity;
  }
  return Math.max(0, remaining);
}

function nearestNeighbor(ids: string[], locations: Location[], startId: string) {
  const remaining = [...ids];
  const ordered: string[] = [];
  let current = locations.find((location) => location.id === startId);
  while (remaining.length) {
    const next = remaining
      .map((id) => locations.find((location) => location.id === id))
      .filter((location): location is Location => Boolean(location))
      .sort((a, b) => {
        if (!current) return a.name.localeCompare(b.name);
        return haversine(current, a) - haversine(current, b);
      })[0];
    if (!next) break;
    ordered.push(next.id);
    remaining.splice(remaining.indexOf(next.id), 1);
    current = next;
  }
  return ordered;
}

function calculateDistance(ids: string[], locations: Location[]) {
  return ids.slice(1).reduce((total, id, index) => {
    const origin = locations.find((location) => location.id === ids[index]);
    const destination = locations.find((location) => location.id === id);
    return total + (origin && destination ? haversine(origin, destination) : 0);
  }, 0);
}

function haversine(a: Location, b: Location) {
  const earthRadiusKm = 6371;
  const latitude = toRadians(b.latitude - a.latitude);
  const longitude = toRadians(b.longitude - a.longitude);
  const value =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(longitude / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function round(value: number, precision: number) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}
