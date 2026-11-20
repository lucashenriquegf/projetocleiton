import type {
  LogisticsRoute,
  LogisticsRouteStop,
  MapPoint,
} from '@/lib/mocks/operations';

const warningWindowMs = 24 * 60 * 60 * 1000;

export type DeadlineHealth = {
  tone: 'safe' | 'warning' | 'late' | 'unknown';
  label: 'No prazo' | 'Prazo apertado' | 'Atraso previsto' | 'Prazo não informado';
  color: string;
  softColor: string;
  marginMs?: number;
};

export const routeVisualColors = {
  origin: '#2563eb',
  delivery: '#7c3aed',
  deliveryFinal: '#5b21b6',
  traveled: '#0f766e',
  remaining: '#1d4ed8',
  neutral: '#64748b',
} as const;

const deadlineStyles: Record<
  DeadlineHealth['tone'],
  Pick<DeadlineHealth, 'color' | 'softColor'>
> = {
  safe: { color: '#15803d', softColor: '#dcfce7' },
  warning: { color: '#b7791f', softColor: '#fef3c7' },
  late: { color: '#c2413d', softColor: '#fee2e2' },
  unknown: { color: '#64748b', softColor: '#e2e8f0' },
};

export function getRouteStops(route: LogisticsRoute): LogisticsRouteStop[] {
  if (route.stops?.length) return route.stops;

  return route.mapPath.map((position, index) => {
    const last = index === route.mapPath.length - 1;
    return {
      name: last ? route.destination : index === 0 ? route.currentLocation : `Parada ${index + 1}`,
      address: last ? route.region : 'Endereço cadastrado no roteiro',
      items: last ? 'Entrega programada' : 'Coleta programada',
      kind: last ? 'delivery' : index === 0 ? 'origin' : 'pickup',
      placeType: last ? 'school' : index === 0 ? 'base' : 'farm',
      position,
    };
  });
}

export function getDeliveryStops(route: LogisticsRoute) {
  return getRouteStops(route)
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => stop.kind === 'delivery');
}

export function getLastDelivery(route: LogisticsRoute) {
  return getDeliveryStops(route).at(-1);
}

export function getNextDelivery(route: LogisticsRoute) {
  return getDeliveryStops(route).find(
    ({ index }) => index >= route.completedStops,
  );
}

export function getRemainingDeliveryCount(route: LogisticsRoute) {
  return getDeliveryStops(route).filter(
    ({ index }) => index >= route.completedStops,
  ).length;
}

export function getRoutePathToFinalDelivery(route: LogisticsRoute) {
  const lastDelivery = getLastDelivery(route);
  if (!lastDelivery) return route.mapPath;
  return route.mapPath.slice(0, lastDelivery.index + 1);
}

export function getRouteProgress(route: LogisticsRoute) {
  if (route.status === 'Concluída') return 100;
  if (route.status === 'Planejada' || !route.mapPosition) return 0;

  const routePath = getRoutePathToFinalDelivery(route);
  const totalDistance = pathDistance(routePath);
  if (totalDistance <= 0) return 0;

  const traveledDistance = route.traveledPath?.length
    ? pathDistance(route.traveledPath)
    : distanceAlongPath(routePath, route.mapPosition);

  return Math.round(clamp((traveledDistance / totalDistance) * 100, 0, 100));
}

export function getDeadlineHealth(route: LogisticsRoute): DeadlineHealth {
  const margins = getDeliveryStops(route)
    .filter(({ index }) => index >= route.completedStops)
    .flatMap(({ stop }) => {
      if (!stop.estimatedArrivalAt || !stop.deadlineAt) return [];
      const estimated = Date.parse(stop.estimatedArrivalAt);
      const deadline = Date.parse(stop.deadlineAt);
      return Number.isFinite(estimated) && Number.isFinite(deadline)
        ? [deadline - estimated]
        : [];
    });

  if (!margins.length) {
    return {
      tone: 'unknown',
      label: 'Prazo não informado',
      ...deadlineStyles.unknown,
    };
  }

  const marginMs = Math.min(...margins);
  if (marginMs < 0) {
    return {
      tone: 'late',
      label: 'Atraso previsto',
      marginMs,
      ...deadlineStyles.late,
    };
  }
  if (marginMs < warningWindowMs) {
    return {
      tone: 'warning',
      label: 'Prazo apertado',
      marginMs,
      ...deadlineStyles.warning,
    };
  }
  return {
    tone: 'safe',
    label: 'No prazo',
    marginMs,
    ...deadlineStyles.safe,
  };
}

export function formatRouteDateTime(value?: string) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
    .format(date)
    .replace('.', '');
}

function distanceAlongPath(path: MapPoint[], point: MapPoint) {
  if (path.length < 2) return 0;

  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let bestProgress = 0;
  let accumulated = 0;

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentDistance = distanceBetween(start, end);
    const projection = projectOnSegment(point, start, end);

    if (projection.distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = projection.distanceSquared;
      bestProgress = accumulated + segmentDistance * projection.ratio;
    }
    accumulated += segmentDistance;
  }

  return bestProgress;
}

function projectOnSegment(point: MapPoint, start: MapPoint, end: MapPoint) {
  const latitudeScale = Math.cos(
    (((start.lat + end.lat + point.lat) / 3) * Math.PI) / 180,
  );
  const startX = start.lng * latitudeScale;
  const startY = start.lat;
  const endX = end.lng * latitudeScale;
  const endY = end.lat;
  const pointX = point.lng * latitudeScale;
  const pointY = point.lat;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const squaredLength = deltaX ** 2 + deltaY ** 2;
  const ratio = squaredLength
    ? clamp(
        ((pointX - startX) * deltaX + (pointY - startY) * deltaY) /
          squaredLength,
        0,
        1,
      )
    : 0;
  const projectedX = startX + deltaX * ratio;
  const projectedY = startY + deltaY * ratio;

  return {
    ratio,
    distanceSquared:
      (pointX - projectedX) ** 2 + (pointY - projectedY) ** 2,
  };
}

function pathDistance(path: MapPoint[]) {
  return path.slice(1).reduce(
    (total, point, index) => total + distanceBetween(path[index], point),
    0,
  );
}

function distanceBetween(first: MapPoint, second: MapPoint) {
  const earthRadiusKm = 6371;
  const latitude = toRadians(second.lat - first.lat);
  const longitude = toRadians(second.lng - first.lng);
  const value =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(longitude / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
