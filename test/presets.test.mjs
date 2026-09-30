import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PRESETS,
  PRESET_STORAGE_KEY,
  serializeStops,
  normalizePreset,
  exportPresetsJson,
  importPresetsFromJson,
  loadSavedPresets,
  savePresetToStorage,
  deletePresetFromStorage,
  mergeImportedPresetsToStorage,
  exportCalculatedRouteJson,
} from "../public/pointPresets.js";

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("DEFAULT_PRESETS possui presets padrão válidos", () => {
  assert.ok(Array.isArray(DEFAULT_PRESETS));
  assert.ok(DEFAULT_PRESETS.length >= 2);
  for (const preset of DEFAULT_PRESETS) {
    assert.ok(preset.id);
    assert.ok(preset.name);
    assert.ok(preset.stops.length > 0);
  }
});

test("serializeStops extrai paradas e calcula deadlineMinutes", () => {
  const futureDate = new Date(Date.now() + 90 * 60_000).toISOString();
  const stops = [
    {
      id: "pickup-1",
      type: "pickup",
      name: "Coleta Alpha",
      latitude: -23.55,
      longitude: -46.63,
      roadName: "Rua A",
      deadline: null,
    },
    {
      id: "delivery-1",
      type: "delivery",
      name: "Entrega Beta",
      latitude: -23.56,
      longitude: -46.64,
      roadName: "Rua B",
      deadline: futureDate,
    },
  ];

  const serialized = serializeStops(stops);
  assert.equal(serialized.length, 2);
  assert.equal(serialized[0].type, "pickup");
  assert.equal(serialized[0].name, "Coleta Alpha");
  assert.equal(serialized[0].deadlineMinutes, null);

  assert.equal(serialized[1].type, "delivery");
  assert.equal(serialized[1].name, "Entrega Beta");
  assert.ok(serialized[1].deadlineMinutes >= 89 && serialized[1].deadlineMinutes <= 91);
});

test("normalizePreset valida e normaliza paradas inválidas ou incompletas", () => {
  const raw = {
    name: " Teste Normalização ",
    mapId: "sao-paulo",
    stops: [
      { type: "pickup", lat: -23.5, lng: -46.6 },
      { type: "delivery", latitude: -23.6, longitude: -46.7, deadlineMinutes: 45 },
      { type: "invalid", latitude: NaN, longitude: -46.7 }, // deve ser ignorado
    ],
  };

  const normalized = normalizePreset(raw);
  assert.ok(normalized);
  assert.equal(normalized.name, "Teste Normalização");
  assert.equal(normalized.mapId, "sao-paulo");
  assert.equal(normalized.stops.length, 2);
  assert.equal(normalized.stops[0].type, "pickup");
  assert.equal(normalized.stops[1].type, "delivery");
  assert.equal(normalized.stops[1].deadlineMinutes, 45);
});

test("exportPresetsJson e importPresetsFromJson preservam dados e estrutura", () => {
  const preset = {
    id: "custom-1",
    name: "Rota Especial",
    mapId: "sao-paulo",
    stops: [
      { type: "pickup", name: "C1", latitude: -23.5, longitude: -46.5 },
      { type: "delivery", name: "E1", latitude: -23.6, longitude: -46.6, deadlineMinutes: 30 },
    ],
  };

  const jsonStr = exportPresetsJson(preset);
  assert.ok(typeof jsonStr === "string");
  const imported = importPresetsFromJson(jsonStr);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].name, "Rota Especial");
  assert.equal(imported[0].stops.length, 2);
  assert.equal(imported[0].stops[1].deadlineMinutes, 30);
});

test("importPresetsFromJson aceita múltiplos formatos de arquivo", () => {
  // 1. Array direto de paradas
  const rawStops = [
    { type: "pickup", latitude: -23.5, longitude: -46.5 },
    { type: "delivery", latitude: -23.6, longitude: -46.6 },
  ];
  const fromRawStops = importPresetsFromJson(JSON.stringify(rawStops));
  assert.equal(fromRawStops.length, 1);
  assert.equal(fromRawStops[0].stops.length, 2);

  // 2. Objeto com chave presets
  const collection = {
    version: 1,
    presets: [
      { name: "P1", stops: [{ type: "pickup", latitude: 1, longitude: 2 }] },
      { name: "P2", stops: [{ type: "delivery", latitude: 3, longitude: 4 }] },
    ],
  };
  const fromCollection = importPresetsFromJson(JSON.stringify(collection));
  assert.equal(fromCollection.length, 2);
  assert.equal(fromCollection[0].name, "P1");
  assert.equal(fromCollection[1].name, "P2");
});

