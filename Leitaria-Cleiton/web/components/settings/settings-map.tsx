'use client';

import { Map } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type LeafletModule = typeof import('leaflet');
export type SettingsMapPoint = { lat: number; lng: number };
type Point = SettingsMapPoint;

const initialPoint: Point = { lat: -16.35742, lng: -49.49681 };
export function SettingsMap({
  mode,
  onPointChange,
  point = initialPoint,
  roadPoints = [],
  onRoadPointsChange,
}: {
  mode: 'point' | 'road';
  onPointChange?: (point: Point) => void;
  point?: Point;
  roadPoints?: Point[];
  onRoadPointsChange?: (points: Point[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPointChangeRef = useRef(onPointChange);
  const onRoadPointsChangeRef = useRef(onRoadPointsChange);
  const [ready, setReady] = useState(false);

  onPointChangeRef.current = onPointChange;
  onRoadPointsChangeRef.current = onRoadPointsChange;

  useEffect(() => {
    let disposed = false;
    let map: import('leaflet').Map | undefined;

    void import('leaflet').then(async (module) => {
      if (disposed || !containerRef.current) return;

      const L = ((module as LeafletModule & { default?: LeafletModule })
        .default ?? module) as LeafletModule;
      map = L.map(containerRef.current, {
        attributionControl: true,
        dragging: true,
        keyboard: true,
        maxZoom: 18,
        minZoom: 8,
        scrollWheelZoom: true,
        touchZoom: true,
        zoomControl: false,
      }).setView([point.lat, point.lng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: 'topright' }).addTo(map);
      Object.assign(window, { L });

      if (mode === 'point') {
        const marker = L.marker([point.lat, point.lng], {
          draggable: true,
          icon: createLocationIcon(L),
          keyboard: true,
          title: 'Ponto do local. Arraste para alterar.',
        }).addTo(map);
        marker.bindTooltip('Arraste para alterar o ponto', {
          className: 'route-stop-label',
          direction: 'top',
          offset: [0, -22],
          opacity: 1,
          permanent: true,
        });
        marker.on('dragend', () => {
          const position = marker.getLatLng();
          onPointChangeRef.current?.({ lat: position.lat, lng: position.lng });
        });
        map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
          marker.setLatLng(event.latlng);
          onPointChangeRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
        });
      } else {
        await setupRoadEditor(
          L,
          map,
          roadPoints,
          (points) => onRoadPointsChangeRef.current?.(points),
          () => disposed,
        );
      }

      if (disposed) return;
      setReady(true);
      requestAnimationFrame(() => map?.invalidateSize());
    });

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [mode]);

  return (
    <figure
      className="relative min-h-72 overflow-hidden bg-[#dce7df]"
      aria-label={
        mode === 'point'
          ? 'Mapa interativo com o ponto do local marcado'
          : 'Mapa interativo com o trecho bloqueado marcado'
      }
    >
      <div
        ref={containerRef}
        className="operations-leaflet-map absolute inset-0"
        role="application"
        aria-label="Arraste o mapa para navegar e use os controles para aproximar ou afastar"
      />
      {!ready ? (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-[#e5ece7]">
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium shadow-lg">
            <Map aria-hidden="true" className="size-5 text-primary" />
            Preparando o mapa…
          </div>
        </div>
      ) : null}
      <span className="pointer-events-none absolute bottom-3 left-3 z-[450] rounded-lg bg-white/95 px-3 py-2 text-xs font-medium shadow-sm">
        Inhumas · GO
      </span>
      {mode === 'road' ? (
        <span className="pointer-events-none absolute left-3 top-3 z-[450] max-w-64 bg-white/95 px-3 py-2 text-sm font-medium shadow-sm">
          {roadPoints.length === 0
            ? 'Clique no mapa para marcar o início do trecho.'
            : roadPoints.length === 1
              ? 'Agora clique para marcar o fim do trecho.'
              : 'Arraste os pontos para ajustar o trecho.'}
        </span>
      ) : null}
    </figure>
  );
}

async function setupRoadEditor(
  L: LeafletModule,
  map: import('leaflet').Map,
  initialPoints: Point[],
  onChange: (points: Point[]) => void,
  isDisposed: () => boolean,
) {
  let selected = initialPoints.slice(0, 2);
  let routeLayers: import('leaflet').Polyline[] = [];
  let drawingVersion = 0;

  const clearRoute = () => {
    routeLayers.forEach((layer) => layer.remove());
    routeLayers = [];
  };

  const drawRoute = async (fit: boolean) => {
    const version = ++drawingVersion;
    clearRoute();
    if (selected.length !== 2) return;
    const coordinates = await getRoadCoordinates(L, selected as [Point, Point]);
    if (isDisposed() || version !== drawingVersion) return;
    routeLayers = [
      L.polyline(coordinates, {
        color: '#ffffff', opacity: 0.92, weight: 12, lineCap: 'round',
      }).addTo(map),
      L.polyline(coordinates, {
        color: '#b54736', dashArray: '10 8', opacity: 1, weight: 6, lineCap: 'round',
      }).addTo(map),
    ];
    if (fit) {
      map.fitBounds(L.latLngBounds(coordinates), { maxZoom: 15, padding: [52, 52] });
    }
  };

  const addMarker = (point: Point, index: number) => {
    const marker = L.marker([point.lat, point.lng], {
      draggable: true,
      icon: createRoadEndpointIcon(L, index),
      keyboard: true,
      title: `${index === 0 ? 'Início' : 'Fim'} do trecho. Arraste para alterar.`,
    }).addTo(map);
    marker.bindTooltip(index === 0 ? 'Início' : 'Fim', {
      className: 'route-stop-label', direction: 'top', offset: [0, -18], opacity: 1, permanent: true,
    });
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      selected[index] = { lat: position.lat, lng: position.lng };
      onChange([...selected]);
      void drawRoute(false);
    });
  };

  selected.forEach(addMarker);
  if (selected.length === 2) await drawRoute(true);

  map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
    if (selected.length >= 2) return;
    const point = { lat: event.latlng.lat, lng: event.latlng.lng };
    selected = [...selected, point];
    addMarker(point, selected.length - 1);
    onChange([...selected]);
    if (selected.length === 2) void drawRoute(true);
  });
}

