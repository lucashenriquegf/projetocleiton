import {
  assembleMultiStopRoute,
  buildStopTravelTimeMatrix,
  buildRoutingGraph,
  buildPathResult,
  connectStopsToGraph,
  findNearestEdge,
  findStopsOnPath,
  prioritizeStopOrder,
} from "/algorithms/routing.mjs";
import { optimizeStopOrderIls } from "/algorithms/StopOrderILS.js";
import {
  expandCorridor,
  filterGraphByCorridor,
  getBaseCorridor,
  getHexagonBoundaries,
} from "/algorithms/h3_corridor.js";
import { aStarWithProgress } from "/algorithms/AStar.js";
import { bfs } from "/algorithms/BSF.js";
import { dfs } from "/algorithms/DFS.js";
import { dijkstra } from "/algorithms/Dijkstra.js";
import { bidirectionalAStar } from "/algorithms/BidirectionalAStar.js";
import { bidirectionalBfs } from "/algorithms/BidirectionalBFS.js";
import { bidirectionalDfs } from "/algorithms/BidirectionalDFS.js";
import { bidirectionalDijkstra } from "/algorithms/BidirectionalDijkstra.js";
import { greedyBestFirst } from "/algorithms/GreedyBestFirst.js";
import { beamSearch } from "/algorithms/BeamSearch.js";
import { bidirectionalGreedyBestFirst } from "/algorithms/BidirectionalGreedyBestFirst.js";
import { bidirectionalBeamSearch } from "/algorithms/BidirectionalBeamSearch.js";
import {
  exportPresetsJson,
  exportCalculatedRouteJson,
  importPresetsFromJson,
  loadSavedPresets,
  savePresetToStorage,
  deletePresetFromStorage,
  mergeImportedPresetsToStorage,
  serializeStops,
  triggerFileDownload,
} from "/pointPresets.js";

const state = {
  graph: null,
  routingGraph: null,
  map: null,
  networkLayer: null,
  stops: [],
  routeLayers: [],
  corridorLayers: [],
  lastCorridorCells: null,
  useH3Corridor: true,
  h3Resolution: 9,
  h3ShowPolygons: true,
  maxBufferExpansion: 6,
  explorationGroup: null,
  exploredEdgeKeys: new Set(),
  activeExplorationLayer: null,
  currentCalculationController: null,
  addMode: null,
  dragDepth: 0,
  counters: { pickup: 0, delivery: 0 },
  toastTimer: null,
  lastRoute: null,
  editingStopId: null,
  selectedMapId: null,
  mapLoadController: null,
};

const SEARCH_BATCH_SIZE = 128;

const elements = {
  cityName: document.querySelector("#city-name"),
  mapSelect: document.querySelector("#road-network"),
  loadingState: document.querySelector("#loading-state"),
  stopCount: document.querySelector("#stop-count"),
  stopList: document.querySelector("#stop-list"),
  emptyStops: document.querySelector("#empty-stops"),
  orderHint: document.querySelector("#order-hint"),
  clearRoute: document.querySelector("#clear-route"),
  calculateRoute: document.querySelector("#calculate-route"),
  exportCalculatedRoute: document.querySelector("#export-calculated-route"),
  cancelCalculation: document.querySelector("#cancel-calculation"),
  calculationNote: document.querySelector("#calculation-note"),
  algorithm: document.querySelector("#algorithm"),
  modelType: document.querySelector("#model-type"),
  orderStrategy: document.querySelector("#order-strategy"),
  orderBudget: document.querySelector("#order-budget"),
  ilsControls: document.querySelector("#ils-controls"),
  returnToStart: document.querySelector("#return-to-start"),
  averageSpeed: document.querySelector("#average-speed"),
  speedValue: document.querySelector("#speed-value"),
  h3Toggle: document.querySelector("#h3-toggle"),
  h3Controls: document.querySelector("#h3-controls"),
  h3Res: document.querySelector("#h3-res"),
  h3ResValue: document.querySelector("#h3-res-value"),
  h3ShowPolygons: document.querySelector("#h3-show-polygons"),
  h3Metric: document.querySelector("#h3-metric"),
  routeSummary: document.querySelector("#route-summary"),
  totalDistance: document.querySelector("#total-distance"),
  estimatedTime: document.querySelector("#estimated-time"),
  planningTime: document.querySelector("#planning-time"),
  searchTime: document.querySelector("#search-time"),
  pickupTotal: document.querySelector("#pickup-total"),
  deliveryTotal: document.querySelector("#delivery-total"),
  computationTime: document.querySelector("#computation-time"),
  selectedAlgorithm: document.querySelector("#selected-algorithm"),
  segmentList: document.querySelector("#segment-list"),
  networkToggle: document.querySelector("#network-toggle"),
  explorationToggle: document.querySelector("#exploration-toggle"),
  mapInstruction: document.querySelector("#map-instruction"),
  instructionText: document.querySelector("#instruction-text"),
  cancelAdd: document.querySelector("#cancel-add"),
  dropOverlay: document.querySelector("#drop-overlay"),
  toast: document.querySelector("#toast"),
  deliveryDialog: document.querySelector("#delivery-dialog"),
  deliveryForm: document.querySelector("#delivery-form"),
  deliveryDialogTitle: document.querySelector("#delivery-dialog-title"),
  deadlineDays: document.querySelector("#deadline-days"),
  deadlineHours: document.querySelector("#deadline-hours"),
  deadlineMinutes: document.querySelector("#deadline-minutes"),
  closeDeliveryDialog: document.querySelector("#close-delivery-dialog"),
  cancelDelivery: document.querySelector("#cancel-delivery"),
  presetSelect: document.querySelector("#preset-select"),
  savePresetBtn: document.querySelector("#save-preset-btn"),
  deletePresetBtn: document.querySelector("#delete-preset-btn"),
  exportPresetBtn: document.querySelector("#export-preset-btn"),
  importPresetInput: document.querySelector("#import-preset-input"),
  presetSaveDialog: document.querySelector("#preset-save-dialog"),
  presetSaveForm: document.querySelector("#preset-save-form"),
  presetNameInput: document.querySelector("#preset-name-input"),
  presetStopsSummary: document.querySelector("#preset-stops-summary"),
  closePresetDialog: document.querySelector("#close-preset-dialog"),
  cancelPresetSave: document.querySelector("#cancel-preset-save"),
};

async function initialize() {
  initializeMap();
  bindInterfaceEvents();
  renderPresetsDropdown();

  try {
    await loadMapCatalog();
  } catch (error) {
    console.error(error);
    showMapLoadingError("Erro ao carregar o mapa.");
    showToast(error.message, true);
  }
}

async function loadMapCatalog() {
  const response = await fetch("/api/maps");
  if (!response.ok) throw new Error("Não foi possível listar as malhas viárias.");
  const catalog = await response.json();
  if (!Array.isArray(catalog.maps) || catalog.maps.length === 0) {
    throw new Error("Nenhuma malha viária foi encontrada na pasta maps.");
  }

  elements.mapSelect.innerHTML = "";
  catalog.maps.forEach((map) => {
    const option = document.createElement("option");
    option.value = map.id;
    option.textContent = map.label;
    option.title = `${map.label} — ${formatFileSize(map.sizeBytes)}`;
    elements.mapSelect.appendChild(option);
  });

  let storedMapId = null;
  try {
    storedMapId = localStorage.getItem("routing.selectedMapId");
  } catch {
    // O seletor continua funcionando mesmo quando o armazenamento local está indisponível.
  }
  const initialMapId = catalog.defaultMapId || (catalog.maps.some((map) => map.id === storedMapId)
    ? storedMapId
    : catalog.maps[0].id);
  elements.mapSelect.value = initialMapId;
  await loadRoadNetwork(initialMapId, { initial: true });
}

