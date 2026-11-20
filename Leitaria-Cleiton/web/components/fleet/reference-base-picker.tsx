'use client';

import { Check, Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { SettingsMap } from '@/components/settings/settings-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type ReferenceBaseValue = {
  locationId: string | null;
  label: string;
  latitude: number;
  longitude: number;
};

type LocationOption = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

const defaultPoint = { lat: -16.35742, lng: -49.49681 };

export function ReferenceBasePicker({
  value,
  onChange,
}: {
  value: ReferenceBaseValue;
  onChange: (value: ReferenceBaseValue) => void;
}) {
  const [mode, setMode] = useState<'registered' | 'custom'>(value.locationId ? 'registered' : 'custom');
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [mapVersion, setMapVersion] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    let active = true;
    void fetch('/api/reference-locations')
      .then(async (response) => {
        if (!response.ok) throw new Error('Falha ao carregar');
        return response.json() as Promise<{ items: LocationOption[] }>;
      })
      .then((result) => {
        if (active) setLocations(result.items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return locations.slice(0, 6);
    return locations
      .filter((item) => `${item.name} ${item.address}`.toLocaleLowerCase('pt-BR').includes(normalized))
      .slice(0, 8);
  }, [locations, query]);

  const point = {
    lat: Number.isFinite(value.latitude) ? value.latitude : defaultPoint.lat,
    lng: Number.isFinite(value.longitude) ? value.longitude : defaultPoint.lng,
  };

  function selectLocation(location: LocationOption) {
    onChange({
      locationId: location.id,
      label: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setQuery(location.name);
    setMapVersion((current) => current + 1);
  }

  function useCurrentLocation() {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Este navegador não permite obter sua localização. Marque o ponto diretamente no mapa.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMode('custom');
        setQuery('');
        onChange({
          locationId: null,
          label: 'Localização atual',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setMapVersion((current) => current + 1);
        setLocating(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Permita o acesso à localização no navegador para usar este recurso.'
          : 'Não foi possível encontrar sua localização. Você ainda pode marcar o ponto no mapa.';
        setLocationError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  return (
    <section className="border-t pt-7">
      <div>
        <h2 className="text-lg font-semibold">Base de referência</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Use uma base cadastrada, sua localização atual ou marque outro ponto no mapa.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Forma de escolher a base">
        <Button
          type="button"
          variant={mode === 'registered' ? 'default' : 'outline'}
          onClick={() => setMode('registered')}
          className={cn('h-11 cursor-pointer rounded-none', mode === 'registered' && 'bg-[#245f0a]')}
        >
          Buscar local cadastrado
        </Button>
        <Button
          type="button"
          variant={mode === 'custom' ? 'default' : 'outline'}
          onClick={() => {
            setMode('custom');
            onChange({ ...value, locationId: null });
          }}
          className={cn('h-11 cursor-pointer rounded-none', mode === 'custom' && 'bg-[#245f0a]')}
        >
          <MapPin aria-hidden="true" /> Marcar outro ponto
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={locating}
          onClick={useCurrentLocation}
          className="h-11 cursor-pointer rounded-none"
        >
          {locating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <LocateFixed aria-hidden="true" />}
          {locating ? 'Localizando…' : 'Usar minha localização'}
        </Button>
      </div>

      {locationError ? (
        <p role="alert" className="mt-3 max-w-2xl text-sm font-medium text-alert">
          {locationError}
        </p>
      ) : null}

      {mode === 'registered' ? (
        <div className="mt-5 max-w-2xl">
          <Label htmlFor="base-search">Buscar por nome ou endereço</Label>
          <div className="relative mt-2">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              id="base-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: Estoque Central ou Rodovia GO-070"
              className="h-11 rounded-none pl-10"
            />
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto border bg-white" role="listbox" aria-label="Locais encontrados">
            {loading ? <p className="p-4 text-sm text-muted-foreground">Carregando locais…</p> : null}
            {!loading && filtered.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhum local encontrado.</p> : null}
            {filtered.map((location) => {
              const selected = value.locationId === location.id;
              return (
                <button
                  key={location.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectLocation(location)}
                  className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <MapPin aria-hidden="true" className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{location.name}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{location.address}</span>
                  </span>
                  {selected ? <Check aria-hidden="true" className="size-5 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-5 max-w-2xl">
          <Label htmlFor="custom-base-label">Nome desta referência</Label>
          <Input
            id="custom-base-label"
            value={value.label}
            onChange={(event) => onChange({ ...value, label: event.target.value, locationId: null })}
            placeholder="Ex.: Garagem municipal de Inhumas"
            className="mt-2 h-11 rounded-none"
          />
        </div>
      )}

      <div className="mt-5 grid overflow-hidden border lg:grid-cols-[minmax(0,1.5fr)_300px]">
        <SettingsMap
          key={mapVersion}
          mode="point"
          point={point}
          onPointChange={(nextPoint) =>
            onChange({
              ...value,
              locationId: mode === 'registered' ? value.locationId : null,
              latitude: nextPoint.lat,
              longitude: nextPoint.lng,
            })
          }
        />
        <div className="bg-subtle p-5">
          <p className="text-sm font-semibold">Ponto selecionado</p>
          <p className="mt-2 break-words text-base font-medium">{value.label || 'Dê um nome para esta base'}</p>
          <dl className="mt-5 space-y-3 border-y py-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Latitude</dt>
              <dd className="font-medium tabular-nums">{point.lat.toFixed(5)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Longitude</dt>
              <dd className="font-medium tabular-nums">{point.lng.toFixed(5)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Clique no mapa ou arraste o marcador até o ponto correto.
          </p>
        </div>
      </div>
    </section>
  );
}
