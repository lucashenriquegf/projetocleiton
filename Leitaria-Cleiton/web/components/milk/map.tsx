'use client';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { record, type Point, type Trip, type Block } from '@/lib/milk/model';
import type { RoadRoute } from './context';
type Props = {
  points: Point[];
  trip?: Trip;
  route?: RoadRoute | null;
  blocks?: Block[];
  onPick?: (latitude: number, longitude: number) => void;
  onPoint?: (p: Point) => void;
  selected?: string;
};
export function MilkMap(props: Props) {
  const ref = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null),
    L = useRef<typeof Leaflet | null>(null),
    layers = useRef<Leaflet.LayerGroup | null>(null),
    roads = useRef<Leaflet.LayerGroup | null>(null),
    latest = useRef(props),
    fitted = useRef('');
  useEffect(() => {
    latest.current = props;
  }, [props]);
  const [ready, setReady] = useState(false),
    [tileError, setTileError] = useState(false);
  useEffect(() => {
    let live = true;
    let observer: ResizeObserver;
    void import('leaflet').then(async (lib) => {
      if (!live || !ref.current) return;
      L.current = lib;
      const m = lib
        .map(ref.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          preferCanvas: false,
          zoomAnimation: false,
          markerZoomAnimation: false,
          fadeAnimation: false,
        })
        .setView([-16.36, -49.5], 13);
      map.current = m;
      lib.control.zoom({ position: 'topright' }).addTo(m);
      const tile = lib
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        })
        .addTo(m);
      tile.on('tileerror', () => setTileError(true));
      roads.current = lib.layerGroup().addTo(m);
      layers.current = lib.layerGroup().addTo(m);
      m.on('click', (e) => latest.current.onPick?.(e.latlng.lat, e.latlng.lng));
      observer = new ResizeObserver(() => {
        m.invalidateSize({ pan: false });
        const route = latest.current.route;
        if (route?.coordinates.length)
          m.fitBounds(lib.latLngBounds(route.coordinates), {
            padding: [28, 28],
            maxZoom: 15,
          });
      });
      observer.observe(ref.current);
      setReady(true);
      // Local street geometry remains visible if internet map tiles are unavailable.
      try {
        const graph = (await fetch('/data/inhumas.json').then((r) =>
          r.json(),
        )) as { edges: { geometry: [number, number][] }[] };
        if (live)
          lib
            .polyline(
              graph.edges
                .filter((e) => e.geometry?.length)
                .map((e) => e.geometry),
              {
                color: '#b7c9bf',
                weight: 1,
                opacity: 0.5,
                interactive: false,
              },
            )
            .addTo(roads.current!);
      } catch {
        if (live) setTileError(true);
      }
    });
    return () => {
      live = false;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !L.current || !map.current || !layers.current) return;
    const lib = L.current,
      m = map.current,
      g = layers.current;
    const tooltip = (text: string) => {
      const span = document.createElement('span');
      span.textContent = text;
      return span;
    };
    g.clearLayers();
    if (props.route?.coordinates.length)
      lib
        .polyline(props.route.coordinates, {
          color: '#245f0a',
          weight: 5,
          opacity: 0.9,
        })
        .addTo(g);
    for (const p of props.points) {
      const index = props.trip?.stops.findIndex((s) => s.id === p.id) ?? -1,
        r =
          props.trip && index >= 0
            ? record(props.trip, p.id)
            : { status: 'pending' };
      const selected = props.selected === p.id;
      const marker = lib
        .marker([p.latitude, p.longitude], {
          keyboard: true,
          icon: lib.divIcon({
            className: `milk-pin ${r.status} ${selected ? 'selected' : ''}`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            html: `<span>${r.status === 'done' ? '✓' : r.status === 'failed' ? '×' : index >= 0 ? index + 1 : '○'}</span>`,
          }),
        })
        .addTo(g);
      const label = `${index >= 0 ? `${index + 1}. ` : ''}${p.name} · ${r.status === 'done' ? 'Coleta realizada' : r.status === 'failed' ? 'Não realizada' : 'Pendente'}`;
      marker.bindTooltip(tooltip(label), { direction: 'top' });
      marker.on('click', (e) => {
        lib.DomEvent.stopPropagation(e);
        if (latest.current.onPoint) latest.current.onPoint(p);
        else latest.current.onPick?.(p.latitude, p.longitude);
      });
      const el = marker.getElement();
      if (el) {
        el.setAttribute('aria-label', label);
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
      }
    }
    if (props.trip)
      for (const [p, text] of [
        [props.trip.origin, 'Partida'],
        [props.trip.destination, 'Chegada'],
      ] as const)
        lib
          .circleMarker([p.latitude, p.longitude], {
            radius: 7,
            color: '#2563eb',
            fillOpacity: 1,
            fillColor: '#fff',
            weight: 3,
          })
          .bindTooltip(tooltip(`${text} · ${p.name}`))
          .addTo(g);
    for (const b of props.blocks || [])
      if (b.active)
        lib
          .circleMarker([b.latitude, b.longitude], {
            radius: 14,
            color: '#c84433',
            weight: 3,
            fillOpacity: 0.15,
          })
          .bindTooltip(tooltip(`Via bloqueada · ${b.name}`))
          .addTo(g);
    if (props.route)
      for (const p of props.route.attachedStops) {
        const original =
          props.trip &&
          [props.trip.origin, ...props.trip.stops, props.trip.destination].find(
            (s) =>
              s.id === p.id ||
              (p.id === 'origin' && s === props.trip!.origin) ||
              (p.id === 'destination' && s === props.trip!.destination),
          );
        if (
          original &&
          Math.hypot(
            original.latitude - p.latitude,
            original.longitude - p.longitude,
          ) > 0.00005
        )
          lib
            .polyline(
              [
                [original.latitude, original.longitude],
                [p.latitude, p.longitude],
              ],
              { color: '#65736c', weight: 2, dashArray: '5 5' },
            )
            .addTo(g);
      }
    const fitKey = props.route
      ? JSON.stringify(props.route.order) +
        JSON.stringify(props.route.coordinates[0])
      : '';
    if (fitKey && fitted.current !== fitKey) {
      fitted.current = fitKey;
      m.fitBounds(lib.latLngBounds(props.route!.coordinates), {
        padding: [35, 35],
        maxZoom: 15,
      });
    }
    if (props.selected) {
      const p = props.points.find((p) => p.id === props.selected);
      if (p) m.panTo([p.latitude, p.longitude]);
    }
  }, [
    ready,
    props.points,
    props.trip,
    props.route,
    props.blocks,
    props.selected,
  ]);
  return (
    <div className="relative h-full min-h-[200px] bg-[#e9efe9]">
      <div
        ref={ref}
        className="absolute inset-0"
        aria-label="Mapa interativo das coletas em Inhumas"
      />
      <div className="pointer-events-none absolute bottom-5 left-3 z-[450] max-w-[85%] rounded-xl border bg-white/95 px-3 py-2 text-xs shadow-sm">
        {tileError
          ? 'Mapa-base sem conexão · vias locais disponíveis'
          : 'Inhumas/GO · dados fictícios'}
        {props.onPick && (
          <strong className="block text-primary">
            Clique no mapa para definir a posição
          </strong>
        )}
      </div>
    </div>
  );
}