async function loadRoadNetwork(mapId, { initial = false } = {}) {
  if (!mapId || state.currentCalculationController) return;
  state.mapLoadController?.abort();
  const controller = new AbortController();
  state.mapLoadController = controller;
  const previousMapId = state.selectedMapId;
  elements.mapSelect.disabled = true;
  elements.loadingState.classList.remove("hidden");
  const loader = elements.loadingState.querySelector(".loader");
  if (loader) loader.hidden = false;
  elements.loadingState.querySelector("span").textContent = "Carregando malha viária…";

  try {
    const response = await fetch(`/api/grafo?map=${encodeURIComponent(mapId)}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Não foi possível carregar a rede viária.");
    }
    const graph = await response.json();
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      throw new Error("A malha selecionada possui um formato inválido.");
    }

    if (!initial || state.stops.length) resetStopsForMapChange();
    state.networkLayer?.remove();
    state.networkLayer = null;
    state.graph = graph;
    state.routingGraph = buildRoutingGraph(graph, {
      fallbackSpeedKph: Number(elements.averageSpeed.value),
    });
    state.selectedMapId = mapId;
    elements.mapSelect.value = mapId;
    elements.cityName.textContent = (graph.city || elements.mapSelect.selectedOptions[0]?.textContent || mapId)
      .replace(/,?\s*Brazil$/i, "");

    const bounds = L.latLngBounds();
    graph.nodes.forEach((node) => bounds.extend([node.latitude, node.longitude]));
    if (bounds.isValid()) state.map.fitBounds(bounds, { padding: [28, 28] });
    if (elements.networkToggle.checked) toggleNetworkLayer();
    try {
      localStorage.setItem("routing.selectedMapId", mapId);
    } catch {
      // Persistência é apenas uma conveniência.
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    elements.mapSelect.value = previousMapId || mapId;
    if (!state.graph) {
      showMapLoadingError("Erro ao carregar a malha viária.");
    }
    showToast(error.message, true);
    throw error;
  } finally {
    if (state.mapLoadController === controller) {
      state.mapLoadController = null;
      elements.mapSelect.disabled = Boolean(state.currentCalculationController);
      if (state.graph) elements.loadingState.classList.add("hidden");
    }
  }
}

function showMapLoadingError(message) {
  const loader = elements.loadingState.querySelector(".loader");
  if (loader) loader.hidden = true;
  elements.loadingState.querySelector("span").textContent = message;
}

function resetStopsForMapChange() {
  state.stops.forEach((stop) => stop.marker.remove());
  state.stops = [];
  state.counters = { pickup: 0, delivery: 0 };
  setAddMode(null);
  invalidateRoute();
  renderStops();
}

function initializeMap() {
  state.map = L.map("map", { zoomControl: false, preferCanvas: true }).setView([-16.36, -49.5], 13);
  state.map.createPane("explorationPane").style.zIndex = 410;
  state.map.createPane("routePane").style.zIndex = 420;
  state.explorationGroup = L.layerGroup();

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);

  state.map.on("click", (event) => {
    if (!state.addMode || !state.routingGraph) return;
    addStop(state.addMode, event.latlng);
    setAddMode(null);
  });
}

function bindInterfaceEvents() {
  document.querySelectorAll(".stop-tool").forEach((tool) => {
    tool.addEventListener("click", () => setAddMode(tool.dataset.stopType));
    tool.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-cooproute-stop", tool.dataset.stopType);
      event.dataTransfer.setData("text/plain", tool.dataset.stopType);
    });
    tool.addEventListener("dragend", resetDropOverlay);
  });

  const mapContainer = state.map.getContainer();
  mapContainer.addEventListener("dragenter", (event) => {
    if (!isStopDrag(event)) return;
    event.preventDefault();
    state.dragDepth += 1;
    elements.dropOverlay.classList.add("visible");
  });
  mapContainer.addEventListener("dragover", (event) => {
    if (!isStopDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  mapContainer.addEventListener("dragleave", () => {
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (state.dragDepth === 0) resetDropOverlay();
  });
  mapContainer.addEventListener("drop", (event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/x-cooproute-stop") || event.dataTransfer.getData("text/plain");
    resetDropOverlay();
    if (!["pickup", "delivery"].includes(type) || !state.routingGraph) return;

    const rect = mapContainer.getBoundingClientRect();
    const point = L.point(event.clientX - rect.left, event.clientY - rect.top);
    addStop(type, state.map.containerPointToLatLng(point));
  });

  elements.cancelAdd.addEventListener("click", () => setAddMode(null));
  elements.mapSelect.addEventListener("change", () => {
    loadRoadNetwork(elements.mapSelect.value).catch((error) => console.error(error));
  });
  elements.clearRoute.addEventListener("click", clearAllStops);
  elements.calculateRoute.addEventListener("click", calculateRoute);
  elements.cancelCalculation.addEventListener("click", cancelCalculation);
  elements.algorithm.addEventListener("change", invalidateRoute);
  elements.modelType.addEventListener("change", invalidateRoute);
  elements.orderStrategy.addEventListener("change", () => {
    elements.ilsControls.hidden = elements.orderStrategy.value !== "ils";
    invalidateRoute();
  });
  elements.orderBudget.addEventListener("change", invalidateRoute);
  elements.returnToStart.addEventListener("change", invalidateRoute);
  elements.averageSpeed.addEventListener("input", () => {
    elements.speedValue.textContent = elements.averageSpeed.value;
    invalidateRoute();
  });
  elements.networkToggle.addEventListener("change", toggleNetworkLayer);
  elements.explorationToggle.addEventListener("change", () => {
    setExplorationVisibility(elements.explorationToggle.checked);
  });
  elements.h3Toggle?.addEventListener("change", () => {
    state.useH3Corridor = elements.h3Toggle.checked;
    if (elements.h3Controls) {
      elements.h3Controls.style.display = state.useH3Corridor ? "flex" : "none";
    }
    clearCorridorLayers();
    invalidateRoute();
  });
  elements.h3Res?.addEventListener("input", () => {
    state.h3Resolution = Number(elements.h3Res.value) || 9;
    if (elements.h3ResValue) elements.h3ResValue.textContent = state.h3Resolution;
    clearCorridorLayers();
    invalidateRoute();
  });
  elements.h3ShowPolygons?.addEventListener("change", () => {
    state.h3ShowPolygons = elements.h3ShowPolygons.checked;
    if (!state.h3ShowPolygons) {
      clearCorridorLayers();
    } else if (state.lastCorridorCells) {
      drawCorridorHexagons(state.lastCorridorCells);
    }
  });
  elements.deliveryForm.addEventListener("submit", saveDeliveryDeadline);
  elements.closeDeliveryDialog.addEventListener("click", closeDeliveryEditor);
  elements.cancelDelivery.addEventListener("click", closeDeliveryEditor);
  elements.deliveryDialog.addEventListener("close", () => {
    state.editingStopId = null;
  });

  elements.presetSelect?.addEventListener("change", () => {
    const selectedId = elements.presetSelect.value;
    if (elements.deletePresetBtn) elements.deletePresetBtn.disabled = !selectedId;
    if (selectedId) {
      const presets = loadSavedPresets();
      const preset = presets.find((p) => p.id === selectedId);
      if (preset) applyPreset(preset);
    }
  });
  elements.exportCalculatedRoute?.addEventListener("click", handleExportCalculatedRoute);
  elements.savePresetBtn?.addEventListener("click", openSavePresetDialog);
  elements.deletePresetBtn?.addEventListener("click", handleDeletePreset);
  elements.exportPresetBtn?.addEventListener("click", handleExportPresets);
  elements.importPresetInput?.addEventListener("change", handleImportPresets);
  elements.closePresetDialog?.addEventListener("click", closeSavePresetDialog);
  elements.cancelPresetSave?.addEventListener("click", closeSavePresetDialog);
  elements.presetSaveForm?.addEventListener("submit", handleSavePresetSubmit);
}

function renderPresetsDropdown(selectedId = null) {
  if (!elements.presetSelect) return;
  const presets = loadSavedPresets();
  elements.presetSelect.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Selecione um preset…";
  elements.presetSelect.appendChild(defaultOption);

  presets.forEach((preset) => {
    const opt = document.createElement("option");
    opt.value = preset.id;
    const mapTag = preset.mapLabel ? ` [${preset.mapLabel.split(",")[0]}]` : "";
    opt.textContent = `${preset.name} (${preset.stops.length} pts)${mapTag}`;
    elements.presetSelect.appendChild(opt);
  });

  if (selectedId && presets.some((p) => p.id === selectedId)) {
    elements.presetSelect.value = selectedId;
  } else {
    elements.presetSelect.value = "";
  }
  if (elements.deletePresetBtn) {
    elements.deletePresetBtn.disabled = !elements.presetSelect.value;
  }
}

async function applyPreset(preset) {
  if (!preset || !Array.isArray(preset.stops) || preset.stops.length === 0) {
    showToast("O preset selecionado não contém pontos.", true);
    return;
  }

  // Se o preset pertencer a outro mapa disponível no catálogo, carrega a malha correspondente primeiro
  if (preset.mapId && preset.mapId !== state.selectedMapId) {
    const availableMaps = Array.from(elements.mapSelect.options).map((o) => o.value);
    if (availableMaps.includes(preset.mapId)) {
      showToast(`Alternando para o mapa de ${preset.mapLabel || preset.mapId}…`);
      try {
        await loadRoadNetwork(preset.mapId);
      } catch (err) {
        showToast(`Erro ao carregar o mapa do preset: ${err.message}`, true);
        return;
      }
    }
  }

  clearAllStops();

  let connectedCount = 0;
  preset.stops.forEach((stopItem) => {
    const edge = findNearestEdge(state.routingGraph, stopItem.latitude, stopItem.longitude);
    if (!edge) return;

    connectedCount += 1;
    state.counters[stopItem.type] += 1;
    const typeName = stopItem.type === "pickup" ? "Coleta" : "Entrega";
    const stop = {
      id: `${stopItem.type}-${Date.now()}-${state.counters[stopItem.type]}-${Math.random().toString(36).slice(2, 6)}`,
      type: stopItem.type,
      name: stopItem.name || `${typeName} ${state.counters[stopItem.type]}`,
      roadName: edge.roadName || stopItem.roadName || "Via local sem nome",
      edgeIndex: edge.edgeIndex,
      latitude: edge.latitude,
      longitude: edge.longitude,
      marker: null,
      deadline: stopItem.type === "delivery"
        ? (stopItem.deadlineMinutes
            ? new Date(Date.now() + stopItem.deadlineMinutes * 60_000).toISOString()
            : (stopItem.deadline && Number.isFinite(Date.parse(stopItem.deadline)) && new Date(stopItem.deadline) > new Date()
                ? stopItem.deadline
                : new Date(Date.now() + 60 * 60_000).toISOString()))
        : null,
    };

    stop.marker = createStopMarker(stop);
    state.stops.push(stop);
  });

  renderStops();

  if (state.stops.length > 0) {
    const bounds = L.latLngBounds(state.stops.map((s) => [s.latitude, s.longitude]));
    if (bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }

  if (preset.settings && typeof preset.settings === "object") {
    if (preset.settings.algorithm && elements.algorithm) {
      elements.algorithm.value = preset.settings.algorithm;
    }
    if (preset.settings.modelType && elements.modelType) {
      elements.modelType.value = preset.settings.modelType;
    }
    if (preset.settings.orderStrategy && elements.orderStrategy) {
      elements.orderStrategy.value = preset.settings.orderStrategy;
      if (elements.ilsControls) {
        elements.ilsControls.hidden = preset.settings.orderStrategy !== "ils";
      }
    }
    if (preset.settings.orderBudget && elements.orderBudget) {
      elements.orderBudget.value = String(preset.settings.orderBudget);
    }
    if (preset.settings.averageSpeed && elements.averageSpeed) {
      elements.averageSpeed.value = String(preset.settings.averageSpeed);
      if (elements.speedValue) elements.speedValue.textContent = String(preset.settings.averageSpeed);
    }
    if (preset.settings.useH3 !== undefined && elements.h3Toggle) {
      elements.h3Toggle.checked = Boolean(preset.settings.useH3);
      state.useH3Corridor = elements.h3Toggle.checked;
      if (elements.h3Controls) {
        elements.h3Controls.style.display = state.useH3Corridor ? "flex" : "none";
      }
    }
    if (preset.settings.h3Resolution && elements.h3Res) {
      elements.h3Res.value = String(preset.settings.h3Resolution);
      state.h3Resolution = Number(preset.settings.h3Resolution);
      if (elements.h3ResValue) elements.h3ResValue.textContent = String(state.h3Resolution);
    }
    if (preset.settings.returnToStart !== undefined && elements.returnToStart) {
      elements.returnToStart.checked = Boolean(preset.settings.returnToStart);
    }
  }

  if (preset.calculatedRoute && Array.isArray(preset.calculatedRoute.coordinates) && preset.calculatedRoute.coordinates.length >= 2) {
    state.lastRoute = preset.calculatedRoute;
    drawRoute(state.lastRoute);
    renderRouteSummary(state.lastRoute, false);
    if (elements.exportCalculatedRoute) elements.exportCalculatedRoute.hidden = false;
    elements.calculateRoute.querySelector("span").textContent = "Recalcular rota";
    showToast(`Rota calculada "${preset.name}" importada com sucesso!`);
  } else {
    invalidateRoute();
    if (elements.exportCalculatedRoute) elements.exportCalculatedRoute.hidden = true;
    if (connectedCount === 0) {
      showToast("Não foi possível conectar os pontos do preset à malha viária atual.", true);
    } else {
      showToast(`Preset "${preset.name}" carregado com ${connectedCount} paradas.`);
    }
  }
}

function openSavePresetDialog() {
  if (state.stops.length === 0) {
    showToast("Adicione pontos no mapa antes de salvar um preset.", true);
    return;
  }
  const pickups = state.stops.filter((s) => s.type === "pickup").length;
  const deliveries = state.stops.filter((s) => s.type === "delivery").length;
  const mapOption = elements.mapSelect?.selectedOptions[0];
  const mapLabel = mapOption ? mapOption.textContent : state.selectedMapId || "";

  elements.presetStopsSummary.textContent = `${pickups} ${pluralize(pickups, "coleta", "coletas")} • ${deliveries} ${pluralize(deliveries, "entrega", "entregas")} • ${mapLabel}`;
  elements.presetNameInput.value = `Rota ${mapLabel ? mapLabel.split(",")[0] : ""} (${state.stops.length} pts)`.trim();
  elements.presetSaveDialog.showModal();
  elements.presetNameInput.focus();
  elements.presetNameInput.select();
}

function closeSavePresetDialog() {
  if (elements.presetSaveDialog.open) {
    elements.presetSaveDialog.close();
  }
}

function handleSavePresetSubmit(event) {
  event.preventDefault();
  const name = elements.presetNameInput.value.trim();
  if (!name) {
    showToast("Informe um nome para o preset.", true);
    return;
  }

  const mapOption = elements.mapSelect?.selectedOptions[0];
  const mapLabel = mapOption ? mapOption.textContent : state.selectedMapId || "";
  const stops = serializeStops(state.stops);

  try {
    const { preset } = savePresetToStorage({
      name,
      mapId: state.selectedMapId,
      mapLabel,
      stops,
    });
    closeSavePresetDialog();
    renderPresetsDropdown(preset.id);
    showToast(`Preset "${preset.name}" salvo no navegador!`);
  } catch (err) {
    showToast(`Erro ao salvar preset: ${err.message}`, true);
  }
}

function handleDeletePreset() {
  const presetId = elements.presetSelect.value;
  if (!presetId) return;

  const presets = loadSavedPresets();
  const preset = presets.find((p) => p.id === presetId);
  const name = preset ? preset.name : "este preset";

  if (!window.confirm(`Deseja realmente excluir o preset "${name}"?`)) {
    return;
  }

  deletePresetFromStorage(presetId);
  renderPresetsDropdown();
  showToast(`Preset "${name}" excluído.`);
}

function handleExportPresets() {
  const presets = loadSavedPresets();
  if (!presets.length) {
    showToast("Não há presets salvos para exportar.", true);
    return;
  }

  const selectedId = elements.presetSelect.value;
  if (selectedId) {
    const single = presets.find((p) => p.id === selectedId);
    if (single) {
      const json = exportPresetsJson(single);
      const safeName = single.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      triggerFileDownload(`preset-${safeName || "rota"}.json`, json);
      showToast(`Preset "${single.name}" exportado com sucesso!`);
      return;
    }
  }

  const json = exportPresetsJson(presets);
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerFileDownload(`presets-rotas-${dateStr}.json`, json);
  showToast(`${presets.length} presets exportados em arquivo JSON!`);
}

function handleExportCalculatedRoute() {
  if (!state.lastRoute) {
    showToast("Nenhuma rota calculada para exportar.", true);
    return;
  }

  const mapOption = elements.mapSelect?.selectedOptions[0];
  const mapLabel = mapOption ? mapOption.textContent : state.selectedMapId || "";
  const cityName = mapLabel ? mapLabel.split(",")[0].trim() : "Rota";

  const settings = {
    algorithm: elements.algorithm?.value || state.lastRoute.algorithm,
    modelType: elements.modelType?.value || state.lastRoute.modelType,
    orderStrategy: elements.orderStrategy?.value || state.lastRoute.orderInfo?.strategy,
    orderBudget: Number(elements.orderBudget?.value) || 500,
    averageSpeed: Number(elements.averageSpeed?.value) || 40,
    useH3: state.useH3Corridor,
    h3Resolution: state.h3Resolution,
    returnToStart: elements.returnToStart?.checked || state.lastRoute.returnToStart,
  };

  const name = `Rota Calculada - ${cityName} (${state.stops.length} pts)`;
  const jsonContent = exportCalculatedRouteJson({
    name,
    mapId: state.selectedMapId,
    mapLabel,
    settings,
    stops: state.stops,
    route: state.lastRoute,
  });

  const safeCity = cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const algo = state.lastRoute.algorithm || "rota";
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `rota-calculada-${safeCity || "cidade"}-${algo}-${dateStr}.json`;
  triggerFileDownload(filename, jsonContent);
  showToast("Rota calculada exportada com sucesso!");
}

function handleImportPresets(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = "";

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      const imported = importPresetsFromJson(content);
      mergeImportedPresetsToStorage(imported);
      renderPresetsDropdown(imported[0].id);
      showToast(`${imported.length} ${pluralize(imported.length, "preset importado", "presets importados")}!`);
      await applyPreset(imported[0]);
    } catch (err) {
      showToast(`Falha na importação: ${err.message}`, true);
    }
  };
  reader.onerror = () => {
    showToast("Erro ao ler arquivo selecionado.", true);
  };
  reader.readAsText(file);
}

function clearCorridorLayers() {
  state.corridorLayers.forEach((layer) => layer.remove());
  state.corridorLayers = [];
}

function drawCorridorHexagons(h3Cells) {
  clearCorridorLayers();
  if (!state.map || !h3Cells || !h3Cells.size) return;
  state.lastCorridorCells = new Set(h3Cells);
  const boundaries = getHexagonBoundaries(h3Cells);
  boundaries.forEach((boundary) => {
    const polygon = L.polygon(boundary, {
      color: "#0284c7",
      weight: 1.5,
      opacity: 0.75,
      fillColor: "#38bdf8",
      fillOpacity: 0.08,
      dashArray: "3, 3",
      interactive: false,
    }).addTo(state.map);
    state.corridorLayers.push(polygon);
  });
}

function isStopDrag(event) {
  return [...(event.dataTransfer?.types || [])].some((type) =>
    ["application/x-cooproute-stop", "text/plain"].includes(type),
  );
}

function resetDropOverlay() {
  state.dragDepth = 0;
  elements.dropOverlay.classList.remove("visible");
}

function setAddMode(type) {
  state.addMode = type;
  document.querySelectorAll(".stop-tool").forEach((tool) => {
    tool.classList.toggle("active", tool.dataset.stopType === type);
  });
  elements.mapInstruction.hidden = !type;
  elements.mapInstruction.classList.toggle("delivery", type === "delivery");
  state.map.getContainer().style.cursor = type ? "crosshair" : "";

  if (type) {
    elements.instructionText.textContent = `Clique no mapa para adicionar ${type === "pickup" ? "uma coleta" : "uma entrega"}`;
  }
}

function addStop(type, latlng) {
  const edge = findNearestEdge(state.routingGraph, latlng.lat, latlng.lng);
  if (!edge) {
    showToast("Não foi encontrada uma rua próxima a esse local.", true);
    return;
  }

  state.counters[type] += 1;
  const typeName = type === "pickup" ? "Coleta" : "Entrega";
  const stop = {
    id: `${type}-${Date.now()}-${state.counters[type]}`,
    type,
    name: `${typeName} ${state.counters[type]}`,
    roadName: edge.roadName || "Via local sem nome",
    edgeIndex: edge.edgeIndex,
    latitude: edge.latitude,
    longitude: edge.longitude,
    marker: null,
    deadline: type === "delivery" ? "" : null,
  };

  stop.marker = createStopMarker(stop);
  state.stops.push(stop);
  invalidateRoute();
  renderStops();
  showToast(`${stop.name} conectada à rede viária.`);

  if (type === "delivery") openDeliveryEditor(stop.id);
}

function createStopMarker(stop) {
  const marker = L.marker([stop.latitude, stop.longitude], {
    draggable: true,
    autoPan: true,
    icon: createStopIcon(stop, state.stops.length + 1),
  }).addTo(state.map);

  marker.bindTooltip(stop.name, { direction: "top", offset: [0, -16], className: "stop-tooltip" });
  marker.bindPopup(createPopupContent(stop));
  marker.on("dragend", () => {
    const position = marker.getLatLng();
    const nearestEdge = findNearestEdge(state.routingGraph, position.lat, position.lng);
    if (!nearestEdge) return;

    stop.edgeIndex = nearestEdge.edgeIndex;
    stop.latitude = nearestEdge.latitude;
    stop.longitude = nearestEdge.longitude;
    stop.roadName = nearestEdge.roadName || "Via local sem nome";
    marker.setLatLng([nearestEdge.latitude, nearestEdge.longitude]);
    marker.setPopupContent(createPopupContent(stop));
    invalidateRoute();
    renderStops();
    showToast(`${stop.name} reposicionada.`);
  });
  return marker;
}

function createStopIcon(stop, index) {
  return L.divIcon({
    className: "route-marker-wrapper",
    html: `<div class="route-marker ${stop.type}"><span>${index}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [9, 28],
    popupAnchor: [7, -28],
    tooltipAnchor: [7, -13],
  });
}

