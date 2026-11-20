import type { DemandRecord } from '@/lib/mocks/demands';

export type DemandDemoOverride = Pick<
  DemandRecord,
  'status' | 'coverage' | 'routes'
>;

type DemandDemoOverrides = Record<string, DemandDemoOverride>;

const storageKey = 'agro-rota:demand-overrides';
const emptyOverrides: DemandDemoOverrides = {};
const listeners = new Set<() => void>();
let cachedValue: DemandDemoOverrides = emptyOverrides;
let cachedSerialized: string | null | undefined;

export function readDemandDemoOverrides(): DemandDemoOverrides {
  if (typeof window === 'undefined') return emptyOverrides;

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === cachedSerialized) return cachedValue;

    cachedSerialized = stored;
    cachedValue = stored
      ? (JSON.parse(stored) as DemandDemoOverrides)
      : emptyOverrides;
    return cachedValue;
  } catch {
    return emptyOverrides;
  }
}

export function getServerDemandDemoOverrides() {
  return emptyOverrides;
}

export function subscribeToDemandDemoOverrides(onChange: () => void) {
  listeners.add(onChange);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== storageKey) return;
    cachedSerialized = undefined;
    onChange();
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', handleStorage);
  };
}

export function saveDemandDemoOverride(
  demandId: string,
  override: DemandDemoOverride,
) {
  if (typeof window === 'undefined') return;

  const current = readDemandDemoOverrides();
  const serialized = JSON.stringify({ ...current, [demandId]: override });
  window.localStorage.setItem(storageKey, serialized);
  cachedSerialized = serialized;
  cachedValue = JSON.parse(serialized) as DemandDemoOverrides;
  listeners.forEach((listener) => listener());
}
