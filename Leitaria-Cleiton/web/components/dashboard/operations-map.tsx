'use client';

import { LocateFixed, Map as MapIcon, RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type {
  LogisticsRoute,
  LogisticsRouteStop,
  MapPoint,
} from '@/lib/mocks/operations';
import {
  formatRouteDateTime,
  getDeadlineHealth,
  getDeliveryStops,
  getLastDelivery,
  getRoutePathToFinalDelivery,
  getRouteProgress,
  getRouteStops,
  routeVisualColors,
} from '@/lib/route-visuals';

type LeafletModule = typeof import('leaflet');
type RoadRoute = {
  coordinates: import('leaflet').LatLng[];
  waypoints?: import('leaflet').LatLng[];
};
type RoadRouteState =
  | { status: 'loading' }
  | { status: 'ready'; route: RoadRoute }
  | { status: 'error' };

const roadRouteCache = new Map<string, Promise<RoadRoute | null>>();
const roadRouteQueue: Array<() => void> = [];
let activeRoadRouteRequests = 0;
const maxConcurrentRoadRouteRequests = 3;
const demoOperationStartedAt = Date.now();
const demoOperationClockStart = Date.parse('2026-09-08T08:45:00-03:00');

export function OperationsMap({
  routes,
  selectedRoute,
  onSelectRoute,
  showChrome = true,
  ariaLabel,
}: {
  routes: LogisticsRoute[];
  selectedRoute?: LogisticsRoute;
  onSelectRoute: (routeId: string) => void;
  showChrome?: boolean;
  ariaLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const routeLayersRef = useRef<import('leaflet').LayerGroup | null>(null);
  const hasAutoFittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [tileProblem, setTileProblem] = useState(false);
  const [roadRoutes, setRoadRoutes] = useState<Record<string, RoadRouteState>>(
    {},
  );
  const [retryVersion, setRetryVersion] = useState(0);
  const [operationalNow, setOperationalNow] = useState(() =>
    getOperationalNow(),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setOperationalNow(getOperationalNow());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let resizeFrame = 0;
    let resizeObserver: ResizeObserver | undefined;

    void import('leaflet').then((module) => {
      if (!active || !containerRef.current) return;

      const L = ((module as LeafletModule & { default?: LeafletModule })
        .default ?? module) as LeafletModule;
      const map = L.map(containerRef.current, {
        attributionControl: true,
        doubleClickZoom: true,
        dragging: true,
        keyboard: true,
        minZoom: 6,
        maxZoom: 16,
        fadeAnimation: false,
        markerZoomAnimation: false,
        preferCanvas: true,
        scrollWheelZoom: true,
        tapHold: true,
        touchZoom: true,
        zoomControl: false,
        zoomAnimation: false,
      }).setView([-16.35, -49.55], 8);

      const tiles = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        },
      );

      tiles.on('tileerror', () => setTileProblem(true));
      tiles.on('load', () => setTileProblem(false));
      tiles.addTo(map);
      L.control.zoom({ position: 'topright' }).addTo(map);

      const syncStopDetailsWithZoom = () => {
        const zoom = map.getZoom();
        const container = map.getContainer();
        container.classList.toggle('show-route-next-deadline', zoom >= 13);
        container.classList.toggle('show-route-stop-names', zoom >= 15);
        container.classList.toggle('show-route-stop-details', zoom >= 16);
        scheduleStopCardLayout(map);
      };
      map.on('zoomend', syncStopDetailsWithZoom);
      map.on('moveend', () => scheduleStopCardLayout(map));
      syncStopDetailsWithZoom();

      Object.assign(window, { L });
      leafletRef.current = L;
      mapRef.current = map;
      routeLayersRef.current = L.layerGroup().addTo(map);
      setReady(true);

      resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          map.invalidateSize({ animate: false, pan: false });
          scheduleStopCardLayout(map);
        });
      });
      resizeObserver.observe(containerRef.current);

      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      active = false;
      resizeObserver?.disconnect();
      cancelAnimationFrame(resizeFrame);
      routeLayersRef.current = null;
      leafletRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const L = leafletRef.current;
    if (!ready || !L) return;

    const routesToLocate = uniqueRoutes(routes, selectedRoute).filter(
      (route) => route.mapPosition && getRoutePathToFinalDelivery(route).length,
    );

    setRoadRoutes((current) => {
      const next = { ...current };
      routesToLocate.forEach((route) => {
        const cacheKey = getRoadRouteCacheKey(route);
        next[cacheKey] ??= { status: 'loading' };
      });
      return next;
    });

    routesToLocate.forEach((route) => {
      const cacheKey = getRoadRouteCacheKey(route);
      const currentState = roadRoutes[cacheKey];
      if (currentState?.status === 'ready' || currentState?.status === 'error') {
        return;
      }

      void getCachedRoadRoute(L, route, cacheKey).then((roadRoute) => {
        if (cancelled) return;
        setRoadRoutes((current) => ({
          ...current,
          [cacheKey]: roadRoute
            ? { status: 'ready', route: roadRoute }
            : { status: 'error' },
        }));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [ready, retryVersion, routes, selectedRoute]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layerGroup = routeLayersRef.current;
    if (!ready || !L || !map || !layerGroup) return;

    layerGroup.clearLayers();
    const closeStopTooltips = () => {
      layerGroup.eachLayer((layer) => {
        if (!('closeTooltip' in layer)) return;
        (layer as { closeTooltip: () => unknown }).closeTooltip();
      });
    };
    map.on('click', closeStopTooltips);

    if (selectedRoute) {
      const selectedRouteLayer = L.layerGroup().addTo(layerGroup);
      const selectCurrentRoute = () => onSelectRoute(selectedRoute.id);
      const roadRouteState = roadRoutes[getRoadRouteCacheKey(selectedRoute)];

      if (roadRouteState?.status === 'ready') {
        drawRouteGeometry(
          L,
          selectedRouteLayer,
          selectedRoute,
          roadRouteState.route.coordinates,
          roadRouteState.route.waypoints,
          selectCurrentRoute,
          true,
          operationalNow,
        );
      } else {
        const fallbackPoints = getRoutePathToFinalDelivery(selectedRoute).map(
          toLatLng,
        );
        drawRouteGeometry(
          L,
          selectedRouteLayer,
          selectedRoute,
          fallbackPoints,
          undefined,
          selectCurrentRoute,
          false,
          operationalNow,
        );
      }
    }

    routes.forEach((route) => {
      if (!route.mapPosition || route.id === selectedRoute?.id) return;
      const roadRouteState = roadRoutes[getRoadRouteCacheKey(route)];
      if (roadRouteState?.status !== 'ready') return;

      const truckPosition = splitPolylineAtProgress(
        L,
        roadRouteState.route.coordinates,
        getRouteProgress(route),
      ).position;
      if (!truckPosition) return;

      drawTruckMarker(L, layerGroup, route, truckPosition, false, () => {
        onSelectRoute(route.id);
      });
    });

    if (!hasAutoFittedRef.current) {
      hasAutoFittedRef.current = true;
      requestAnimationFrame(() =>
        fitMapToRoutes(L, map, routes, selectedRoute),
      );
    }

    scheduleStopCardLayout(map);
    return () => {
      map.off('click', closeStopTooltips);
    };
  }, [
    onSelectRoute,
    operationalNow,
    ready,
    roadRoutes,
    routes,
    selectedRoute,
  ]);

  const showAllRoutes = () => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    fitMapToRoutes(L, map, routes, selectedRoute);
  };

  const routesToLocate = uniqueRoutes(routes, selectedRoute).filter(
    (route) => route.mapPosition && getRoutePathToFinalDelivery(route).length,
  );
  const locatingCount = routesToLocate.filter((route) => {
    const state = roadRoutes[getRoadRouteCacheKey(route)];
    return !state || state.status === 'loading';
  }).length;
  const failedRoutes = routesToLocate.filter(
    (route) => roadRoutes[getRoadRouteCacheKey(route)]?.status === 'error',
  );
  const selectedRoadRouteState = selectedRoute
    ? roadRoutes[getRoadRouteCacheKey(selectedRoute)]
    : undefined;
  const routingMessage = selectedRoute
    ? selectedRoadRouteState?.status === 'error'
      ? 'Trajeto aproximado — posição ainda não confirmada'
      : selectedRoadRouteState?.status !== 'ready'
        ? 'Ajustando o trajeto às estradas…'
        : null
    : locatingCount
      ? `Localizando ${locatingCount} ${locatingCount === 1 ? 'caminhão' : 'caminhões'}…`
      : null;

  const retryFailedRoutes = () => {
    if (!failedRoutes.length) return;
    const failedKeys = new Set(
      failedRoutes.map((route) => getRoadRouteCacheKey(route)),
    );
    failedKeys.forEach((cacheKey) => roadRouteCache.delete(cacheKey));
    setRoadRoutes((current) => {
      const next = { ...current };
      failedKeys.forEach((cacheKey) => {
        next[cacheKey] = { status: 'loading' };
      });
      return next;
    });
    setRetryVersion((current) => current + 1);
  };

  return (
    <figure
      className="absolute inset-0 isolate overflow-hidden bg-[#dce7df]"
      aria-label={
        ariaLabel ??
        `Mapa interativo com ${routes.length} ${routes.length === 1 ? 'caminhão visível' : 'caminhões visíveis'}`
      }
    >
      <div
        ref={containerRef}
        className="operations-leaflet-map"
        role="application"
        aria-label="Arraste o mapa para navegar e use os controles para aproximar ou afastar"
      />

      {!ready ? (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-[#e5ece7]">
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium shadow-lg">
            <MapIcon aria-hidden="true" className="size-5 text-primary" />
            Preparando o mapa…
          </div>
        </div>
      ) : null}

      {showChrome ? (
        <>
          <div className="pointer-events-none absolute left-3 top-3 z-[450] sm:left-4 sm:top-4">
            <div className="rounded-xl border border-white/85 bg-white/94 px-3 py-2.5 shadow-[0_8px_24px_rgba(18,40,30,.13)] backdrop-blur">
              {selectedRoute ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-5 rounded-full bg-[#0f766e]" />
                    Percorrido
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0 w-5 border-t-[3px] border-dashed border-[#1d4ed8]" />
                    A percorrer
                  </span>
                  <span>
                    {getDeliveryStops(selectedRoute).length}{' '}
                    {getDeliveryStops(selectedRoute).length === 1
                      ? 'escola'
                      : 'escolas'}
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#26352d]">
                    {routes.length} no mapa
                  </p>
                  <p className="mt-0.5 max-w-64 text-xs text-muted-foreground">
                    Clique em um caminhão para ver a rota
                  </p>
                </>
              )}
              {routingMessage ? (
                <p
                  className="mt-2 border-t border-border/70 pt-2 text-xs text-muted-foreground"
                  aria-live="polite"
                >
                  {routingMessage}
                </p>
              ) : null}
              {failedRoutes.length ? (
                <div className="mt-2 flex items-center gap-2 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                  <span aria-live="polite">
                    Posição ainda não confirmada para {failedRoutes.length}{' '}
                    {failedRoutes.length === 1 ? 'caminhão' : 'caminhões'}.
                  </span>
                  <button
                    type="button"
                    onClick={retryFailedRoutes}
                    className="pointer-events-auto inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 font-semibold text-primary hover:bg-primary-soft"
                  >
                    <RefreshCw aria-hidden="true" className="size-3.5" />
                    Tentar novamente
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={showAllRoutes}
            className="absolute right-3 top-[7.15rem] z-[450] grid size-11 place-items-center rounded-xl border border-white/85 bg-white text-[#26352d] shadow-[0_8px_24px_rgba(18,40,30,.16)] transition-colors hover:bg-[#f3f7f4] sm:right-4"
            aria-label="Mostrar toda a rota no mapa"
            title="Mostrar toda a rota"
          >
            <LocateFixed aria-hidden="true" className="size-5" />
          </button>
        </>
      ) : null}

      {!showChrome && (locatingCount || failedRoutes.length) ? (
        <div className="absolute left-1/2 top-[5.25rem] z-[450] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-white/85 bg-white/95 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg">
          <span aria-live="polite">
            {failedRoutes.length
              ? 'Posição ainda não confirmada.'
              : `Localizando ${locatingCount} ${locatingCount === 1 ? 'caminhão' : 'caminhões'}…`}
          </span>
          {failedRoutes.length ? (
            <button
              type="button"
              onClick={retryFailedRoutes}
              className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 font-semibold text-primary hover:bg-primary-soft"
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Tentar novamente
            </button>
          ) : null}
        </div>
      ) : null}

      {tileProblem ? (
        <div className="absolute bottom-4 left-1/2 z-[450] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-warning-text/20 bg-warning-bg px-3 py-2 text-sm font-medium text-warning-text shadow-lg">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          O fundo do mapa está demorando para carregar. As rotas continuam
          disponíveis.
        </div>
      ) : null}
    </figure>
  );
}

function uniqueRoutes(
  routes: LogisticsRoute[],
  selectedRoute?: LogisticsRoute,
) {
  const unique = new Map(routes.map((route) => [route.id, route]));
  if (selectedRoute) unique.set(selectedRoute.id, selectedRoute);
  return [...unique.values()];
}

function getRoadRouteCacheKey(route: LogisticsRoute) {
  const points = getRoutePathToFinalDelivery(route)
    .map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`)
    .join(';');
  return `${route.id}:${points}`;
}

function getCachedRoadRoute(
  L: LeafletModule,
  route: LogisticsRoute,
  cacheKey: string,
) {
  const cached = roadRouteCache.get(cacheKey);
  if (cached) return cached;

  const request = scheduleRoadRouteRequest(() => calculateRoadRoute(L, route));
  roadRouteCache.set(cacheKey, request);
  void request.then((roadRoute) => {
    if (!roadRoute) roadRouteCache.delete(cacheKey);
  });
  return request;
}

function scheduleRoadRouteRequest(task: () => Promise<RoadRoute | null>) {
  return new Promise<RoadRoute | null>((resolve) => {
    const run = () => {
      activeRoadRouteRequests += 1;
      void task()
        .then(resolve)
        .catch(() => resolve(null))
        .finally(() => {
          activeRoadRouteRequests -= 1;
          roadRouteQueue.shift()?.();
        });
    };

    if (activeRoadRouteRequests < maxConcurrentRoadRouteRequests) run();
    else roadRouteQueue.push(run);
  });
}

async function calculateRoadRoute(
  L: LeafletModule,
  route: LogisticsRoute,
): Promise<RoadRoute | null> {
  try {
    await import('leaflet-routing-machine');
    const router: import('leaflet').Routing.IRouter = L.Routing.osrmv1({
      language: 'pt-BR',
      profile: 'driving',
      serviceUrl: 'https://router.project-osrm.org/route/v1',
      suppressDemoServerWarning: true,
      timeout: 20_000,
    });
    const waypoints = getRoutePathToFinalDelivery(route).map((point) =>
      L.Routing.waypoint(L.latLng(point.lat, point.lng)),
    );

    return await new Promise((resolve) => {
      router.route(waypoints, (error, alternatives) => {
        const bestRoute = alternatives?.[0];
        if (error || !bestRoute?.coordinates?.length) {
          resolve(null);
          return;
        }
        resolve({
          coordinates: bestRoute.coordinates,
          waypoints: normalizeRoutedWaypoints(bestRoute.waypoints),
        });
      });
    });
  } catch {
    return null;
  }
}

function normalizeRoutedWaypoints(
  points: import('leaflet').LatLng[] | undefined,
): import('leaflet').LatLng[] | undefined {
  if (!points) return undefined;

  return (points as unknown[]).flatMap((point) => {
    if (!point || typeof point !== 'object') return [];
    if ('latLng' in point) {
      const latLng = (point as { latLng?: import('leaflet').LatLng }).latLng;
      return latLng ? [latLng] : [];
    }
    if ('lat' in point && 'lng' in point) {
      return [point as import('leaflet').LatLng];
    }
    return [];
  });
}

function drawRouteGeometry(
  L: LeafletModule,
  layerGroup: import('leaflet').LayerGroup,
  route: LogisticsRoute,
  points: import('leaflet').LatLngExpression[],
  snappedWaypoints?: import('leaflet').LatLng[],
  onSelectRoute?: () => void,
  showTruck = true,
  operationalNow = getOperationalNow(),
) {
  const progress = getRouteProgress(route);
  const { traveled, remaining, position } = splitPolylineAtProgress(
    L,
    points,
    progress,
  );

  L.polyline(points, {
    color: '#ffffff',
    opacity: 0.94,
    weight: 13,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(layerGroup);

  if (remaining.length > 1) {
    L.polyline(remaining, {
      color: routeVisualColors.remaining,
      dashArray: '8 10',
      opacity: 0.88,
      weight: 7,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layerGroup);
  }

  if (traveled.length > 1) {
    L.polyline(traveled, {
      color: routeVisualColors.traveled,
      opacity: 1,
      weight: 8,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layerGroup);
  }

  drawRouteStops(L, layerGroup, route, snappedWaypoints, operationalNow);

  if (showTruck && route.mapPosition && position) {
    drawTruckMarker(
      L,
      layerGroup,
      route,
      position,
      true,
      onSelectRoute,
    );
  }
}

function drawRouteStops(
  L: LeafletModule,
  layerGroup: import('leaflet').LayerGroup,
  route: LogisticsRoute,
  snappedWaypoints?: import('leaflet').LatLng[],
  operationalNow = getOperationalNow(),
) {
  const stops = getRouteStops(route);
  const lastDelivery = getLastDelivery(route);
  const finalIndex = lastDelivery?.index ?? stops.length - 1;
  const deliveryStops = getDeliveryStops(route);
  const nextPendingIndex = stops.findIndex(
    (stop, index) =>
      index >= Math.max(route.completedStops, 1) &&
      stop.kind !== 'origin' &&
      stop.kind !== 'return',
  );

  stops.slice(0, finalIndex + 1).forEach((stop, index) => {
    const done = index < route.completedStops;
    const next =
      index === nextPendingIndex && route.status !== 'Concluída';
    const markerPosition =
      snappedWaypoints?.[index] ?? toLatLng(stop.position);
    const deliveryIndex =
      stop.kind === 'delivery'
        ? deliveryStops.findIndex((delivery) => delivery.index === index) + 1
        : undefined;
    const finalDelivery = index === lastDelivery?.index;
    const label = getStopLabel(stop, deliveryIndex, finalDelivery, next);
    const marker = L.marker(markerPosition, {
      icon: createStopMarkerIcon(L, stop, {
        index,
        done,
        next,
        deliveryIndex,
        finalDelivery,
      }, operationalNow),
      keyboard: true,
      riseOnHover: true,
      title: `${label}: ${stop.name}`,
    }).addTo(layerGroup);

    marker.bindTooltip(createStopTooltip(stop, label), {
      className: `route-endpoint-label route-endpoint-label--${getStopPlaceType(stop)}`,
      direction: 'auto',
      offset: [10, 0],
      opacity: 1,
      permanent: false,
    });
    enableTooltipOnDemand(marker, layerGroup);
    setMarkerAccessibility(
      marker,
      `${label}: ${stop.name}. ${stop.address}. ${getStopTimingLabel(stop)} ${formatRouteDateTime(stop.deadlineAt)}. ${getStopItemsLabel(stop)}: ${stop.items}.`,
    );
  });
}

function getStopLabel(
  stop: LogisticsRouteStop,
  deliveryIndex?: number,
  finalDelivery = false,
  next = false,
) {
  if (stop.kind === 'origin') return 'Saída';
  if (stop.kind === 'delivery') {
    return finalDelivery ? 'Última entrega' : `Entrega ${deliveryIndex}`;
  }
  if (stop.kind === 'return') return 'Retorno';
  return next ? 'Próxima coleta' : 'Coleta';
}

function getStopPlaceType(stop: LogisticsRouteStop) {
  return (
    stop.placeType ??
    (stop.kind === 'delivery'
      ? 'school'
      : stop.kind === 'pickup'
        ? 'farm'
        : 'base')
  );
}

function getStopTimingLabel(stop: LogisticsRouteStop) {
  if (stop.kind === 'delivery') return 'Entregar até';
  if (stop.kind === 'pickup') return 'Coletar até';
  if (stop.kind === 'origin') return 'Sair até';
  return 'Previsão';
}

function getStopItemsLabel(stop: LogisticsRouteStop) {
  if (stop.kind === 'delivery') return 'Entregar';
  if (stop.kind === 'origin' || getStopPlaceType(stop) === 'warehouse') {
    return 'Retirar';
  }
  return 'Buscar';
}

function createTruckIcon(
  L: LeafletModule,
  route: LogisticsRoute,
  selected: boolean,
) {
  const health = getDeadlineHealth(route);
  const progress = getRouteProgress(route);
  const label = escapeHtml(route.driver.split(' ')[0]);
  return L.divIcon({
    className: 'route-marker-shell',
    html: `
      <div class="route-marker${selected ? ' is-selected' : ''}" style="--route-color:${health.color};--route-soft:${health.softColor}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 17h4V5H2v12h3" />
          <path d="M14 9h4l4 4v4h-3" />
          <circle cx="7.5" cy="17.5" r="2.5" />
          <circle cx="16.5" cy="17.5" r="2.5" />
        </svg>
        <span class="route-marker-label">
          <span>${label}</span>
          <strong>${progress}%</strong>
        </span>
      </div>`,
    iconAnchor: [24, 56],
    iconSize: [52, 58],
  });
}

function drawTruckMarker(
  L: LeafletModule,
  layerGroup: import('leaflet').LayerGroup,
  route: LogisticsRoute,
  position: import('leaflet').LatLngExpression,
  selected: boolean,
  onSelectRoute?: () => void,
) {
  const deadlineHealth = getDeadlineHealth(route);
  const progress = getRouteProgress(route);
  const marker = L.marker(position, {
    icon: createTruckIcon(L, route, selected),
    keyboard: Boolean(onSelectRoute),
    riseOnHover: true,
    title: `${route.driver} — ${progress}% percorrido — ${deadlineHealth.label}`,
  }).addTo(layerGroup);

  if (onSelectRoute) marker.on('click', onSelectRoute);
  marker.on('add', () => {
    const element = marker.getElement();
    if (!element) return;
    element.setAttribute('role', onSelectRoute ? 'button' : 'img');
    element.setAttribute(
      'aria-label',
      `${route.driver}, ${route.name}, ${progress}% percorrido, ${deadlineHealth.label}. ${route.currentLocation}`,
    );
    if (selected) element.setAttribute('aria-current', 'true');
  });

  return marker;
}

function fitMapToRoutes(
  L: LeafletModule,
  map: import('leaflet').Map,
  routes: LogisticsRoute[],
  selectedRoute?: LogisticsRoute,
) {
  const points = selectedRoute
    ? [
        ...getRoutePathToFinalDelivery(selectedRoute),
        ...(selectedRoute.mapPosition ? [selectedRoute.mapPosition] : []),
      ]
    : routes.flatMap((route) => (route.mapPosition ? [route.mapPosition] : []));

  if (points.length === 0) {
    map.setView([-16.35, -49.55], 8);
    return;
  }

  fitMapToCoordinates(L, map, points.map(toLatLng), Boolean(selectedRoute));
}

function createStopMarkerIcon(
  L: LeafletModule,
  stop: LogisticsRouteStop,
  state: {
    index: number;
    done: boolean;
    next: boolean;
    deliveryIndex?: number;
    finalDelivery: boolean;
  },
  operationalNow: number,
) {
  const placeType = getStopPlaceType(stop);
  const nameSide = state.index % 2 === 0 ? 'right' : 'left';
  const cardSide = state.index % 2 === 0 ? 'right' : 'left';
  const cardLane = ['center', 'upper', 'lower'][state.index % 3];
  const stateClass = state.next ? ' is-next' : state.done ? ' is-done' : '';
  const deadline = state.next
    ? getDeadlineCountdown(stop.deadlineAt, operationalNow)
    : undefined;
  const deliveryBadge = state.deliveryIndex
    ? `<span class="route-stop-order">${state.deliveryIndex}</span>`
    : '';
  const finalFlag = state.finalDelivery
    ? '<span class="route-stop-final-flag" aria-hidden="true">⚑</span>'
    : '';

  return L.divIcon({
    className: 'route-point-marker-shell',
    html: `
      <span class="route-stop-marker route-stop-marker--${placeType}${stateClass}">
        ${getPlaceIconSvg(placeType)}
        ${deliveryBadge}
        ${finalFlag}
      </span>
      <span class="route-stop-name route-stop-name--${nameSide}">${escapeHtml(stop.name)}</span>
      ${deadline ? `<span class="route-stop-deadline" style="--deadline-color:${deadline.color};--deadline-bg:${deadline.background}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${escapeHtml(deadline.label)}</span>` : ''}
      <span class="route-stop-card route-stop-card--${cardSide} route-stop-card--${cardLane}">
        <strong>${escapeHtml(stop.name)}</strong>
        ${stop.deadlineAt ? `<small>${getStopTimingLabel(stop)} ${escapeHtml(formatRouteDateTime(stop.deadlineAt))}</small>` : ''}
        <span><b>${getStopItemsLabel(stop)}:</b> ${escapeHtml(stop.items)}</span>
      </span>`,
    iconAnchor: [20, 20],
    iconSize: [40, 40],
  });
}

function getPlaceIconSvg(placeType: ReturnType<typeof getStopPlaceType>) {
  const paths = {
    warehouse:
      '<path d="M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11"/><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z"/><path d="M6 13h12"/><path d="M6 17h12"/>',
    farm: '<path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/><path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/><path d="M7 15h.01"/><path d="M8 10.1V4"/><circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/>',
    school:
      '<path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M18 4.933V21"/><path d="m4 6 7.106-3.79a2 2 0 0 1 1.788 0L20 6"/><path d="m6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11"/><path d="M6 4.933V21"/><circle cx="12" cy="9" r="2"/>',
    base: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  }[placeType];

  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function createStopTooltip(
  stop: ReturnType<typeof getRouteStops>[number],
  label: string,
) {
  return `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(stop.name)}</span><small>${escapeHtml(stop.address)}</small>${stop.estimatedArrivalAt ? `<small>Previsão: ${escapeHtml(formatRouteDateTime(stop.estimatedArrivalAt))}</small>` : ''}${stop.deadlineAt ? `<small>${getStopTimingLabel(stop)}: ${escapeHtml(formatRouteDateTime(stop.deadlineAt))}</small>` : ''}<small><b>${getStopItemsLabel(stop)}:</b> ${escapeHtml(stop.items)}</small>`;
}

function enableTooltipOnDemand(
  marker: import('leaflet').Path | import('leaflet').Marker,
  layerGroup: import('leaflet').LayerGroup,
) {
  const openOnlyThisTooltip = () => {
    layerGroup.eachLayer((layer) => {
      if (layer === marker || !('closeTooltip' in layer)) return;
      (layer as { closeTooltip: () => unknown }).closeTooltip();
    });
    marker.openTooltip();
  };

  marker.on('click', openOnlyThisTooltip);
  marker.on('mouseover', openOnlyThisTooltip);
  marker.on('add', () => {
    const element = marker.getElement();
    element?.addEventListener('focus', openOnlyThisTooltip);
    element?.addEventListener('blur', () => marker.closeTooltip());
  });
}

function setMarkerAccessibility(
  marker: import('leaflet').Marker,
  ariaLabel: string,
) {
  marker.on('add', () => {
    const element = marker.getElement();
    if (!element) return;
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', ariaLabel);
  });
}

function splitPolylineAtProgress(
  L: LeafletModule,
  points: import('leaflet').LatLngExpression[],
  progress: number,
) {
  const latLngs = points.map((point) => L.latLng(point));
  if (latLngs.length === 0) {
    return { traveled: [], remaining: [], position: undefined };
  }
  if (latLngs.length === 1 || progress <= 0) {
    return { traveled: [], remaining: latLngs, position: latLngs[0] };
  }
  if (progress >= 100) {
    return {
      traveled: latLngs,
      remaining: [],
      position: latLngs.at(-1),
    };
  }

  const distances = latLngs.slice(1).map((point, index) =>
    latLngs[index].distanceTo(point),
  );
  const totalDistance = distances.reduce((total, distance) => total + distance, 0);
  const targetDistance = totalDistance * (progress / 100);
  let accumulated = 0;

  for (let index = 0; index < distances.length; index += 1) {
    const segmentDistance = distances[index];
    if (accumulated + segmentDistance < targetDistance) {
      accumulated += segmentDistance;
      continue;
    }

    const start = latLngs[index];
    const end = latLngs[index + 1];
    const ratio = segmentDistance
      ? (targetDistance - accumulated) / segmentDistance
      : 0;
    const splitPoint = L.latLng(
      start.lat + (end.lat - start.lat) * ratio,
      start.lng + (end.lng - start.lng) * ratio,
    );

    return {
      traveled: [...latLngs.slice(0, index + 1), splitPoint],
      remaining: [splitPoint, ...latLngs.slice(index + 1)],
      position: splitPoint,
    };
  }

  return {
    traveled: latLngs,
    remaining: [],
    position: latLngs.at(-1),
  };
}

function fitMapToCoordinates(
  L: LeafletModule,
  map: import('leaflet').Map,
  points: import('leaflet').LatLngExpression[],
  selected: boolean,
) {
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds, {
    animate: false,
    maxZoom: selected ? 11 : 9,
    paddingTopLeft: [44, 64],
    paddingBottomRight: [44, 64],
  });
}

function scheduleStopCardLayout(map: import('leaflet').Map) {
  requestAnimationFrame(() => {
    if (map.getZoom() < 16) return;
    const container = map.getContainer();
    const mapBounds = container.getBoundingClientRect();
    const allCards = [
      ...container.querySelectorAll<HTMLElement>('.route-stop-card'),
    ];
    const cards = allCards.filter((card) => {
      const marker = card.closest<HTMLElement>('.leaflet-marker-icon');
      const markerBounds = marker?.getBoundingClientRect();
      const visible = Boolean(
        markerBounds &&
          markerBounds.right >= mapBounds.left &&
          markerBounds.left <= mapBounds.right &&
          markerBounds.bottom >= mapBounds.top &&
          markerBounds.top <= mapBounds.bottom,
      );
      card.classList.toggle('is-offscreen', !visible);
      return visible;
    });
    if (!cards.length) return;

    cards.forEach((card) => {
      card.style.removeProperty('--card-offset-y');
      const bounds = card.getBoundingClientRect();
      if (bounds.right > mapBounds.right - 10) {
        card.classList.remove('route-stop-card--right');
        card.classList.add('route-stop-card--left');
      } else if (bounds.left < mapBounds.left + 10) {
        card.classList.remove('route-stop-card--left');
        card.classList.add('route-stop-card--right');
      }
    });

    (['left', 'right'] as const).forEach((side) => {
      const sideCards = cards
        .filter((card) => card.classList.contains(`route-stop-card--${side}`))
        .map((card) => ({ card, bounds: card.getBoundingClientRect() }))
        .sort((first, second) => first.bounds.top - second.bounds.top);
      if (!sideCards.length) return;

      const gap = 8;
      const minimumTop = mapBounds.top + 68;
      const maximumBottom = mapBounds.bottom - 12;
      let cursor = minimumTop;
      const placements = sideCards.map(({ card, bounds }) => {
        const top = Math.max(bounds.top, cursor);
        cursor = top + bounds.height + gap;
        return { card, bounds, top };
      });
      const overflow = Math.max(0, cursor - gap - maximumBottom);
      const firstTop = placements[0].top - overflow;
      const correction = firstTop < minimumTop ? minimumTop - firstTop : 0;

      placements.forEach(({ card, bounds, top }) => {
        const offset = top - overflow + correction - bounds.top;
        card.style.setProperty('--card-offset-y', `${Math.round(offset)}px`);
      });
    });
  });
}

function getDeadlineCountdown(deadlineAt: string | undefined, now: number) {
  if (!deadlineAt) return undefined;
  const deadline = Date.parse(deadlineAt);
  if (!Number.isFinite(deadline)) return undefined;

  const remainingMs = deadline - now;
  const duration = formatCompactDuration(Math.abs(remainingMs));
  if (remainingMs < 0) {
    return {
      label: `Atrasada há ${duration}`,
      color: '#b42318',
      background: '#fff1f0',
    };
  }
  if (remainingMs <= 2 * 60 * 60 * 1000) {
    return {
      label: `Prazo em ${duration}`,
      color: '#9a6700',
      background: '#fff8db',
    };
  }
  return {
    label: `Prazo em ${duration}`,
    color: '#237804',
    background: '#f1f8e9',
  };
}

function formatCompactDuration(durationMs: number) {
  const totalMinutes = Math.max(1, Math.ceil(durationMs / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes ? `${totalHours}h${String(minutes).padStart(2, '0')}` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

function getOperationalNow() {
  return demoOperationClockStart + (Date.now() - demoOperationStartedAt);
}

function toLatLng(point: MapPoint): [number, number] {
  return [point.lat, point.lng];
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