function createPopupContent(stop) {
  const coordinates = `${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}`;
  const deadlineDetails = stop.type === "delivery" && isDeliveryConfigured(stop)
    ? `<span>Prazo: ${escapeHtml(formatDeadline(stop.deadline))}</span><span>Restante: ${escapeHtml(formatRemainingTime(stop.deadline))}</span>`
    : "";
  return `<div class="stop-popup"><strong>${escapeHtml(stop.name)}</strong><span>${escapeHtml(stop.roadName)}</span>${deadlineDetails}<span>${coordinates}</span></div>`;
}

function renderStops() {
  elements.stopCount.textContent = state.stops.length;
  elements.emptyStops.hidden = state.stops.length > 0;
  elements.orderHint.hidden = state.stops.length < 2;
  const isCalculating = Boolean(state.currentCalculationController);
  elements.clearRoute.disabled = isCalculating || state.stops.length === 0;

  const pickupCount = state.stops.filter((stop) => stop.type === "pickup").length;
  const deliveries = state.stops.filter((stop) => stop.type === "delivery");
  const deliveryCount = deliveries.length;
  const incompleteDeliveries = deliveries.filter((stop) => !isDeliveryConfigured(stop)).length;
  elements.calculateRoute.disabled = isCalculating || pickupCount === 0 || deliveryCount === 0 || incompleteDeliveries > 0;
  elements.calculationNote.textContent = getCalculationNote(pickupCount, deliveryCount, incompleteDeliveries);

  elements.stopList.innerHTML = "";
  state.stops.forEach((stop, index) => {
    stop.marker.setIcon(createStopIcon(stop, index + 1));
    stop.marker.setTooltipContent(`${index + 1}. ${stop.name}`);

    const item = document.createElement("li");
    item.className = `stop-item ${stop.type}`;
    item.dataset.stopId = stop.id;
    const configured = stop.type === "pickup" || isDeliveryConfigured(stop);
    const stopDetails = stop.type === "delivery"
      ? configured
        ? `Prazo em ${formatRemainingTime(stop.deadline)}`
        : "Informe o prazo da entrega"
      : stop.roadName;
    item.innerHTML = `
      <span class="stop-sequence">${index + 1}</span>
      <span class="stop-copy"><strong>${escapeHtml(stop.name)}</strong><small class="${configured ? "" : "pending-details"}">${escapeHtml(stopDetails)}</small></span>
      <span class="stop-actions">
        ${stop.type === "delivery" ? `<button class="edit-delivery" type="button" aria-label="Editar ${escapeHtml(stop.name)}">Editar</button>` : ""}
        <button class="remove-stop" type="button" aria-label="Remover ${escapeHtml(stop.name)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </span>`;

    item.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      state.map.flyTo([stop.latitude, stop.longitude], Math.max(state.map.getZoom(), 16));
      stop.marker.openPopup();
    });
    item.querySelector(".edit-delivery")?.addEventListener("click", () => openDeliveryEditor(stop.id));
    item.querySelector(".remove-stop").addEventListener("click", () => removeStop(stop.id));
    elements.stopList.appendChild(item);
  });
}

