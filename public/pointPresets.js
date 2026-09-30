/**
 * Módulo para gerenciamento de presets de pontos de rota.
 * Suporta armazenamento no localStorage do navegador, exportação e importação em JSON.
 */

export const PRESET_STORAGE_KEY = "routing.pointPresets";

export const DEFAULT_PRESETS = [
  {
    id: "sp-demo-express",
    name: "São Paulo - Centro & Paulista (1 Coleta, 2 Entregas)",
    mapId: "sao-paulo",
    mapLabel: "São Paulo, São Paulo",
    createdAt: "2026-09-29T20:00:00.000Z",
    stops: [
      {
        type: "pickup",
        name: "Coleta 1",
        latitude: -23.5615,
        longitude: -46.6559,
        roadName: "Avenida Paulista",
        deadlineMinutes: null,
      },
      {
        type: "delivery",
        name: "Entrega 1",
        latitude: -23.5535,
        longitude: -46.6601,
        roadName: "Rua da Consolação",
        deadlineMinutes: 60,
      },
      {
        type: "delivery",
        name: "Entrega 2",
        latitude: -23.5489,
        longitude: -46.6388,
        roadName: "Praça da Sé",
        deadlineMinutes: 120,
      },
    ],
  },
  {
    id: "gyn-demo-setores",
    name: "Goiânia - Bueno & Marista (1 Coleta, 2 Entregas)",
    mapId: "goiania",
    mapLabel: "Goiânia, Goiás",
    createdAt: "2026-09-29T20:00:00.000Z",
    stops: [
      {
        type: "pickup",
        name: "Coleta 1",
        latitude: -16.7025,
        longitude: -49.2635,
        roadName: "Avenida T-63",
        deadlineMinutes: null,
      },
      {
        type: "delivery",
        name: "Entrega 1",
        latitude: -16.6980,
        longitude: -49.2570,
        roadName: "Alameda Ricardo Paranhos",
        deadlineMinutes: 45,
      },
      {
        type: "delivery",
        name: "Entrega 2",
        latitude: -16.6780,
        longitude: -49.2540,
        roadName: "Avenida Goiás",
        deadlineMinutes: 90,
      },
    ],
  },
];

/**
 * Converte a lista de paradas da aplicação em formato limpo para preset.
 */
export function serializeStops(stops) {
  if (!Array.isArray(stops)) return [];
  return stops.map((stop, index) => {
    let deadlineMinutes = null;
    if (stop.type === "delivery" && stop.deadline) {
      const parsedTime = Date.parse(stop.deadline);
      if (Number.isFinite(parsedTime)) {
        const diffMs = parsedTime - Date.now();
        deadlineMinutes = Math.max(1, Math.round(diffMs / 60_000));
      }
    }
    return {
      type: stop.type === "delivery" ? "delivery" : "pickup",
      name: stop.name || (stop.type === "delivery" ? `Entrega ${index + 1}` : `Coleta ${index + 1}`),
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
      roadName: stop.roadName || "",
      deadlineMinutes,
    };
  });
}

/**
 * Converte um segmento de rota calculada em formato limpo e serializável.
 */
export function serializeSegment(s) {
  if (!s || typeof s !== "object") return null;
  return {
    from: s.from ? { name: s.from.name, type: s.from.type, deadline: s.from.deadline } : null,
    to: s.to ? { name: s.to.name, type: s.to.type, deadline: s.to.deadline } : null,
    distanceMeters: Number(s.distanceMeters) || 0,
    travelTimeSeconds: Number(s.travelTimeSeconds) || 0,
    roads: Array.isArray(s.roads) ? s.roads : [],
    coordinates: Array.isArray(s.coordinates) ? s.coordinates : [],
    nodeIds: Array.isArray(s.nodeIds) ? s.nodeIds : [],
  };
}

/**
 * Converte o resultado completo de uma rota calculada em formato exportável.
 */