async function getRoadCoordinates(L: LeafletModule, points: [Point, Point]) {
  const fallback = points.map((point) => L.latLng(point.lat, point.lng));
  try {
    await import('leaflet-routing-machine');
    const router: import('leaflet').Routing.IRouter = L.Routing.osrmv1({
      language: 'pt-BR', profile: 'driving', serviceUrl: 'https://router.project-osrm.org/route/v1',
      suppressDemoServerWarning: true, timeout: 20_000,
    });
    const waypoints = points.map((point) => L.Routing.waypoint(L.latLng(point.lat, point.lng)));
    const routed = await new Promise<import('leaflet').LatLng[] | null>((resolve) => {
      router.route(waypoints, (error, alternatives) => {
        resolve(error || !alternatives?.[0]?.coordinates?.length ? null : alternatives[0].coordinates);
      });
    });
    return routed ?? fallback;
  } catch {
    return fallback;
  }
}

function createLocationIcon(L: LeafletModule) {
  return L.divIcon({
    className: 'settings-location-marker-shell',
    html: '<span class="settings-location-marker"><span></span></span>',
    iconAnchor: [18, 38],
    iconSize: [36, 40],
  });
}

function createRoadEndpointIcon(L: LeafletModule, index: number) {
  return L.divIcon({
    className: 'settings-road-endpoint-shell',
    html: `<span style="display:grid;width:32px;height:32px;place-items:center;border:3px solid #fff;border-radius:999px;background:#b54736;color:#fff;font:700 14px Inter,sans-serif;box-shadow:0 2px 8px rgba(15,23,42,.24)">${index + 1}</span>`,
    iconAnchor: [16, 16],
    iconSize: [32, 32],
  });
}