function getCalculationNote(pickups, deliveries, incompleteDeliveries = 0) {
  if (!pickups && !deliveries) return "Adicione os pontos para começar";
  if (!pickups) return "Adicione ao menos um ponto de coleta";
  if (!deliveries) return "Adicione ao menos um ponto de entrega";
  if (incompleteDeliveries) {
    return `Preencha o prazo de ${incompleteDeliveries} ${pluralize(incompleteDeliveries, "entrega", "entregas")}`;
  }
  return `${pickups} ${pluralize(pickups, "coleta", "coletas")} • ${deliveries} ${pluralize(deliveries, "entrega", "entregas")}`;
}

function openDeliveryEditor(stopId) {
  const stop = state.stops.find((candidate) => candidate.id === stopId);
  if (!stop || stop.type !== "delivery") return;

  state.editingStopId = stop.id;
  elements.deliveryDialogTitle.textContent = stop.name;
  const remaining = getRemainingDeadlineParts(stop.deadline);
  elements.deadlineDays.value = remaining.days;
  elements.deadlineHours.value = remaining.hours;
  elements.deadlineMinutes.value = remaining.minutes;
  elements.deliveryDialog.showModal();
}

function closeDeliveryEditor() {
  if (elements.deliveryDialog.open) elements.deliveryDialog.close();
  state.editingStopId = null;
}