export function serializeRouteResult(route) {
  if (!route || typeof route !== "object") return null;
  return {
    distanceMeters: Number(route.distanceMeters) || 0,
    travelTimeSeconds: Number(route.travelTimeSeconds) || 0,
    planningTimeMs: Number(route.planningTimeMs) || 0,
    searchTimeMs: Number(route.searchTimeMs) || 0,
    computationTimeMs: Number(route.computationTimeMs) || 0,
    algorithm: route.algorithm || "astar",
    modelType: route.modelType || "normal",
    orderInfo: route.orderInfo || null,
    departureTimeMs: Number(route.departureTimeMs) || Date.now(),
    pickupCount: Number(route.pickupCount) || 0,
    deliveryCount: Number(route.deliveryCount) || 0,
    returnToStart: Boolean(route.returnToStart),
    h3Info: route.h3Info || null,
    coordinates: Array.isArray(route.coordinates) ? route.coordinates : [],
    nodeIds: Array.isArray(route.nodeIds) ? route.nodeIds : [],
    segments: Array.isArray(route.segments) ? route.segments.map(serializeSegment).filter(Boolean) : [],
  };
}

/**
 * Normaliza um objeto de preset e valida seus campos, preservando dados calculados se existirem.
 */
export function normalizePreset(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const name = String(candidate.name || "Preset sem nome").trim();
  let stopsRaw = Array.isArray(candidate.stops) ? candidate.stops : [];

  // Se não houver stops mas houver rota calculada com segmentos, extrai as paradas
  if (stopsRaw.length === 0 && candidate.route && Array.isArray(candidate.route.segments) && candidate.route.segments.length > 0) {
    const first = candidate.route.segments[0].from;
    if (first) stopsRaw.push(first);
    for (const seg of candidate.route.segments) {
      if (seg.to && (seg.to.type !== "return" || candidate.route.returnToStart)) {
        stopsRaw.push(seg.to);
      }
    }
  }

  const stops = [];

  for (const s of stopsRaw) {
    if (!s || typeof s !== "object") continue;
    const lat = Number(s.latitude ?? s.lat);
    const lng = Number(s.longitude ?? s.lng ?? s.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const type = s.type === "delivery" ? "delivery" : "pickup";
    const roadName = typeof s.roadName === "string" ? s.roadName : "";
    let deadlineMinutes = null;
    if (type === "delivery") {
      if (Number.isFinite(Number(s.deadlineMinutes)) && Number(s.deadlineMinutes) > 0) {
        deadlineMinutes = Number(s.deadlineMinutes);
      } else if (s.deadline && Number.isFinite(Date.parse(s.deadline))) {
        const diff = Date.parse(s.deadline) - Date.now();
        deadlineMinutes = Math.max(1, Math.round(diff / 60_000));
      } else {
        deadlineMinutes = 60;
      }
    }

    stops.push({
      type,
      name: s.name ? String(s.name) : (type === "delivery" ? `Entrega ${stops.length + 1}` : `Coleta ${stops.length + 1}`),
      latitude: lat,
      longitude: lng,
      roadName,
      deadlineMinutes,
    });
  }

  if (stops.length === 0) return null;

  const calculatedRoute = candidate.route || candidate.calculatedRoute
    ? serializeRouteResult(candidate.route || candidate.calculatedRoute)
    : null;

  return {
    id: candidate.id || `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    mapId: typeof candidate.mapId === "string" ? candidate.mapId : null,
    mapLabel: typeof candidate.mapLabel === "string" ? candidate.mapLabel : null,
    createdAt: candidate.createdAt || new Date().toISOString(),
    settings: candidate.settings && typeof candidate.settings === "object" ? candidate.settings : null,
    calculatedRoute,
    stops,
  };
}

/**
 * Exporta um ou mais presets para JSON string formatada.
 */
export function exportPresetsJson(presets) {
  const list = Array.isArray(presets) ? presets : [presets];
  const payload = {
    version: 1,
    schema: "route-presets",
    exportedAt: new Date().toISOString(),
    presets: list.map(normalizePreset).filter(Boolean),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Exporta uma rota completa já calculada com métricas, configurações e geometria.
 */
export function exportCalculatedRouteJson({
  name = "Rota Calculada",
  mapId = null,
  mapLabel = null,
  settings = {},
  stops = [],
  route = null,
}) {
  const payload = {
    version: 1,
    schema: "calculated-route",
    exportedAt: new Date().toISOString(),
    name: String(name).trim() || "Rota Calculada",
    mapId: mapId || null,
    mapLabel: mapLabel || null,
    settings: {
      algorithm: settings.algorithm || "astar",
      modelType: settings.modelType || "normal",
      orderStrategy: settings.orderStrategy || "priority",
      orderBudget: Number(settings.orderBudget) || 500,
      averageSpeed: Number(settings.averageSpeed) || 40,
      useH3: Boolean(settings.useH3),
      h3Resolution: Number(settings.h3Resolution) || 9,
      returnToStart: Boolean(settings.returnToStart),
    },
    stops: serializeStops(stops),
    route: route ? serializeRouteResult(route) : null,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Faz o parse e importação de presets ou rotas calculadas a partir de uma string ou objeto JSON.
 */
export function importPresetsFromJson(jsonContent) {
  let parsed;
  try {
    parsed = typeof jsonContent === "string" ? JSON.parse(jsonContent) : jsonContent;
  } catch {
    throw new Error("Arquivo JSON inválido.");
  }

  let candidates = [];
  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && (parsed[0].type === "pickup" || parsed[0].type === "delivery")) {
      candidates = [{
        name: "Preset Importado",
        stops: parsed,
      }];
    } else {
      candidates = parsed;
    }
  } else if (parsed && typeof parsed === "object") {
    if (parsed.schema === "calculated-route" || parsed.route) {
      candidates = [parsed];
    } else if (Array.isArray(parsed.presets)) {
      candidates = parsed.presets;
    } else if (parsed.preset && typeof parsed.preset === "object") {
      candidates = [parsed.preset];
    } else if (Array.isArray(parsed.stops)) {
      candidates = [parsed];
    } else {
      throw new Error("O arquivo não contém nenhum preset, parada ou rota reconhecível.");
    }
  } else {
    throw new Error("Formato inválido.");
  }

  const validPresets = [];
  for (const candidate of candidates) {
    const normalized = normalizePreset(candidate);
    if (normalized) {
      validPresets.push(normalized);
    }
  }

  if (validPresets.length === 0) {
    throw new Error("Nenhum preset válido com pontos de rota foi encontrado no arquivo.");
  }

  return validPresets;
}

/**
 * Carrega a lista de presets salvos do armazenamento (localStorage).
 */
export function loadSavedPresets(storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  if (!storage) return [...DEFAULT_PRESETS];
  try {
    const raw = storage.getItem(PRESET_STORAGE_KEY);
    if (!raw) {
      storage.setItem(PRESET_STORAGE_KEY, JSON.stringify(DEFAULT_PRESETS));
      return [...DEFAULT_PRESETS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const normalized = parsed.map(normalizePreset).filter(Boolean);
      return normalized.length > 0 ? normalized : [...DEFAULT_PRESETS];
    }
    return [...DEFAULT_PRESETS];
  } catch {
    return [...DEFAULT_PRESETS];
  }
}

/**
 * Salva ou atualiza um preset no armazenamento.
 */
export function savePresetToStorage(presetData, storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  const normalized = normalizePreset(presetData);
  if (!normalized) throw new Error("Preset inválido ou sem paradas.");

  const current = loadSavedPresets(storage);
  const existingIndex = current.findIndex(
    (p) => p.id === normalized.id || p.name.toLowerCase() === normalized.name.toLowerCase()
  );

  if (existingIndex >= 0) {
    normalized.id = current[existingIndex].id;
    current[existingIndex] = normalized;
  } else {
    current.unshift(normalized);
  }

  if (storage) {
    storage.setItem(PRESET_STORAGE_KEY, JSON.stringify(current));
  }
  return { preset: normalized, allPresets: current };
}

/**
 * Remove um preset do armazenamento por ID.
 */
export function deletePresetFromStorage(presetId, storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  const current = loadSavedPresets(storage);
  const filtered = current.filter((p) => p.id !== presetId);
  if (storage) {
    storage.setItem(PRESET_STORAGE_KEY, JSON.stringify(filtered));
  }
  return filtered;
}

/**
 * Mescla e salva uma lista de presets importados com os existentes no armazenamento.
 */
export function mergeImportedPresetsToStorage(importedList, storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  const current = loadSavedPresets(storage);
  const importedMap = new Map();

  // Preserva os existentes
  for (const preset of current) {
    importedMap.set(preset.name.toLowerCase(), preset);
  }

  // Sobrescreve ou adiciona novos
  for (const preset of importedList) {
    const normalized = normalizePreset(preset);
    if (normalized) {
      // Garante ID único se for novo
      if (!importedMap.has(normalized.name.toLowerCase())) {
        normalized.id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      }
      importedMap.set(normalized.name.toLowerCase(), normalized);
    }
  }

  const merged = Array.from(importedMap.values());
  if (storage) {
    storage.setItem(PRESET_STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}

/**
 * Dispara o download de um arquivo no navegador.
 */
export function triggerFileDownload(filename, content, mimeType = "application/json") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