test("operações de storage salvam, recuperam, atualizam e excluem presets", () => {
  const storage = createMockStorage();

  // 1. Carga inicial com defaults
  const initial = loadSavedPresets(storage);
  assert.ok(initial.length >= 2);

  // 2. Salvar novo preset
  const newPreset = {
    name: "Meu Preset Novo",
    mapId: "sao-paulo",
    stops: [
      { type: "pickup", latitude: -23.5, longitude: -46.6 },
      { type: "delivery", latitude: -23.6, longitude: -46.7, deadlineMinutes: 50 },
    ],
  };
  const { preset: saved, allPresets } = savePresetToStorage(newPreset, storage);
  assert.equal(saved.name, "Meu Preset Novo");
  assert.equal(allPresets[0].name, "Meu Preset Novo");

  // 3. Recuperar do storage
  const loaded = loadSavedPresets(storage);
  assert.equal(loaded[0].name, "Meu Preset Novo");

  // 4. Atualizar o mesmo preset (mesmo nome)
  newPreset.stops.push({ type: "delivery", latitude: -23.7, longitude: -46.8, deadlineMinutes: 80 });
  savePresetToStorage(newPreset, storage);
  const updated = loadSavedPresets(storage);
  assert.equal(updated.find((p) => p.name === "Meu Preset Novo").stops.length, 3);

  // 5. Excluir preset
  deletePresetFromStorage(saved.id, storage);
  const afterDelete = loadSavedPresets(storage);
  assert.ok(!afterDelete.some((p) => p.id === saved.id));

  // 6. Mesclar importação
  const importedList = [
    { name: "Preset Amigo", stops: [{ type: "pickup", latitude: -16.6, longitude: -49.2 }] },
  ];
  mergeImportedPresetsToStorage(importedList, storage);
  const afterMerge = loadSavedPresets(storage);
  assert.ok(afterMerge.some((p) => p.name === "Preset Amigo"));
});

test("exportCalculatedRouteJson e importPresetsFromJson preservam rota calculada, métricas e geometria", () => {
  const calculatedData = {
    name: "Rota São Paulo Calculada",
    mapId: "sao-paulo",
    mapLabel: "São Paulo, São Paulo",
    settings: {
      algorithm: "astar",
      modelType: "bidirectional",
      orderStrategy: "ils",
      orderBudget: 500,
      averageSpeed: 50,
      useH3: true,
      h3Resolution: 9,
      returnToStart: false,
    },
    stops: [
      { type: "pickup", name: "Coleta 1", latitude: -23.55, longitude: -46.63, roadName: "Via 1" },
      { type: "delivery", name: "Entrega 1", latitude: -23.56, longitude: -46.64, roadName: "Via 2", deadlineMinutes: 45 },
    ],
    route: {
      distanceMeters: 4500,
      travelTimeSeconds: 520,
      planningTimeMs: 12,
      searchTimeMs: 85,
      computationTimeMs: 97,
      algorithm: "astar",
      modelType: "bidirectional",
      coordinates: [
        [-23.55, -46.63],
        [-23.555, -46.635],
        [-23.56, -46.64],
      ],
      nodeIds: [101, 102, 103],
      segments: [
        {
          from: { name: "Coleta 1", type: "pickup" },
          to: { name: "Entrega 1", type: "delivery" },
          distanceMeters: 4500,
          travelTimeSeconds: 520,
          roads: ["Avenida Principal"],
          coordinates: [
            [-23.55, -46.63],
            [-23.56, -46.64],
          ],
        },
      ],
    },
  };

  const jsonStr = exportCalculatedRouteJson(calculatedData);
  assert.ok(typeof jsonStr === "string");
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.schema, "calculated-route");
  assert.equal(parsed.route.distanceMeters, 4500);

  const imported = importPresetsFromJson(jsonStr);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].name, "Rota São Paulo Calculada");
  assert.equal(imported[0].mapId, "sao-paulo");
  assert.equal(imported[0].stops.length, 2);
  assert.ok(imported[0].calculatedRoute);
  assert.equal(imported[0].calculatedRoute.distanceMeters, 4500);
  assert.equal(imported[0].calculatedRoute.coordinates.length, 3);
  assert.equal(imported[0].calculatedRoute.segments.length, 1);
  assert.equal(imported[0].settings.algorithm, "astar");
  assert.equal(imported[0].settings.modelType, "bidirectional");
});