function saveDeliveryDeadline(event) {
  event.preventDefault();
  const stop = state.stops.find((candidate) => candidate.id === state.editingStopId);
  if (!stop) return;

  const days = Number(elements.deadlineDays.value);
  const hours = Number(elements.deadlineHours.value);
  const minutes = Number(elements.deadlineMinutes.value);
  const validParts = [days, hours, minutes].every(Number.isInteger) &&
    days >= 0 && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  const totalMinutes = days * 24 * 60 + hours * 60 + minutes;

  if (!validParts || totalMinutes <= 0) {
    showToast("Informe um prazo maior que zero.", true);
    return;
  }
  stop.deadline = new Date(Date.now() + totalMinutes * 60_000).toISOString();
  stop.marker.setPopupContent(createPopupContent(stop));
  invalidateRoute();
  closeDeliveryEditor();
  renderStops();
  showToast(`${stop.name} atualizada.`);
}

function isDeliveryConfigured(stop) {
  return stop.type === "delivery" && Number.isFinite(Date.parse(stop.deadline));
}

function removeStop(stopId) {
  const index = state.stops.findIndex((stop) => stop.id === stopId);
  if (index < 0) return;
  state.stops[index].marker.remove();
  state.stops.splice(index, 1);
  invalidateRoute();
  renderStops();
}

function clearAllStops() {
  state.stops.forEach((stop) => stop.marker.remove());
  state.stops = [];
  state.counters = { pickup: 0, delivery: 0 };
  invalidateRoute();
  renderStops();
  showToast("Planejamento limpo.");
}

function invalidateRoute() {
  clearRouteLayers();
  clearCorridorLayers();
  clearExploration();
  state.lastRoute = null;
  elements.routeSummary.hidden = true;
  elements.calculateRoute.querySelector("span").textContent = "Calcular rota";
  if (elements.exportCalculatedRoute) elements.exportCalculatedRoute.hidden = true;
}

function cancelCalculation() {
  const controller = state.currentCalculationController;
  if (!controller || controller.signal.aborted) return;

  controller.abort();
  elements.cancelCalculation.disabled = true;
  elements.cancelCalculation.textContent = "Cancelando…";
}

async function calculateRoute() {
  if (state.currentCalculationController) return;

  const pickups = state.stops.filter((stop) => stop.type === "pickup");
  const deliveries = state.stops.filter((stop) => stop.type === "delivery");
  if (!pickups.length || !deliveries.length) {
    showToast("Adicione ao menos uma coleta e uma entrega.", true);
    return;
  }
  const incompleteDelivery = deliveries.find((stop) => !isDeliveryConfigured(stop));
  if (incompleteDelivery) {
    openDeliveryEditor(incompleteDelivery.id);
    showToast("Preencha o prazo de todas as entregas.", true);
    return;
  }

  clearExploration();
  clearCorridorLayers();
  const calculationController = new AbortController();
  state.currentCalculationController = calculationController;
  elements.calculateRoute.classList.add("loading");
  elements.calculateRoute.disabled = true;
  elements.calculateRoute.querySelector("span").textContent = "Calculando";
  elements.cancelCalculation.hidden = false;
  elements.cancelCalculation.disabled = false;
  elements.cancelCalculation.textContent = "Cancelar";
  elements.algorithm.disabled = true;
  elements.modelType.disabled = true;
  elements.orderStrategy.disabled = true;
  elements.orderBudget.disabled = true;
  elements.returnToStart.disabled = true;
  elements.averageSpeed.disabled = true;
  elements.mapSelect.disabled = true;
  elements.clearRoute.disabled = true;
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const algorithm = elements.algorithm.value;
  const modelType = elements.modelType.value;
  const startedAt = performance.now();
  const departureTimeMs = Date.now();
  let result;
  let plannedStops;
  let planningTimeMs = 0;
  let searchTimeMs = 0;
  let orderInfo = null;

  try {
    const planningStartedAt = performance.now();
    const connected = connectStopsToGraph(state.graph, state.stops, {
      fallbackSpeedKph: Number(elements.averageSpeed.value),
    });
    const calculationGraph = connected.graph;
    const calculationRoutingGraph = buildRoutingGraph(calculationGraph, {
      fallbackSpeedKph: Number(elements.averageSpeed.value),
    });
    setExplorationVisibility(true);
    const travelTimeMatrix = await buildStopTravelTimeMatrix(
      calculationRoutingGraph,
      connected.stops,
      {
        signal: calculationController.signal,
        yieldControl: () => yieldExplorationBatch(calculationController.signal),
      },
    );
    const priorityStops = prioritizeStopOrder(connected.stops, {
      departureTimeMs,
      averageSpeedKph: Number(elements.averageSpeed.value),
      travelTimeMatrix,
    });
    plannedStops = priorityStops;
    orderInfo = { strategy: "priority", iterations: 0, evaluations: 0, candidateCount: 1 };
    if (elements.orderStrategy.value === "ils") {
      const optimized = await optimizeStopOrderIls({
        stops: connected.stops,
        initialOrder: priorityStops,
        departureTimeMs,
        averageSpeedKph: Number(elements.averageSpeed.value),
        travelTimeMatrix,
        returnToStart: elements.returnToStart.checked,
        budgetMs: Number(elements.orderBudget.value),
        signal: calculationController.signal,
        yieldControl: () => yieldExplorationBatch(calculationController.signal),
      });
      plannedStops = optimized.stops;
      orderInfo = { strategy: "ils", ...optimized };
      delete orderInfo.stops;
    }
    planningTimeMs = performance.now() - planningStartedAt;
    const searchStartedAt = performance.now();
    const calculatedRoute = await calculateSelectedAlgorithmRoute(
      algorithm,
      modelType,
      plannedStops,
      calculationGraph,
      calculationRoutingGraph,
      calculationController.signal,
      elements.returnToStart.checked,
    );
    searchTimeMs = performance.now() - searchStartedAt;
    plannedStops = calculatedRoute.stops;
    result = calculatedRoute.result;
  } catch (error) {
    if (error.name === "AbortError") {
      result = { cancelled: true };
    } else {
      console.error(error);
      showToast("Ocorreu um erro durante o cálculo.", true);
      result = { error: error.message };
    }
  }

  const computationTimeMs = performance.now() - startedAt;
  state.currentCalculationController = null;
  elements.calculateRoute.classList.remove("loading");
  elements.calculateRoute.disabled = false;
  elements.cancelCalculation.hidden = true;
  elements.cancelCalculation.disabled = false;
  elements.cancelCalculation.textContent = "Cancelar";
  elements.algorithm.disabled = false;
  elements.modelType.disabled = false;
  elements.orderStrategy.disabled = false;
  elements.orderBudget.disabled = false;
  elements.returnToStart.disabled = false;
  elements.averageSpeed.disabled = false;
  elements.mapSelect.disabled = false;
  elements.clearRoute.disabled = state.stops.length === 0;
  finishExploration();

  if (result.cancelled) {
    elements.calculateRoute.querySelector("span").textContent = "Calcular rota";
    showToast("Cálculo cancelado.");
    return;
  }

  if (result.error) {
    elements.calculateRoute.querySelector("span").textContent = "Calcular rota";
    showToast(result.error, true);
    return;
  }

  state.lastRoute = {
    ...result,
    computationTimeMs,
    algorithm,
    modelType,
    departureTimeMs,
    planningTimeMs,
    searchTimeMs,
    orderInfo,
    returnToStart: elements.returnToStart.checked,
    pickupCount: pickups.length,
    deliveryCount: deliveries.length,
  };
  const stopById = new Map(state.stops.map((stop) => [stop.id, stop]));
  state.stops = plannedStops
    .filter((stop) => stop.type !== "return")
    .map((stop) => stopById.get(stop.id))
    .filter(Boolean);
  renderStops();
  drawRoute(state.lastRoute);
  renderRouteSummary(state.lastRoute);
  elements.calculateRoute.querySelector("span").textContent = "Recalcular rota";
  if (elements.exportCalculatedRoute) elements.exportCalculatedRoute.hidden = false;
  showToast("Rota calculada.");
}

async function calculatePathWithSelectedAlgorithm(
  algorithm,
  modelType,
  graph,
  routingGraph,
  inicio,
  destino,
  signal,
) {
  throwIfCalculationCancelled(signal);
  const fallbackSpeedKph = Number(elements.averageSpeed?.value) || 40;
  const parameters = { grafo: graph, inicio, destino, fallbackSpeedKph };

  if (modelType === "bidirectional") {
    const progress = {
      ...parameters,
      signal,
      yieldControl: () => yieldExplorationBatch(signal),
      yieldEvery: SEARCH_BATCH_SIZE,
    };

    if (algorithm === "astar") {
      return bidirectionalAStar({
        ...progress,
        cost: "time",
        onExplore: ({ from, to }) => recordExplorationProgress(routingGraph, from, to),
      });
    }
    if (algorithm === "dijkstra") {
      return bidirectionalDijkstra({
        ...progress,
        cost: "time",
        onExplore: ({ de, para }) => recordExplorationProgress(routingGraph, de, para),
      });
    }
    if (algorithm === "dfs") {
      return bidirectionalDfs({
        ...progress,
        onExplore: ({ de, para }) => recordExplorationProgress(routingGraph, de, para),
      });
    }
    if (algorithm === "greedy") {
      return bidirectionalGreedyBestFirst({
        ...progress,
        cost: "time",
        onExplore: ({ from, to }) => recordExplorationProgress(routingGraph, from, to),
      });
    }
    if (algorithm === "beam") {
      return bidirectionalBeamSearch({
        ...progress,
        cost: "time",
        onExplore: ({ from, to }) => recordExplorationProgress(routingGraph, from, to),
      });
    }
    return bidirectionalBfs({
      ...progress,
      onExplore: ({ de, para }) => recordExplorationProgress(routingGraph, de, para),
    });
  }

  if (algorithm === "astar") {
    return aStarWithProgress({
      ...parameters,
      cost: "time",
      signal,
      onExplore: ({ from, to }) =>
        recordExplorationProgress(routingGraph, from, to),
      yieldControl: () => yieldExplorationBatch(signal),
      yieldEvery: SEARCH_BATCH_SIZE,
    });
  }

  if (algorithm === "dfs") {
    return dfs({
      ...parameters,
      cost: "time",
      signal,
      onExplore: ({ de, para }) =>
        recordExplorationProgress(routingGraph, de, para),
      yieldControl: () => yieldExplorationBatch(signal),
      yieldEvery: SEARCH_BATCH_SIZE,
    });
  }

  if (algorithm === "dijkstra") {
    return dijkstra({
      ...parameters,
      cost: "time",
      signal,
      onExplore: ({ de, para }) =>
        recordExplorationProgress(routingGraph, de, para),
      yieldControl: () => yieldExplorationBatch(signal),
      yieldEvery: SEARCH_BATCH_SIZE,
    });
  }

  if (algorithm === "greedy") {
    return greedyBestFirst({
      ...parameters,
      cost: "time",
      signal,
      onExplore: ({ from, to }) =>
        recordExplorationProgress(routingGraph, from, to),
      yieldControl: () => yieldExplorationBatch(signal),
      yieldEvery: SEARCH_BATCH_SIZE,
    });
  }

  if (algorithm === "beam") {
    return beamSearch({
      ...parameters,
      cost: "time",
      signal,
      onExplore: ({ from, to }) =>
        recordExplorationProgress(routingGraph, from, to),
      yieldControl: () => yieldExplorationBatch(signal),
      yieldEvery: SEARCH_BATCH_SIZE,
    });
  }

  const markers = createBfsVisualizationMarkers(
    graph,
    inicio,
    destino,
    routingGraph,
    signal,
  );
  const nodeIds = await bfs({
    ...parameters,
    markers,
    yieldControl: () => yieldExplorationBatch(signal),
    yieldEvery: SEARCH_BATCH_SIZE,
  });
  throwIfCalculationCancelled(signal);
  return nodeIds;
}

async function yieldExplorationBatch(signal) {
  await new Promise((resolve) => {
    if (document.hidden) {
      setTimeout(resolve, 0);
    } else {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    }
  });
  throwIfCalculationCancelled(signal);
}

async function calculateSelectedAlgorithmRoute(
  algorithm,
  modelType,
  stops,
  graph,
  routingGraph,
  signal,
  returnToStart = false,
) {
  if (stops.length < 2) {
    return { stops: [...stops], result: assembleMultiStopRoute(stops, []) };
  }

  const routeStops = returnToStart && stops.length > 1
    ? [...stops, createReturnStop(stops[0])]
    : stops;
  const orderedStops = [routeStops[0]];
  const remainingStops = routeStops.slice(1);
  const pathResults = [];
  const allCorridorCells = new Set();
  let maxExpandedBufferLevel = 0;

  while (remainingStops.length) {
    throwIfCalculationCancelled(signal);
    const current = orderedStops.at(-1);
    const target = remainingStops[0];

    let nodeIds = null;
    let foundInCorridor = false;

    if (state.useH3Corridor && typeof window !== "undefined" && window.h3) {
      const startNode = routingGraph.nodes.get(current.nodeId);
      const targetNode = routingGraph.nodes.get(target.nodeId);

      if (startNode && targetNode) {
        const resolution = state.h3Resolution || 9;
        const startCell = window.h3.latLngToCell(Number(startNode.latitude), Number(startNode.longitude), resolution);
        const goalCell = window.h3.latLngToCell(Number(targetNode.latitude), Number(targetNode.longitude), resolution);
        const baseLine = getBaseCorridor(startCell, goalCell, resolution, window.h3);

        let bufferK = 0;
        let prevCellCount = 0;

        while (true) {
          throwIfCalculationCancelled(signal);
          const allowedCells = expandCorridor(baseLine, bufferK, window.h3);
          if (allowedCells.size === prevCellCount && bufferK > 0) {
            break;
          }
          prevCellCount = allowedCells.size;

          const corridorGraph = filterGraphByCorridor(
            graph,
            allowedCells,
            new Set(),
            resolution,
            current.nodeId,
            target.nodeId,
            window.h3,
          );
          const corridorRoutingGraph = buildRoutingGraph(corridorGraph, {
            fallbackSpeedKph: Number(elements.averageSpeed.value),
          });

          allowedCells.forEach((c) => allCorridorCells.add(c));
          if (state.h3ShowPolygons) {
            drawCorridorHexagons(allCorridorCells);
          }

          nodeIds = await calculatePathWithSelectedAlgorithm(
            algorithm,
            modelType,
            corridorGraph,
            corridorRoutingGraph,
            current.nodeId,
            target.nodeId,
            signal,
          );

          if (nodeIds && nodeIds.at(-1) === target.nodeId) {
            foundInCorridor = true;
            maxExpandedBufferLevel = Math.max(maxExpandedBufferLevel, bufferK);
            break;
          }

          // Expansão dinâmica sem teto fixo de anéis
          if (bufferK === 0) bufferK = 1;
          else if (bufferK < 4) bufferK += 1;
          else if (bufferK < 10) bufferK += 2;
          else bufferK += Math.max(3, Math.floor(bufferK * 0.3));

          if (corridorGraph.nodes.length >= graph.nodes.length || bufferK > 200) {
            break;
          }
        }

        if (!foundInCorridor || !nodeIds || nodeIds.at(-1) !== target.nodeId) {
          nodeIds = await calculatePathWithSelectedAlgorithm(
            algorithm,
            modelType,
            graph,
            routingGraph,
            current.nodeId,
            target.nodeId,
            signal,
          );
        }
      }
    } else {
      nodeIds = await calculatePathWithSelectedAlgorithm(
        algorithm,
        modelType,
        graph,
        routingGraph,
        current.nodeId,
        target.nodeId,
        signal,
      );
    }

    if (!nodeIds || nodeIds.at(-1) !== target.nodeId) {
      return {
        stops,
        result: assembleMultiStopRoute([current, target], [null]),
      };
    }

    const encounteredStops = findStopsOnPath(
      nodeIds,
      remainingStops,
      target.type,
    );
    let previousNodeIndex = 0;

    for (const stop of encounteredStops) {
      const nodeIndex = nodeIds.indexOf(stop.nodeId, previousNodeIndex);
      if (nodeIndex < 0) continue;

      const segmentNodeIds = nodeIds.slice(previousNodeIndex, nodeIndex + 1);
      pathResults.push(buildPathResult(routingGraph, segmentNodeIds));
      orderedStops.push(stop);
      remainingStops.splice(remainingStops.indexOf(stop), 1);
      previousNodeIndex = nodeIndex;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const multiStopResult = assembleMultiStopRoute(orderedStops, pathResults);
  if (multiStopResult && !multiStopResult.error) {
    multiStopResult.h3Info = state.useH3Corridor ? {
      bufferK: maxExpandedBufferLevel,
      cellCount: allCorridorCells.size,
      resolution: state.h3Resolution,
    } : null;
  }

  return {
    stops: orderedStops.filter((stop) => stop.type !== "return"),
    result: multiStopResult,
  };
}

function createReturnStop(firstStop) {
  return {
    ...firstStop,
    id: `return:${firstStop.id}`,
    type: "return",
    name: `${firstStop.name} (retorno)`,
    deadline: null,
  };
}

function drawRoute(result) {
  clearRouteLayers();
  const latlngs = result.coordinates;
  if (latlngs.length < 2) return;

  const casing = L.polyline(latlngs, { pane: "routePane", color: "#fff", weight: 9, opacity: .94, lineJoin: "round", interactive: false }).addTo(state.map);
  const route = L.polyline(latlngs, { pane: "routePane", color: "#176b43", weight: 5, opacity: 1, lineJoin: "round" }).addTo(state.map);
  state.routeLayers.push(casing, route);
  state.stops.forEach((stop) => stop.marker.setZIndexOffset(1000));
  state.map.fitBounds(route.getBounds(), { padding: [55, 55], maxZoom: 16 });
}

function renderRouteSummary(result, scrollToSummary = true) {
  elements.totalDistance.textContent = formatDistance(result.distanceMeters);
  elements.estimatedTime.textContent = formatDuration(result.travelTimeSeconds);
  elements.planningTime.textContent = formatComputationTime(result.planningTimeMs || 0);
  elements.searchTime.textContent = formatComputationTime(result.searchTimeMs || 0);
  elements.pickupTotal.textContent = result.pickupCount;
  elements.deliveryTotal.textContent = result.deliveryCount;
  elements.computationTime.textContent = formatComputationTime(result.computationTimeMs);
  const orderLabel = result.orderInfo?.strategy === "ils" ? "ILS" : "Prioridade";
  elements.selectedAlgorithm.textContent = `${getAlgorithmLabel(result.algorithm)} · ${result.modelType === "bidirectional" ? "Bidirecional" : "Normal"} · ${orderLabel}`;
  if (elements.h3Metric) {
    elements.h3Metric.textContent = result.h3Info
      ? `Nível ${result.h3Info.bufferK} (${result.h3Info.cellCount} hex)`
      : (state.useH3Corridor ? "Ativo" : "Desativado");
  }
  let cumulativeTimeSeconds = 0;
  elements.segmentList.innerHTML = result.segments.map((segment, index) => {
    cumulativeTimeSeconds += segment.travelTimeSeconds;
    const mainRoad = segment.roads[0] || "Vias locais";
    let deliveryDetails = "";
    if (segment.to.type === "delivery") {
      const estimatedCompletion = result.departureTimeMs + cumulativeTimeSeconds * 1000;
      const slackSeconds = (Date.parse(segment.to.deadline) - estimatedCompletion) / 1000;
      const isLate = slackSeconds < 0;
      deliveryDetails = `<small class="deadline-detail ${isLate ? "late" : ""}">Chegada ${escapeHtml(formatTime(estimatedCompletion))} · prazo ${escapeHtml(formatDeadline(segment.to.deadline))} · ${isLate ? `atraso ${escapeHtml(formatDuration(-slackSeconds))}` : `folga ${escapeHtml(formatDuration(slackSeconds))}`}</small>`;
    }
    return `<div class="segment-row">
      <span class="segment-number">${index + 1}</span>
      <span class="segment-copy"><strong>${escapeHtml(segment.from.name)} → ${escapeHtml(segment.to.name)}</strong><small>${escapeHtml(mainRoad)}</small>${deliveryDetails}</span>
      <span class="segment-metric">${formatDistance(segment.distanceMeters)} · ${formatDuration(segment.travelTimeSeconds)}</span>
    </div>`;
  }).join("");
  elements.routeSummary.hidden = false;
  if (scrollToSummary) {
    elements.routeSummary.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function clearRouteLayers() {
  state.routeLayers.forEach((layer) => layer.remove());
  state.routeLayers = [];
}

function createBfsVisualizationMarkers(
  graph,
  startNode,
  targetNode,
  routingGraph,
  signal,
) {
  const predecessors = buildBfsPredecessors(graph, startNode, targetNode);
  const markers = new Map();

  for (const [node, predecessor] of predecessors) {
    markers.set(node, {
      setStyle: () => {
        throwIfCalculationCancelled(signal);
        recordExplorationProgress(routingGraph, predecessor, node);
      },
    });
  }

  return markers;
}

function buildBfsPredecessors(graph, startNode, targetNode) {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    if (adjacency.has(edge.from) && adjacency.has(edge.to)) {
      adjacency.get(edge.from).push(edge.to);
    }
  }

  const queue = [startNode];
  const visited = new Set([startNode]);
  const predecessors = new Map();

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === targetNode) break;

    for (const neighbor of adjacency.get(current) || []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      predecessors.set(neighbor, current);
      queue.push(neighbor);
    }
  }

  return predecessors;
}

function recordExploredEdge(routingGraph, from, to) {
  if (from === undefined || to === undefined) return;
  const candidates = (routingGraph.adjacency.get(from) || [])
    .filter((edge) => edge.to === to);
  if (!candidates.length) return;

  const edge = candidates.reduce((best, candidate) =>
    candidate.travelTimeSeconds < best.travelTimeSeconds ? candidate : best,
  );
  const key = `${String(from)}\u0000${String(to)}\u0000${edge.edgeIndex}`;
  if (!state.exploredEdgeKeys.has(key)) {
    state.exploredEdgeKeys.add(key);
    L.polyline(edge.geometry, {
      pane: "explorationPane",
      color: "#e0a400",
      weight: 4,
      opacity: .72,
      lineJoin: "round",
      interactive: false,
    }).addTo(state.explorationGroup);
  }

  if (!state.activeExplorationLayer) {
    state.activeExplorationLayer = L.polyline(edge.geometry, {
      pane: "explorationPane",
      color: "#f26b21",
      weight: 7,
      opacity: .95,
      dashArray: "10 8",
      lineJoin: "round",
      interactive: false,
    }).addTo(state.explorationGroup);
  } else {
    state.activeExplorationLayer.setLatLngs(edge.geometry);
  }
  state.activeExplorationLayer.bringToFront();
}

function recordExplorationProgress(routingGraph, from, to) {
  recordExploredEdge(routingGraph, from, to);
}

function throwIfCalculationCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Cálculo cancelado.");
  error.name = "AbortError";
  throw error;
}

function setExplorationVisibility(visible) {
  if (!state.explorationGroup) return;
  if (visible) {
    state.explorationGroup.addTo(state.map);
  } else {
    state.explorationGroup.remove();
  }
}

function finishExploration() {
  if (state.activeExplorationLayer) {
    state.explorationGroup.removeLayer(state.activeExplorationLayer);
  }
  state.activeExplorationLayer = null;
  setExplorationVisibility(false);
  elements.explorationToggle.checked = false;
  elements.explorationToggle.disabled = state.exploredEdgeKeys.size === 0;
}

function clearExploration() {
  if (!state.explorationGroup) return;
  state.explorationGroup.remove();
  state.explorationGroup.clearLayers();
  state.exploredEdgeKeys.clear();
  state.activeExplorationLayer = null;
  elements.explorationToggle.checked = false;
  elements.explorationToggle.disabled = true;
}

function toggleNetworkLayer() {
  if (!state.graph) {
    elements.networkToggle.checked = false;
    return;
  }
  if (elements.networkToggle.checked) {
    if (!state.networkLayer) {
      const lines = [];
      for (const edge of state.graph.edges) {
        const from = state.routingGraph.nodes.get(edge.from);
        const to = state.routingGraph.nodes.get(edge.to);
        if (from && to) {
          lines.push(
            Array.isArray(edge.geometry) && edge.geometry.length >= 2
              ? edge.geometry
              : [[from.latitude, from.longitude], [to.latitude, to.longitude]],
          );
        }
      }
      state.networkLayer = L.polyline(lines, { color: "#48705a", weight: 1, opacity: .27, interactive: false });
    }
    state.networkLayer.addTo(state.map);
  } else {
    state.networkLayer?.remove();
  }
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function formatDuration(seconds) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

function formatComputationTime(milliseconds) {
  if (milliseconds < 1) return `${milliseconds.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ms`;
  if (milliseconds < 1000) return `${milliseconds.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ms`;
  return `${(milliseconds / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} s`;
}

function getAlgorithmLabel(value) {
  return {
    astar: "A*",
    bfs: "BFS",
    dfs: "DFS",
    dijkstra: "Dijkstra",
    greedy: "Greedy Best-First",
    beam: "Beam Search",
  }[value] || value;
}

function getRemainingDeadlineParts(value) {
  const deadline = Date.parse(value);
  if (!Number.isFinite(deadline)) return { days: 0, hours: 0, minutes: 0 };

  const totalMinutes = Math.max(0, Math.ceil((deadline - Date.now()) / 60_000));
  return {
    days: Math.floor(totalMinutes / (24 * 60)),
    hours: Math.floor((totalMinutes % (24 * 60)) / 60),
    minutes: totalMinutes % 60,
  };
}

function formatRemainingTime(value) {
  const deadline = Date.parse(value);
  if (!Number.isFinite(deadline)) return "prazo inválido";
  if (deadline <= Date.now()) return "vencido";

  const { days, hours, minutes } = getRemainingDeadlineParts(value);
  return [
    days ? `${days}d` : "",
    hours ? `${hours}h` : "",
    minutes || (!days && !hours) ? `${minutes}min` : "",
  ].filter(Boolean).join(" ");
}

function formatDeadline(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "prazo inválido";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function pluralize(value, singular, plural) { return value === 1 ? singular : plural; }
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function showToast(message, isError = false) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("visible");
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2600);
}

initialize();
