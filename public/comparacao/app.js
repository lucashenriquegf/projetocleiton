import {
  buildRoutingGraph,
  connectStopsToGraph,
  findNearestEdge,
} from "/algorithms/routing.mjs";
import { getHexagonBoundaries } from "/algorithms/h3_corridor.js";
import {
  prepareRouteComparison,
  prepareRouteNetwork,
  recommendComparisonWorkerCount,
  runRouteConfiguration,
} from "/algorithms/routeComparison.js";
import {
  exportPresetsJson,
  importPresetsFromJson,
  loadSavedPresets,
  savePresetToStorage,
  deletePresetFromStorage,
  mergeImportedPresetsToStorage,
  serializeStops,
  triggerFileDownload,
} from "/pointPresets.js";

const COLORS = ["#176b43", "#2563a7", "#dc6d2d", "#7c3ba8", "#b2455b", "#14818b", "#7a6420", "#4f5db6"];
const ALGORITHM_LABELS = {
  astar: "A*",
  bfs: "BFS",
  dfs: "DFS",
  dijkstra: "Dijkstra",
  greedy: "Greedy Best-First",
  beam: "Beam Search",
};

const state = {
  graph: null,
  routingGraph: null,
  visualRoutingGraph: null,
  map: null,
  stops: [],
  counters: { pickup: 0, delivery: 0 },
  addMode: null,
  editingStopId: null,
  configurations: [],
  configurationCounter: 0,
  collapsedConfigurationGroups: new Set(),
  currentController: null,
  results: [],
  collapsedResultGroups: new Set(),
  selectedResultIds: new Set(),
  resultMaps: [],
  overlayMap: null,
  animationFrame: null,
  playbackIndexes: [],
  playbackPaused: false,
  syncingMaps: false,
  activeWorkers: [],
  selectedMapId: null,
  mapLoadController: null,
  mapLoading: true,
  visualizationWorker: null,
  visualizationController: null,
  visualizationRevision: 0,
  lastComparisonContext: null,
  commonPreparationTimeMs: 0,
};

const elements = {
  cityName: document.querySelector("#city-name"),
  mapSelect: document.querySelector("#road-network"),
  scenarioMap: document.querySelector("#scenario-map"),
  loadingMap: document.querySelector("#loading-map"),
  mapInstruction: document.querySelector("#map-instruction"),
  clearStops: document.querySelector("#clear-stops"),
  stopList: document.querySelector("#stop-list"),
  averageSpeed: document.querySelector("#average-speed"),
  speedValue: document.querySelector("#speed-value"),
  returnToStart: document.querySelector("#return-to-start"),
  groupAddToggle: document.querySelector("#group-add-toggle"),
  groupAddMenu: document.querySelector("#group-add-menu"),
  selectAllAlgos: document.querySelector("#select-all-algos"),
  groupAllVariations: document.querySelector("#group-all-variations"),
  groupCustomVariations: document.querySelector("#group-custom-variations"),
  groupConfirmAdd: document.querySelector("#group-confirm-add"),
  groupReplaceExisting: document.querySelector("#group-replace-existing"),
  clearConfigurations: document.querySelector("#clear-configurations"),
  configurationList: document.querySelector("#configuration-list"),
  configurationSummary: document.querySelector("#configuration-summary"),
  expandConfigurationGroups: document.querySelector("#expand-configuration-groups"),
  collapseConfigurationGroups: document.querySelector("#collapse-configuration-groups"),
  addConfiguration: document.querySelector("#add-configuration"),


  runComparison: document.querySelector("#run-comparison"),
  cancelComparison: document.querySelector("#cancel-comparison"),
  comparisonStatus: document.querySelector("#comparison-status"),
  results: document.querySelector("#results"),
  resultsBody: document.querySelector("#results-body"),
  scoreboardMode: document.querySelector("#scoreboard-mode"),
  sortResults: document.querySelector("#sort-results"),
  sortSecondary: document.querySelector("#sort-secondary"),
  visualMode: document.querySelector("#visual-mode"),
  playbackSpeed: document.querySelector("#playback-speed"),
  replay: document.querySelector("#replay"),
  pause: document.querySelector("#pause"),
  comparisonMaps: document.querySelector("#comparison-maps"),
  overlayWrap: document.querySelector("#overlay-wrap"),
  overlayLegend: document.querySelector("#overlay-legend"),
  deadlineDialog: document.querySelector("#deadline-dialog"),
  deadlineForm: document.querySelector("#deadline-form"),
  deadlineTitle: document.querySelector("#deadline-title"),
  deadlineDays: document.querySelector("#deadline-days"),
  deadlineHours: document.querySelector("#deadline-hours"),
  deadlineMinutes: document.querySelector("#deadline-minutes"),
  closeDeadline: document.querySelector("#close-deadline"),
  cancelDeadline: document.querySelector("#cancel-deadline"),
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
  toast: document.querySelector("#toast"),
};

initialize();

async function initialize() {
  initializeScenarioMap();
  bindEvents();
  renderPresetsDropdown();
  addConfiguration({ algorithm: "astar", modelType: "normal", useH3: true, h3Resolution: 9 });
  addConfiguration({ algorithm: "astar", modelType: "bidirectional", useH3: false, h3Resolution: 9 });

  try {
    await loadMapCatalog();
  } catch (error) {
    console.error(error);
    elements.loadingMap.textContent = "Erro ao carregar a malha viária.";
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
    // O armazenamento local é opcional.
  }
  const initialMapId = catalog.defaultMapId || (catalog.maps.some((map) => map.id === storedMapId)
    ? storedMapId
    : catalog.maps[0].id);
  elements.mapSelect.value = initialMapId;
  await loadRoadNetwork(initialMapId, { initial: true });
}

async function loadRoadNetwork(mapId, { initial = false } = {}) {
  if (!mapId || state.currentController) return;
  state.mapLoadController?.abort();
  const controller = new AbortController();
  state.mapLoadController = controller;
  const previousMapId = state.selectedMapId;
  state.mapLoading = true;
  elements.mapSelect.disabled = true;
  elements.loadingMap.hidden = false;
  elements.loadingMap.textContent = "Carregando malha viária…";
  document.querySelectorAll(".stop-button").forEach((button) => { button.disabled = true; });

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

    if (!initial || state.stops.length) resetScenarioForMapChange();
    state.graph = graph;
    state.routingGraph = buildRoutingGraph(graph, {
      fallbackSpeedKph: Number(elements.averageSpeed.value),
    });
    state.visualRoutingGraph = null;
    state.selectedMapId = mapId;
    elements.mapSelect.value = mapId;
    elements.cityName.textContent = (graph.city || elements.mapSelect.selectedOptions[0]?.textContent || mapId)
      .replace(/,?\s*Brazil$/i, "");

    const bounds = L.latLngBounds();
    graph.nodes.forEach((node) => bounds.extend([node.latitude, node.longitude]));
    if (bounds.isValid()) state.map.fitBounds(bounds, { padding: [24, 24] });
    try {
      localStorage.setItem("routing.selectedMapId", mapId);
    } catch {
      // Persistência é apenas uma conveniência.
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    elements.mapSelect.value = previousMapId || mapId;
    if (!state.graph) elements.loadingMap.textContent = "Erro ao carregar a malha viária.";
    showToast(error.message, true);
    throw error;
  } finally {
    if (state.mapLoadController === controller) {
      state.mapLoadController = null;
      state.mapLoading = false;
      elements.mapSelect.disabled = Boolean(state.currentController);
      document.querySelectorAll(".stop-button").forEach((button) => {
        button.disabled = Boolean(state.currentController);
      });
      if (state.graph) elements.loadingMap.hidden = true;
      updateReadyState();
    }
  }
}

function resetScenarioForMapChange() {
  state.stops.forEach((stop) => stop.marker.remove());
  state.stops = [];
  state.counters = { pickup: 0, delivery: 0 };
  setAddMode(null);
  renderStops();
  invalidateResults();
}

function initializeScenarioMap() {
  state.map = L.map(elements.scenarioMap, { zoomControl: false, preferCanvas: true })
    .setView([-16.68, -49.25], 12);
  addTileLayer(state.map);
  state.map.on("click", (event) => {
    if (!state.addMode || !state.routingGraph || state.currentController || state.mapLoading) return;
    addStop(state.addMode, event.latlng);
    setAddMode(null);
  });
}

function bindEvents() {
  document.querySelectorAll(".stop-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.currentController && !state.mapLoading) setAddMode(button.dataset.stopType);
    });
  });
  elements.mapSelect.addEventListener("change", () => {
    loadRoadNetwork(elements.mapSelect.value).catch((error) => console.error(error));
  });
  elements.clearStops.addEventListener("click", clearStops);
  elements.averageSpeed.addEventListener("input", () => {
    elements.speedValue.textContent = elements.averageSpeed.value;
    invalidateResults();
  });
  elements.returnToStart.addEventListener("change", invalidateResults);
  elements.addConfiguration.addEventListener("click", () => addConfiguration());
  elements.groupAddToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleGroupMenu();
  });
  elements.groupAddMenu.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  document.addEventListener("click", (event) => {
    if (!elements.groupAddMenu.hidden && !elements.groupAddMenu.contains(event.target) && !elements.groupAddToggle.contains(event.target)) {
      toggleGroupMenu(false);
    }
  });
  elements.selectAllAlgos.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".group-algo");
    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
    checkboxes.forEach((cb) => { cb.checked = !allChecked; });
    updateGroupCalculations();
  });
  document.querySelectorAll(".group-algo, .group-model, .group-h3, .group-order").forEach((cb) => {
    cb.addEventListener("change", updateGroupCalculations);
  });
  elements.groupAllVariations.addEventListener("change", updateGroupCalculations);
  elements.groupConfirmAdd.addEventListener("click", handleGroupConfirmAdd);


  elements.clearConfigurations.addEventListener("click", clearConfigurations);
  elements.expandConfigurationGroups.addEventListener("click", () => {
    state.collapsedConfigurationGroups.clear();
    renderConfigurations();
  });
  elements.collapseConfigurationGroups.addEventListener("click", () => {
    state.collapsedConfigurationGroups = new Set(
      state.configurations.map(({ algorithm }) => algorithm),
    );
    renderConfigurations();
  });
  elements.runComparison.addEventListener("click", runComparison);
  elements.cancelComparison.addEventListener("click", cancelComparison);
  elements.scoreboardMode.addEventListener("change", renderResultsTable);
  elements.sortResults.addEventListener("change", () => {
    if (elements.sortSecondary.value === elements.sortResults.value) {
      elements.sortSecondary.value = "none";
    }
    renderResultsTable();
  });
  elements.sortSecondary.addEventListener("change", () => {
    if (elements.sortSecondary.value === elements.sortResults.value) {
      elements.sortSecondary.value = "none";
      showToast("O critério de desempate deve ser diferente do primeiro critério.");
    }
    renderResultsTable();
  });
  elements.visualMode.addEventListener("change", updateVisualMode);
  elements.replay.addEventListener("click", startPlayback);
  elements.pause.addEventListener("click", togglePlaybackPause);
  elements.deadlineForm.addEventListener("submit", saveDeadline);
  elements.closeDeadline.addEventListener("click", closeDeadlineDialog);
  elements.cancelDeadline.addEventListener("click", closeDeadlineDialog);
  elements.deadlineDialog.addEventListener("close", () => { state.editingStopId = null; });

  elements.presetSelect?.addEventListener("change", () => {
    const selectedId = elements.presetSelect.value;
    if (elements.deletePresetBtn) elements.deletePresetBtn.disabled = !selectedId;
    if (selectedId) {
      const presets = loadSavedPresets();
      const preset = presets.find((p) => p.id === selectedId);
      if (preset) applyPreset(preset);
    }
  });
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
  if (state.currentController) return;
  if (!preset || !Array.isArray(preset.stops) || preset.stops.length === 0) {
    showToast("O preset selecionado não contém pontos.", true);
    return;
  }

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

  clearStops();

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
      deadline: stopItem.type === "delivery"
        ? (stopItem.deadlineMinutes
            ? new Date(Date.now() + stopItem.deadlineMinutes * 60_000).toISOString()
            : (stopItem.deadline && Number.isFinite(Date.parse(stopItem.deadline)) && new Date(stopItem.deadline) > new Date()
                ? stopItem.deadline
                : new Date(Date.now() + 60 * 60_000).toISOString()))
        : null,
      marker: null,
    };
    stop.marker = createScenarioMarker(stop);
    state.stops.push(stop);
  });

  renderStops();
  invalidateResults();

  if (preset.settings && typeof preset.settings === "object") {
    if (preset.settings.averageSpeed && elements.averageSpeed) {
      elements.averageSpeed.value = String(preset.settings.averageSpeed);
      if (elements.speedValue) elements.speedValue.textContent = String(preset.settings.averageSpeed);
    }
    if (preset.settings.returnToStart !== undefined && elements.returnToStart) {
      elements.returnToStart.checked = Boolean(preset.settings.returnToStart);
    }
  }

  if (state.stops.length > 0) {
    const bounds = L.latLngBounds(state.stops.map((s) => [s.latitude, s.longitude]));
    if (bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }

  if (connectedCount === 0) {
    showToast("Não foi possível conectar os pontos do preset à malha viária atual.", true);
  } else {
    showToast(`Preset "${preset.name}" carregado com ${connectedCount} paradas.`);
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
  elements.presetNameInput.value = `Cenário ${mapLabel ? mapLabel.split(",")[0] : ""} (${state.stops.length} pts)`.trim();
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
      triggerFileDownload(`preset-${safeName || "cenario"}.json`, json);
      showToast(`Preset "${single.name}" exportado com sucesso!`);
      return;
    }
  }

  const json = exportPresetsJson(presets);
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerFileDownload(`presets-rotas-${dateStr}.json`, json);
  showToast(`${presets.length} presets exportados em arquivo JSON!`);
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

function setAddMode(type) {
  state.addMode = type;
  document.querySelectorAll(".stop-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.stopType === type);
  });
  elements.mapInstruction.hidden = !type;
  if (type) {
    elements.mapInstruction.textContent = `Clique no mapa para adicionar ${type === "pickup" ? "uma coleta" : "uma entrega"}`;
  }
  state.map.getContainer().style.cursor = type ? "crosshair" : "";
}

function addStop(type, latlng) {
  const edge = findNearestEdge(state.routingGraph, latlng.lat, latlng.lng);
  if (!edge) return showToast("Não foi encontrada uma rua próxima.", true);
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
    deadline: type === "delivery" ? "" : null,
    marker: null,
  };
  stop.marker = createScenarioMarker(stop);
  state.stops.push(stop);
  renderStops();
  invalidateResults();
  if (type === "delivery") openDeadlineDialog(stop.id);
}

function createScenarioMarker(stop) {
  const marker = L.marker([stop.latitude, stop.longitude], {
    draggable: true,
    autoPan: true,
    icon: createMarkerIcon(stop, state.stops.length + 1),
  }).addTo(state.map);
  marker.bindTooltip(stop.name, { direction: "top", offset: [5, -16] });
  marker.on("dragend", () => {
    if (state.currentController) return;
    const point = marker.getLatLng();
    const edge = findNearestEdge(state.routingGraph, point.lat, point.lng);
    if (!edge) return marker.setLatLng([stop.latitude, stop.longitude]);
    stop.edgeIndex = edge.edgeIndex;
    stop.latitude = edge.latitude;
    stop.longitude = edge.longitude;
    stop.roadName = edge.roadName || "Via local sem nome";
    marker.setLatLng([stop.latitude, stop.longitude]);
    renderStops();
    invalidateResults();
  });
  return marker;
}

function createMarkerIcon(stop, index) {
  return L.divIcon({
    className: "compare-marker-wrap",
    html: `<div class="compare-marker ${stop.type}"><span>${index}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [8, 25],
  });
}

function renderStops() {
  elements.stopList.innerHTML = "";
  if (!state.stops.length) {
    elements.stopList.innerHTML = '<li class="empty">Nenhum ponto adicionado.</li>';
  }
  state.stops.forEach((stop, index) => {
    stop.marker.setIcon(createMarkerIcon(stop, index + 1));
    const item = document.createElement("li");
    item.className = `stop-row ${stop.type}`;
    const detail = stop.type === "delivery"
      ? (isDeliveryConfigured(stop) ? `Prazo em ${formatRemainingTime(stop.deadline)}` : "Prazo não informado")
      : stop.roadName;
    item.innerHTML = `
      <span class="stop-index">${index + 1}</span>
      <span class="stop-copy"><strong>${escapeHtml(stop.name)}</strong><small>${escapeHtml(detail)}</small></span>
      <span class="stop-row-actions">
        ${stop.type === "delivery" ? '<button class="icon-button edit" type="button">Editar</button>' : ""}
        <button class="icon-button remove" type="button">Remover</button>
      </span>`;
    item.querySelector(".edit")?.addEventListener("click", () => openDeadlineDialog(stop.id));
    item.querySelector(".remove").addEventListener("click", () => removeStop(stop.id));
    elements.stopList.appendChild(item);
  });
  elements.clearStops.disabled = Boolean(state.currentController) || !state.stops.length;
  updateReadyState();
}

function removeStop(stopId) {
  const index = state.stops.findIndex((stop) => stop.id === stopId);
  if (index < 0 || state.currentController) return;
  state.stops[index].marker.remove();
  state.stops.splice(index, 1);
  renderStops();
  invalidateResults();
}

function clearStops() {
  if (state.currentController) return;
  state.stops.forEach((stop) => stop.marker.remove());
  state.stops = [];
  state.counters = { pickup: 0, delivery: 0 };
  renderStops();
  invalidateResults();
}

function openDeadlineDialog(stopId) {
  if (state.currentController) return;
  const stop = state.stops.find((candidate) => candidate.id === stopId);
  if (!stop || stop.type !== "delivery") return;
  state.editingStopId = stopId;
  elements.deadlineTitle.textContent = stop.name;
  const remaining = getRemainingDeadlineParts(stop.deadline);
  elements.deadlineDays.value = remaining.days;
  elements.deadlineHours.value = remaining.hours || (stop.deadline ? 0 : 1);
  elements.deadlineMinutes.value = remaining.minutes;
  elements.deadlineDialog.showModal();
}

function closeDeadlineDialog() {
  if (elements.deadlineDialog.open) elements.deadlineDialog.close();
  state.editingStopId = null;
}

function saveDeadline(event) {
  event.preventDefault();
  const stop = state.stops.find((candidate) => candidate.id === state.editingStopId);
  if (!stop) return;
  const days = Number(elements.deadlineDays.value);
  const hours = Number(elements.deadlineHours.value);
  const minutes = Number(elements.deadlineMinutes.value);
  const valid = [days, hours, minutes].every(Number.isInteger) &&
    days >= 0 && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  const totalMinutes = days * 1440 + hours * 60 + minutes;
  if (!valid || totalMinutes <= 0) return showToast("Informe um prazo maior que zero.", true);
  stop.deadline = new Date(Date.now() + totalMinutes * 60_000).toISOString();
  closeDeadlineDialog();
  renderStops();
  invalidateResults();
}

function addConfiguration(template = null) {
  const configuration = createConfiguration(template);
  state.configurations.push(configuration);
  state.collapsedConfigurationGroups.delete(configuration.algorithm);
  renderConfigurations();
  invalidateResults();
}

function createConfiguration(template = null) {
  state.configurationCounter += 1;
  return {
    id: `configuration-${Date.now()}-${state.configurationCounter}-${Math.random().toString(36).slice(2, 6)}`,
    number: state.configurationCounter,
    color: COLORS[(state.configurationCounter - 1) % COLORS.length],
    algorithm: template?.algorithm || "dijkstra",
    modelType: template?.modelType || "normal",
    orderStrategy: template?.orderStrategy === "ils" ? "ils" : "priority",
    orderBudgetMs: Number(template?.orderBudgetMs) || 500,
    useH3: template?.useH3 ?? true,
    h3Resolution: Number(template?.h3Resolution) || 9,
  };
}

function toggleGroupMenu(forceState) {
  if (state.currentController) return;
  const isHidden = typeof forceState === "boolean" ? !forceState : !elements.groupAddMenu.hidden;
  elements.groupAddMenu.hidden = isHidden;
  elements.groupAddToggle.setAttribute("aria-expanded", String(!isHidden));
  if (!isHidden) {
    updateGroupCalculations();
  }
}

function updateGroupCalculations() {
  const selectedAlgos = Array.from(document.querySelectorAll(".group-algo:checked")).map((el) => el.value);
  const selectedOrders = Array.from(document.querySelectorAll(".group-order:checked")).map((el) => el.value);
  const allVariations = elements.groupAllVariations.checked;
  elements.groupCustomVariations.style.display = allVariations ? "none" : "block";

  let variationsCount = 0;
  if (allVariations) {
    variationsCount = 10;
  } else {
    const selectedModels = Array.from(document.querySelectorAll(".group-model:checked")).map((el) => el.value);
    const selectedH3 = Array.from(document.querySelectorAll(".group-h3:checked")).map((el) => el.value);
    variationsCount = selectedModels.length * selectedH3.length;
  }

  const totalConfigs = selectedAlgos.length * variationsCount * selectedOrders.length;

  if (totalConfigs > 0) {
    elements.groupConfirmAdd.disabled = false;
    elements.groupConfirmAdd.textContent = `Adicionar (${totalConfigs})`;
  } else {
    elements.groupConfirmAdd.disabled = true;
    elements.groupConfirmAdd.textContent = "Selecione ao menos 1";
  }

  const totalAlgos = document.querySelectorAll(".group-algo").length;
  if (selectedAlgos.length === totalAlgos) {
    elements.selectAllAlgos.textContent = "Desmarcar todos";
  } else {
    elements.selectAllAlgos.textContent = "Marcar todos";
  }

  return { selectedAlgos, selectedOrders, allVariations, totalConfigs };
}

function handleGroupConfirmAdd() {
  if (state.currentController) return;
  const selectedAlgos = Array.from(document.querySelectorAll(".group-algo:checked")).map((el) => el.value);
  const selectedOrders = Array.from(document.querySelectorAll(".group-order:checked")).map((el) => {
    const [orderStrategy, budget] = el.value.split(":");
    return { orderStrategy, orderBudgetMs: Number(budget) || 500 };
  });
  if (!selectedAlgos.length || !selectedOrders.length) return;

  const allVariations = elements.groupAllVariations.checked;
  let variations = [];

  if (allVariations) {
    const modelTypes = ["normal", "bidirectional"];
    const h3Variations = [
      { useH3: false, h3Resolution: 9 },
      { useH3: true, h3Resolution: 7 },
      { useH3: true, h3Resolution: 8 },
      { useH3: true, h3Resolution: 9 },
      { useH3: true, h3Resolution: 10 },
    ];
    for (const modelType of modelTypes) {
      for (const h3Var of h3Variations) {
        variations.push({
          modelType,
          useH3: h3Var.useH3,
          h3Resolution: h3Var.h3Resolution,
        });
      }
    }
  } else {
    const selectedModels = Array.from(document.querySelectorAll(".group-model:checked")).map((el) => el.value);
    const selectedH3 = Array.from(document.querySelectorAll(".group-h3:checked")).map((el) => el.value);
    for (const modelType of selectedModels) {
      for (const h3Opt of selectedH3) {
        variations.push({
          modelType,
          useH3: h3Opt !== "none",
          h3Resolution: h3Opt === "none" ? 9 : Number(h3Opt),
        });
      }
    }
  }

  if (!variations.length) return;

  const newConfigs = [];
  for (const algo of selectedAlgos) {
    for (const variation of variations) {
      for (const order of selectedOrders) {
        newConfigs.push({
          algorithm: algo,
          modelType: variation.modelType,
          orderStrategy: order.orderStrategy,
          orderBudgetMs: order.orderBudgetMs,
          useH3: variation.useH3,
          h3Resolution: variation.h3Resolution,
        });
      }
    }
  }

  const replace = elements.groupReplaceExisting.checked;
  if (replace) {
    loadConfigurations(newConfigs);
  } else {
    for (const config of newConfigs) {
      state.configurations.push(createConfiguration(config));
    }
    const algorithms = groupConfigurationsByAlgorithm().map(([algorithm]) => algorithm);
    state.collapsedConfigurationGroups = new Set(algorithms.slice(1));
    renderConfigurations();
    invalidateResults();
    showToast(`${newConfigs.length} configurações adicionadas.`);
  }

  toggleGroupMenu(false);
}


function loadConfigurations(configsList) {
  if (state.currentController) return;
  state.configurations = [];
  state.configurationCounter = 0;

  for (const item of configsList) {
    state.configurations.push(createConfiguration(item));
  }

  const algorithms = [...new Set(state.configurations.map(({ algorithm }) => algorithm))];
  state.collapsedConfigurationGroups = new Set(algorithms.slice(1));

  renderConfigurations();
  invalidateResults();
  updateReadyState();
  const pickups = state.stops.filter((stop) => stop.type === "pickup").length;
  const deliveries = state.stops.filter((stop) => stop.type === "delivery");
  if (!pickups || !deliveries.length) {
    showToast(`${configsList.length} configurações carregadas. Adicione ao menos 1 coleta e 1 entrega no mapa.`);
  } else {
    showToast(`${configsList.length} configurações carregadas no template.`);
  }
}

function clearConfigurations() {
  if (state.currentController) return;
  state.configurations = [];
  state.configurationCounter = 0;
  state.collapsedConfigurationGroups.clear();
  renderConfigurations();
  invalidateResults();
  updateReadyState();
  showToast("Configurações removidas.");
}

function renderConfigurations() {
  elements.configurationList.innerHTML = "";
  const grouped = groupConfigurationsByAlgorithm();
  elements.configurationSummary.textContent = `${state.configurations.length} configuraç${state.configurations.length === 1 ? "ão" : "ões"} em ${grouped.length} grupo${grouped.length === 1 ? "" : "s"}`;
  elements.expandConfigurationGroups.disabled = grouped.length === 0;
  elements.collapseConfigurationGroups.disabled = grouped.length === 0;

  if (!state.configurations.length) {
    elements.configurationList.innerHTML = `
      <div class="empty-configurations">
        Nenhuma configuração adicionada.<br/>
        Selecione um <strong>Template</strong> acima ou clique em <strong>+ Adicionar</strong>.
      </div>`;
    updateReadyState();
    return;
  }

  for (const [algorithm, configurations] of grouped) {
    const group = document.createElement("section");
    const collapsed = state.collapsedConfigurationGroups.has(algorithm);
    const normalCount = configurations.filter(({ modelType }) => modelType === "normal").length;
    const bidirectionalCount = configurations.length - normalCount;
    const priorityCount = configurations.filter(({ orderStrategy }) => orderStrategy !== "ils").length;
    const ilsCount = configurations.length - priorityCount;
    group.className = "configuration-group";
    group.style.setProperty("--group-color", configurations[0].color);
    group.innerHTML = `
      <div class="configuration-group-header">
        <button class="configuration-group-toggle" type="button" aria-expanded="${!collapsed}">
          <span class="group-chevron" aria-hidden="true">${collapsed ? "▸" : "▾"}</span>
          <strong>${escapeHtml(ALGORITHM_LABELS[algorithm] || algorithm)}</strong>
          <span class="group-count">${configurations.length} configuraç${configurations.length === 1 ? "ão" : "ões"}</span>
          <span class="group-breakdown">${normalCount} normal · ${bidirectionalCount} bidirecional · ${priorityCount} prioridade · ${ilsCount} ILS</span>
        </button>
        <button class="icon-button remove-configuration-group" type="button">Remover grupo</button>
      </div>
      <div class="configuration-group-body" ${collapsed ? "hidden" : ""}></div>`;

    const body = group.querySelector(".configuration-group-body");
    for (const modelType of ["normal", "bidirectional"]) {
      const variations = configurations.filter((configuration) => configuration.modelType === modelType);
      if (!variations.length) continue;
      const subgroup = document.createElement("section");
      subgroup.className = "configuration-subgroup";
      subgroup.innerHTML = `<h3>${modelType === "bidirectional" ? "Bidirecional" : "Normal"}<span>${variations.length}</span></h3><div class="configuration-rows"></div>`;
      const rows = subgroup.querySelector(".configuration-rows");
      variations.forEach((configuration) => rows.appendChild(createConfigurationRow(configuration)));
      body.appendChild(subgroup);
    }

    group.querySelector(".configuration-group-toggle").addEventListener("click", () => {
      if (state.collapsedConfigurationGroups.has(algorithm)) {
        state.collapsedConfigurationGroups.delete(algorithm);
      } else {
        state.collapsedConfigurationGroups.add(algorithm);
      }
      renderConfigurations();
    });
    group.querySelector(".remove-configuration-group").addEventListener("click", () => {
      if (state.currentController) return;
      state.configurations = state.configurations.filter((configuration) => configuration.algorithm !== algorithm);
      state.collapsedConfigurationGroups.delete(algorithm);
      renderConfigurations();
      invalidateResults();
    });
    elements.configurationList.appendChild(group);
  }
  updateReadyState();
}

function groupConfigurationsByAlgorithm() {
  const groups = new Map();
  for (const configuration of state.configurations) {
    if (!groups.has(configuration.algorithm)) groups.set(configuration.algorithm, []);
    groups.get(configuration.algorithm).push(configuration);
  }
  return [...groups.entries()].sort(
    ([first], [second]) => algorithmOrder(first) - algorithmOrder(second),
  );
}

function algorithmOrder(algorithm) {
  const order = ["astar", "dijkstra", "bfs", "dfs", "greedy", "beam"];
  const index = order.indexOf(algorithm);
  return index < 0 ? order.length : index;
}

function algorithmOptions(selected) {
  return Object.entries(ALGORITHM_LABELS)
    .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function createConfigurationRow(configuration) {
  const row = document.createElement("div");
  row.className = "configuration-row";
  row.style.setProperty("--config-color", configuration.color);
  row.innerHTML = `
    <span class="configuration-row-number"><i></i>#${configuration.number}</span>
    <label class="configuration-compact-field"><span>Algoritmo</span><select class="algorithm">${algorithmOptions(configuration.algorithm)}</select></label>
    <label class="configuration-compact-field"><span>Tipo</span><select class="model-type"><option value="normal" ${configuration.modelType === "normal" ? "selected" : ""}>Normal</option><option value="bidirectional" ${configuration.modelType === "bidirectional" ? "selected" : ""}>Bidirecional</option></select></label>
    <label class="configuration-compact-field"><span>Ordenação</span><select class="order-strategy"><option value="priority" ${configuration.orderStrategy !== "ils" ? "selected" : ""}>Prioridade por prazo</option><option value="ils" ${configuration.orderStrategy === "ils" ? "selected" : ""}>ILS</option></select></label>
    <label class="configuration-compact-field"><span>Orçamento ILS</span><select class="order-budget" ${configuration.orderStrategy === "ils" ? "" : "disabled"}><option value="250" ${configuration.orderBudgetMs === 250 ? "selected" : ""}>250 ms</option><option value="500" ${configuration.orderBudgetMs === 500 ? "selected" : ""}>500 ms</option><option value="1000" ${configuration.orderBudgetMs === 1000 ? "selected" : ""}>1 s</option><option value="3000" ${configuration.orderBudgetMs === 3000 ? "selected" : ""}>3 s</option></select></label>
    <label class="configuration-h3-toggle"><span>Corredor H3</span><span class="configuration-check"><input class="use-h3" type="checkbox" ${configuration.useH3 ? "checked" : ""} /> Usar</span></label>
    <label class="configuration-resolution"><span>Célula <strong class="h3-resolution-value">${configuration.h3Resolution}</strong></span><input class="h3-resolution" type="range" min="7" max="10" step="1" value="${configuration.h3Resolution}" ${configuration.useH3 ? "" : "disabled"} /></label>
    <span class="configuration-actions"><button class="icon-button duplicate" type="button">Duplicar</button><button class="icon-button remove" type="button">Remover</button></span>`;

  row.querySelector(".algorithm").addEventListener("change", (event) => {
    state.collapsedConfigurationGroups.delete(event.target.value);
    updateConfiguration(configuration.id, { algorithm: event.target.value });
  });
  row.querySelector(".model-type").addEventListener("change", (event) => updateConfiguration(configuration.id, { modelType: event.target.value }));
  row.querySelector(".order-strategy").addEventListener("change", (event) => updateConfiguration(configuration.id, { orderStrategy: event.target.value }));
  row.querySelector(".order-budget").addEventListener("change", (event) => updateConfiguration(configuration.id, { orderBudgetMs: Number(event.target.value) }));
  row.querySelector(".use-h3").addEventListener("change", (event) => updateConfiguration(configuration.id, { useH3: event.target.checked }));
  row.querySelector(".h3-resolution").addEventListener("input", (event) => {
    configuration.h3Resolution = Number(event.target.value);
    row.querySelector(".h3-resolution-value").textContent = event.target.value;
    invalidateResults();
  });
  row.querySelector(".duplicate").addEventListener("click", () => addConfiguration(configuration));
  row.querySelector(".remove").addEventListener("click", () => {
    if (state.currentController) return;
    state.configurations = state.configurations.filter((candidate) => candidate.id !== configuration.id);
    renderConfigurations();
    invalidateResults();
  });
  return row;
}


function updateConfiguration(id, patch) {
  if (state.currentController) return;
  const configuration = state.configurations.find((candidate) => candidate.id === id);
  if (!configuration) return;
  Object.assign(configuration, patch);
  renderConfigurations();
  invalidateResults();
}

function updateReadyState() {
  const pickups = state.stops.filter((stop) => stop.type === "pickup").length;
  const deliveries = state.stops.filter((stop) => stop.type === "delivery");
  const deadlinesReady = deliveries.every(isDeliveryConfigured);
  const ready = Boolean(state.graph) && !state.mapLoading && pickups > 0 && deliveries.length > 0 && deadlinesReady && state.configurations.length >= 2 && !state.currentController;
  elements.runComparison.disabled = !ready;
  if (state.currentController) return;
  if (state.visualizationWorker) return;
  if (!pickups || !deliveries.length) elements.comparisonStatus.textContent = "Adicione ao menos uma coleta e uma entrega.";
  else if (!deadlinesReady) elements.comparisonStatus.textContent = "Preencha o prazo de todas as entregas.";
  else if (state.configurations.length < 2) elements.comparisonStatus.textContent = "Adicione ao menos duas configurações.";
  else elements.comparisonStatus.textContent = `${state.configurations.length} configurações prontas para comparar.`;
}

function terminateActiveWorkers() {
  if (state.activeWorkers && state.activeWorkers.length) {
    for (const worker of state.activeWorkers) {
      try {
        worker.terminate();
      } catch (error) {
        console.warn("Erro ao finalizar worker:", error);
      }
    }
    state.activeWorkers = [];
  }
}

function terminateVisualizationWorker() {
  state.visualizationRevision += 1;
  state.visualizationController?.abort();
  state.visualizationController = null;
  if (!state.visualizationWorker) return;
  try {
    state.visualizationWorker.terminate();
  } catch (error) {
    console.warn("Erro ao finalizar worker de visualização:", error);
  }
  state.visualizationWorker = null;
}

function initializeComparisonWorker(worker, payload, signal = null) {
  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      if (event.data?.type === "INIT_OK") {
        cleanup();
        resolve();
      } else if (event.data?.type === "INIT_ERROR") {
        cleanup();
        reject(new Error(event.data.error || "Não foi possível preparar a malha no worker."));
      }
    };
    const handleError = (error) => {
      cleanup();
      reject(error);
    };
    const handleAbort = () => {
      cleanup();
      const error = new Error("Visualização cancelada.");
      error.name = "AbortError";
      reject(error);
    };
    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      signal?.removeEventListener("abort", handleAbort);
    };
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    signal?.addEventListener("abort", handleAbort, { once: true });
    worker.postMessage({ type: "INIT", payload });
  });
}

async function runComparisonWithWorkers({
  configurations,
  graph,
  stops,
  departureTimeMs,
  averageSpeedKph,
  returnToStart,
  signal,
}) {
  throwIfCancelled(signal);
  const totalTasks = configurations.length;
  const poolSize = recommendComparisonWorkerCount({
    nodeCount: graph?.nodes?.length || 0,
    edgeCount: graph?.edges?.length || 0,
    totalTasks,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
  });
  const workers = [];


  for (let i = 0; i < poolSize; i += 1) {
    throwIfCancelled(signal);
    const worker = new Worker("/comparacao/worker.js", { type: "module" });
    workers.push(worker);
    state.activeWorkers.push(worker);
  }

  elements.comparisonStatus.textContent = `Preparando ${poolSize} threads em paralelo…`;
  const preparationStartedAt = performance.now();
  await Promise.all(workers.map((worker) => initializeComparisonWorker(worker, {
    graph,
    stops,
    departureTimeMs,
    averageSpeedKph,
  })));
  state.commonPreparationTimeMs = performance.now() - preparationStartedAt;

  throwIfCancelled(signal);
  let nextTaskIndex = 0;
  let completedCount = 0;
  const results = new Array(totalTasks);

  elements.comparisonStatus.textContent = `Calculando em paralelo (0/${totalTasks} concluídos) em ${poolSize} threads…`;

  await new Promise((resolve, reject) => {
    let finished = false;

    const onAbort = () => {
      if (finished) return;
      finished = true;
      terminateActiveWorkers();
      const error = new Error("Comparação cancelada.");
      error.name = "AbortError";
      reject(error);
    };
    signal.addEventListener("abort", onAbort, { once: true });

    function assignNext(worker) {
      if (finished || signal.aborted) return;
      if (nextTaskIndex >= totalTasks) {
        if (completedCount === totalTasks) {
          finished = true;
          signal.removeEventListener("abort", onAbort);
          resolve();
        }
        return;
      }

      const taskId = nextTaskIndex;
      nextTaskIndex += 1;
      const configuration = { ...configurations[taskId] };

      worker.onmessage = (event) => {
        if (finished || signal.aborted) return;
        const data = event.data;
        if (!data || data.taskId !== taskId) return;

        let outcome = null;
        let runtimeError = null;
        if (data.type === "SUCCESS") {
          outcome = data.outcome;
        } else if (data.type === "ERROR") {
          runtimeError = data.error;
        }

        results[taskId] = {
          configuration,
          outcome,
          computationTimeMs: data.computationTimeMs || 0,
          error: runtimeError || outcome?.result?.error || null,
          visualizationReady: false,
        };

        completedCount += 1;
        elements.comparisonStatus.textContent = `Calculando em paralelo (${completedCount}/${totalTasks} concluídos) em ${poolSize} threads…`;

        if (completedCount === totalTasks) {
          finished = true;
          signal.removeEventListener("abort", onAbort);
          resolve();
        } else {
          assignNext(worker);
        }
      };

      worker.onerror = (err) => {
        if (finished || signal.aborted) return;
        console.error("Erro no worker:", err);
        results[taskId] = {
          configuration,
          outcome: null,
          computationTimeMs: 0,
          error: err.message || "Erro no worker",
          visualizationReady: false,
        };
        completedCount += 1;
        elements.comparisonStatus.textContent = `Calculando em paralelo (${completedCount}/${totalTasks} concluídos) em ${poolSize} threads…`;

        if (completedCount === totalTasks) {
          finished = true;
          signal.removeEventListener("abort", onAbort);
          resolve();
        } else {
          assignNext(worker);
        }
      };

      worker.postMessage({
        type: "RUN",
        payload: {
          taskId,
          stops,
          configuration,
          departureTimeMs,
          averageSpeedKph,
          returnToStart,
          collectTrace: false,
        },
      });
    }

    for (const worker of workers) {
      assignNext(worker);
    }
  });

  state.results = results;
}

async function runComparisonSequential({
  configurations,
  graph,
  stops,
  departureTimeMs,
  averageSpeedKph,
  returnToStart,
  signal,
}) {
  const preparedNetwork = await prepareRouteNetwork({
    graph,
    stops,
    averageSpeedKph,
    signal,
    yieldControl: () => yieldComparison(signal),
  });
  state.commonPreparationTimeMs = preparedNetwork.preparationTimeMs;
  for (let index = 0; index < configurations.length; index += 1) {
    throwIfCancelled(signal);
    const configuration = { ...configurations[index] };
    elements.comparisonStatus.textContent = `Calculando ${index + 1}/${configurations.length}: ${configurationLabel(configuration)}…`;
    await nextFrame();
    const startedAt = performance.now();
    let outcome;
    let runtimeError = null;
    try {
      const prepared = await prepareRouteComparison({
        preparedNetwork,
        departureTimeMs,
        averageSpeedKph,
        orderStrategy: configuration.orderStrategy,
        orderBudgetMs: configuration.orderBudgetMs,
        returnToStart,
        signal,
        yieldControl: () => yieldComparison(signal),
      });
      outcome = await runRouteConfiguration({
        prepared,
        configuration,
        departureTimeMs,
        averageSpeedKph,
        h3: window.h3,
        signal,
        collectTrace: false,
        yieldControl: () => yieldComparison(signal),
      });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      console.error(error);
      runtimeError = error.message;
    }
    const computationTimeMs = performance.now() - startedAt;
    state.results.push({
      configuration,
      outcome,
      computationTimeMs,
      error: runtimeError || outcome?.result?.error || null,
      visualizationReady: false,
    });
  }
}

async function runComparison() {
  if (state.currentController || elements.runComparison.disabled) return;
  stopPlayback();
  terminateVisualizationWorker();
  invalidateResultMaps();
  const controller = new AbortController();
  state.currentController = controller;
  state.results = [];
  state.commonPreparationTimeMs = 0;
  terminateActiveWorkers();
  elements.runComparison.disabled = true;
  elements.cancelComparison.hidden = false;
  elements.clearStops.disabled = true;
  elements.addConfiguration.disabled = true;
  elements.averageSpeed.disabled = true;
  elements.returnToStart.disabled = true;
  elements.results.hidden = true;
  setConfigurationControlsDisabled(true);
  const departureTimeMs = Date.now();
  const cleanStops = state.stops.map(stripMarker);
  const averageSpeedKph = Number(elements.averageSpeed.value);
  const returnToStart = elements.returnToStart.checked;
  state.lastComparisonContext = {
    stops: cleanStops,
    departureTimeMs,
    averageSpeedKph,
    returnToStart,
  };

  try {
    if (typeof Worker !== "undefined") {
      try {
        await runComparisonWithWorkers({
          configurations: state.configurations,
          graph: state.graph,
          stops: cleanStops,
          departureTimeMs,
          averageSpeedKph,
          returnToStart,
          signal: controller.signal,
        });
      } catch (workerError) {
        if (workerError.name === "AbortError") throw workerError;
        console.warn("Falha ao executar via Web Workers; usando fallback sequencial:", workerError);
        terminateActiveWorkers();
        state.results = [];
        await runComparisonSequential({
          configurations: state.configurations,
          graph: state.graph,
          stops: cleanStops,
          departureTimeMs,
          averageSpeedKph,
          returnToStart,
          signal: controller.signal,
        });
      }
    } else {
      await runComparisonSequential({
        configurations: state.configurations,
        graph: state.graph,
        stops: cleanStops,
        departureTimeMs,
        averageSpeedKph,
        returnToStart,
        signal: controller.signal,
      });
    }

    throwIfCancelled(controller.signal);
    terminateActiveWorkers();
    await nextFrame();
    state.visualRoutingGraph = null;
    elements.comparisonStatus.textContent = `Comparação concluída (${state.results.length} configurações) · preparo comum ${formatComputationTime(state.commonPreparationTimeMs)}.`;
    elements.results.hidden = false;
    state.selectedResultIds = new Set(
      state.results
        .filter((record) => !record.error)
        .slice(0, 2)
        .map((record) => record.configuration.id),
    );
    const rankedGroups = groupResultsByAlgorithm(getSortCriteria());
    state.collapsedResultGroups = new Set(
      rankedGroups.slice(1).map(({ algorithm }) => algorithm),
    );
    renderResultsTable();
    refreshVisualizations();
    elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error.name === "AbortError") {
      elements.comparisonStatus.textContent = "Comparação cancelada.";
      showToast("Comparação cancelada.");
    } else {
      console.error(error);
      elements.comparisonStatus.textContent = "Não foi possível concluir a comparação.";
      showToast(error.message, true);
    }
  } finally {
    terminateActiveWorkers();
    state.currentController = null;
    elements.cancelComparison.hidden = true;
    elements.addConfiguration.disabled = false;
    elements.averageSpeed.disabled = false;
    elements.returnToStart.disabled = false;
    setConfigurationControlsDisabled(false);
    renderStops();
    updateReadyState();
  }
}

function cancelComparison() {
  if (!state.currentController) return;
  terminateActiveWorkers();
  state.currentController.abort();
  elements.cancelComparison.disabled = true;
  elements.comparisonStatus.textContent = "Cancelando…";
  setTimeout(() => { elements.cancelComparison.disabled = false; }, 0);
}

function setConfigurationControlsDisabled(disabled) {
  if (elements.groupAddToggle) elements.groupAddToggle.disabled = disabled;
  if (elements.expandConfigurationGroups) elements.expandConfigurationGroups.disabled = disabled;
  if (elements.collapseConfigurationGroups) elements.collapseConfigurationGroups.disabled = disabled;
  if (disabled && elements.groupAddMenu && !elements.groupAddMenu.hidden) toggleGroupMenu(false);
  if (elements.clearConfigurations) elements.clearConfigurations.disabled = disabled;
  elements.configurationList.querySelectorAll("button, select, input").forEach((control) => { control.disabled = disabled; });


  if (!disabled) {
    elements.configurationList.querySelectorAll(".configuration-row").forEach((row) => {
      row.querySelector(".h3-resolution").disabled = !row.querySelector(".use-h3").checked;
      row.querySelector(".order-budget").disabled = row.querySelector(".order-strategy").value !== "ils";
    });
  }
  elements.averageSpeed.disabled = disabled;
  elements.mapSelect.disabled = disabled || state.mapLoading;
  document.querySelectorAll(".stop-button").forEach((control) => { control.disabled = disabled; });
}

function renderResultsTable() {
  const criteria = getSortCriteria();
  if (elements.scoreboardMode.value === "grouped") {
    elements.resultsBody.innerHTML = renderGroupedScoreboard(criteria);
  } else {
    const ranked = rankResultRecords(sortResultRecords(state.results, criteria), criteria);
    const leaders = ranked.filter(({ rank }) => rank === 1).length;
    elements.resultsBody.innerHTML = ranked
      .map(({ record, rank }) => resultRowHtml(
        record,
        rank === 1 ? (leaders > 1 ? "Empate no topo" : "Melhor no placar") : "",
        rank,
      ))
      .join("");
  }

  elements.resultsBody.querySelectorAll(".result-visibility[data-configuration-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const configurationId = checkbox.dataset.configurationId;
      if (checkbox.checked) state.selectedResultIds.add(configurationId);
      else state.selectedResultIds.delete(configurationId);
      refreshVisualizations();
    });
  });
  elements.resultsBody.querySelectorAll(".result-group-toggle[data-algorithm]").forEach((button) => {
    button.addEventListener("click", () => {
      const algorithm = button.dataset.algorithm;
      if (state.collapsedResultGroups.has(algorithm)) state.collapsedResultGroups.delete(algorithm);
      else state.collapsedResultGroups.add(algorithm);
      renderResultsTable();
    });
  });
}

function renderGroupedScoreboard(criteria) {
  const rankedGroups = rankAlgorithmGroups(groupResultsByAlgorithm(criteria), criteria);
  return rankedGroups.map(({ group, rank, primaryTie, completeTie }) => {
    const collapsed = state.collapsedResultGroups.has(group.algorithm);
    const validCount = group.records.filter((record) => !record.error).length;
    const selectedCount = group.records.filter((record) =>
      state.selectedResultIds.has(record.configuration.id),
    ).length;
    const groupHeader = `<tr class="result-group-header"><td colspan="8"><button class="result-group-toggle" type="button" data-algorithm="${escapeHtml(group.algorithm)}" aria-expanded="${!collapsed}">
      <span class="result-group-chevron">${collapsed ? "▸" : "▾"}</span>
      <span class="result-group-rank">${rank ? `${rank}º` : "—"}</span>
      <strong>${escapeHtml(ALGORITHM_LABELS[group.algorithm] || group.algorithm)}</strong>
      <span>${group.records.length} configuraç${group.records.length === 1 ? "ão" : "ões"}${validCount !== group.records.length ? ` · ${group.records.length - validCount} falha(s)` : ""}</span>
      <span class="result-group-score"><b>${metricLabel(criteria[0])}: ${formatMetricValue(group.best, criteria[0])}</b>${criteria[1] ? `<em>Desempate · ${metricLabel(criteria[1])}: ${formatMetricValue(group.best, criteria[1])}</em>` : ""}</span>
      ${completeTie ? '<span class="result-group-tie complete">Empate</span>' : (primaryTie && criteria[1] ? `<span class="result-group-tie">Desempatado por ${escapeHtml(metricLabel(criteria[1]).toLowerCase())}</span>` : "")}
      ${selectedCount ? `<span class="result-group-selected">${selectedCount} no mapa</span>` : ""}
    </button></td></tr>`;
    if (collapsed) return groupHeader;
    const rankedRecords = rankResultRecords(group.records, criteria);
    const leaders = rankedRecords.filter(({ rank: recordRank }) => recordRank === 1).length;
    return groupHeader + rankedRecords
      .map(({ record, rank: recordRank }) => resultRowHtml(
        record,
        recordRank === 1 ? (leaders > 1 ? "Empate no grupo" : "Melhor do grupo") : "",
        recordRank,
      ))
      .join("");
  }).join("");
}

function groupResultsByAlgorithm(criteria) {
  const groups = new Map();
  for (const record of state.results) {
    const algorithm = record.configuration.algorithm;
    if (!groups.has(algorithm)) groups.set(algorithm, []);
    groups.get(algorithm).push(record);
  }
  return [...groups.entries()]
    .map(([algorithm, records]) => {
      const sorted = sortResultRecords(records, criteria);
      const best = sorted.find((record) => !record.error) || null;
      return {
        algorithm,
        records: sorted,
        best,
      };
    })
    .sort((first, second) => {
      if (!first.best && !second.best) return algorithmOrder(first.algorithm) - algorithmOrder(second.algorithm);
      if (!first.best) return 1;
      if (!second.best) return -1;
      return compareRecordsByCriteria(first.best, second.best, criteria) ||
        algorithmOrder(first.algorithm) - algorithmOrder(second.algorithm);
    });
}

function getSortCriteria() {
  const primary = elements.sortResults.value;
  const secondary = elements.sortSecondary.value;
  return secondary !== "none" && secondary !== primary
    ? [primary, secondary]
    : [primary];
}

function sortResultRecords(records, criteria) {
  return [...records].sort((first, second) =>
    compareRecordsByCriteria(first, second, criteria) ||
    algorithmOrder(first.configuration.algorithm) - algorithmOrder(second.configuration.algorithm) ||
    first.configuration.number - second.configuration.number,
  );
}

function compareRecordsByCriteria(first, second, criteria) {
  for (const metric of criteria) {
    const firstValue = metricValue(first, metric);
    const secondValue = metricValue(second, metric);
    if (firstValue < secondValue) return -1;
    if (firstValue > secondValue) return 1;
  }
  return 0;
}

function rankResultRecords(records, criteria) {
  let lastValid = null;
  let lastRank = 0;
  let validPosition = 0;
  return records.map((record) => {
    if (record.error) return { record, rank: null };
    validPosition += 1;
    const tied = lastValid && compareRecordsByCriteria(lastValid, record, criteria) === 0;
    const rank = tied ? lastRank : validPosition;
    lastValid = record;
    lastRank = rank;
    return { record, rank };
  });
}

function rankAlgorithmGroups(groups, criteria) {
  let lastGroup = null;
  let lastRank = 0;
  let validPosition = 0;
  return groups.map((group) => {
    if (!group.best) return { group, rank: null, primaryTie: false, completeTie: false };
    validPosition += 1;
    const completeTie = Boolean(
      lastGroup?.best && compareRecordsByCriteria(lastGroup.best, group.best, criteria) === 0,
    );
    const primaryTie = Boolean(
      lastGroup?.best && metricValue(lastGroup.best, criteria[0]) === metricValue(group.best, criteria[0]),
    );
    const rank = completeTie ? lastRank : validPosition;
    lastGroup = group;
    lastRank = rank;
    return { group, rank, primaryTie, completeTie };
  });
}

function resultRowHtml(record, winnerLabel = "", rank = null) {
  const result = record.outcome?.result;
  const info = record.outcome?.h3Info;
  const deadlines = record.outcome?.deadlineInfo || { lateCount: 0, onTimeCount: 0 };
  const isVisible = state.selectedResultIds.has(record.configuration.id);
  if (record.error) {
    return `<tr><td><span class="result-name" style="--config-color:${record.configuration.color}"><span class="result-position unavailable">—</span><i class="color-dot"></i>${escapeHtml(configurationLabel(record.configuration))}</span></td><td colspan="6" class="failed">${escapeHtml(record.error)}</td><td class="visualization-cell"><label class="result-visibility-toggle unavailable" title="Resultado indisponível"><input type="checkbox" disabled /><span>Indisponível</span></label></td></tr>`;
  }
  return `<tr class="${winnerLabel ? "best" : ""}">
    <td><span class="result-name" style="--config-color:${record.configuration.color}"><span class="result-position">${rank ? `${rank}º` : "—"}</span><i class="color-dot"></i>${escapeHtml(configurationLabel(record.configuration))}${winnerLabel ? `<span class="winner">${escapeHtml(winnerLabel)}</span>` : ""}</span></td>
    <td>${formatComputationTime(record.computationTimeMs)}</td>
    <td>${formatDuration(result.travelTimeSeconds)}</td>
    <td>${formatDistance(result.distanceMeters)}</td>
    <td>${expansionCount(record).toLocaleString("pt-BR")}</td>
    <td>${info ? `Célula ${info.resolution} · buffer ${info.bufferK} · ${info.cellCount.toLocaleString("pt-BR")} hex` : "Desativado"}</td>
    <td class="${deadlines.lateCount ? "failed" : ""}">${deadlines.lateCount ? `${deadlines.lateCount} atrasada(s) · ${formatDuration(deadlines.totalLatenessSeconds || 0)}` : `${deadlines.onTimeCount} no prazo${Number.isFinite(deadlines.minSlackSeconds) ? ` · folga ${formatDuration(deadlines.minSlackSeconds)}` : ""}`}</td>
    <td class="visualization-cell"><label class="result-visibility-toggle"><input class="result-visibility" type="checkbox" data-configuration-id="${escapeHtml(record.configuration.id)}" ${isVisible ? "checked" : ""} /><span>Exibir</span></label></td>
  </tr>`;
}

function metricLabel(metric) {
  return {
    computationTimeMs: "Tempo de cálculo",
    travelTimeSeconds: "Tempo de viagem",
    distanceMeters: "Distância",
    explorations: "Explorações",
    lateCount: "Entregas atrasadas",
  }[metric] || metric;
}

function formatMetricValue(record, metric) {
  if (!record) return "Indisponível";
  if (metric === "computationTimeMs") return formatComputationTime(record.computationTimeMs);
  if (metric === "travelTimeSeconds") return formatDuration(record.outcome.result.travelTimeSeconds);
  if (metric === "distanceMeters") return formatDistance(record.outcome.result.distanceMeters);
  if (metric === "explorations") return expansionCount(record).toLocaleString("pt-BR");
  if (metric === "lateCount") return `${record.outcome.deadlineInfo.lateCount} atrasada(s)`;
  return "—";
}

function metricValue(record, metric) {
  if (record.error) return Number.POSITIVE_INFINITY;
  if (metric === "computationTimeMs") return record.computationTimeMs;
  if (metric === "explorations") return expansionCount(record);
  if (metric === "lateCount") return record.outcome.deadlineInfo.lateCount;
  return Number(record.outcome.result[metric]) || 0;
}

function expansionCount(record) {
  const count = Number(record?.outcome?.explorationCount);
  return Number.isFinite(count) ? count : (record?.outcome?.trace?.length || 0);
}

function selectedResults() {
  return state.results.filter((record) =>
    !record.error && state.selectedResultIds.has(record.configuration.id),
  );
}

function refreshVisualizations() {
  terminateVisualizationWorker();
  stopPlayback();
  releaseUnselectedVisualizationData();
  renderResultMaps();
  renderOverlayMap();
  updateVisualMode();
  const pending = selectedResults().filter((record) => !record.visualizationReady);
  if (pending.length) void hydrateSelectedVisualizations(pending, state.visualizationRevision);
}

function releaseUnselectedVisualizationData() {
  for (const record of state.results) {
    if (!record.outcome || state.selectedResultIds.has(record.configuration.id)) continue;
    record.outcome.trace = [];
    record.outcome.corridorCells = [];
    record.visualizationReady = false;
  }
  if (!selectedResults().some((record) => record.visualizationReady)) {
    state.visualRoutingGraph = null;
  }
}

function runVisualizationTask(worker, record, context, signal) {
  return new Promise((resolve, reject) => {
    const taskId = `visual:${record.configuration.id}:${Date.now()}`;
    const handleMessage = (event) => {
      if (!event.data || event.data.taskId !== taskId) return;
      cleanup();
      if (event.data.type === "SUCCESS") resolve(event.data.outcome);
      else reject(new Error(event.data.error || "Não foi possível gerar a visualização."));
    };
    const handleError = (error) => {
      cleanup();
      reject(error);
    };
    const handleAbort = () => {
      cleanup();
      const error = new Error("Visualização cancelada.");
      error.name = "AbortError";
      reject(error);
    };
    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      signal.removeEventListener("abort", handleAbort);
    };
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    signal.addEventListener("abort", handleAbort, { once: true });
    worker.postMessage({
      type: "RUN",
      payload: {
        taskId,
        configuration: { ...record.configuration },
        departureTimeMs: context.departureTimeMs,
        averageSpeedKph: context.averageSpeedKph,
        returnToStart: context.returnToStart,
        collectTrace: true,
      },
    });
  });
}

async function hydrateSelectedVisualizations(pending, revision) {
  const context = state.lastComparisonContext;
  if (!context || !state.graph || typeof Worker === "undefined") return;
  const controller = new AbortController();
  const worker = new Worker("/comparacao/worker.js", { type: "module" });
  state.visualizationController = controller;
  state.visualizationWorker = worker;

  try {
    elements.comparisonStatus.textContent = "Preparando a malha para as visualizações selecionadas…";
    await initializeComparisonWorker(worker, {
      graph: state.graph,
      stops: context.stops,
      departureTimeMs: context.departureTimeMs,
      averageSpeedKph: context.averageSpeedKph,
    }, controller.signal);

    for (let index = 0; index < pending.length; index += 1) {
      if (revision !== state.visualizationRevision || controller.signal.aborted) return;
      const record = pending[index];
      if (!state.selectedResultIds.has(record.configuration.id)) continue;
      elements.comparisonStatus.textContent = `Gerando exploração para o mapa (${index + 1}/${pending.length}): ${configurationLabel(record.configuration)}…`;
      const visualOutcome = await runVisualizationTask(worker, record, context, controller.signal);
      if (revision !== state.visualizationRevision || controller.signal.aborted) return;
      record.outcome.trace = visualOutcome.trace || [];
      record.outcome.corridorCells = visualOutcome.corridorCells || [];
      record.visualizationReady = true;
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(error);
      showToast(`Não foi possível gerar a exploração: ${error.message}`, true);
    }
  } finally {
    if (revision !== state.visualizationRevision) return;
    worker.terminate();
    state.visualizationWorker = null;
    state.visualizationController = null;

    const readyRecords = selectedResults().filter((record) => record.visualizationReady);
    if (readyRecords.some((record) => record.outcome?.trace?.length)) {
      ensureVisualRoutingGraph(context);
    }
    renderResultMaps();
    renderOverlayMap();
    updateVisualMode();
    elements.comparisonStatus.textContent = `Comparação concluída (${state.results.length} configurações).`;
  }
}

function ensureVisualRoutingGraph(context) {
  if (state.visualRoutingGraph) return;
  const visualConnected = connectStopsToGraph(state.graph, context.stops, {
    fallbackSpeedKph: context.averageSpeedKph,
  });
  state.visualRoutingGraph = buildRoutingGraph(visualConnected.graph, {
    fallbackSpeedKph: context.averageSpeedKph,
  });
}

function renderResultMaps() {
  invalidateResultMaps();
  elements.comparisonMaps.innerHTML = "";
  const records = selectedResults();
  elements.comparisonMaps.className = `comparison-maps ${records.length === 1 ? "one-selected" : records.length === 2 ? "two-selected" : "many-selected"}`;
  if (!records.length) {
    elements.comparisonMaps.innerHTML = '<div class="visual-empty">Selecione uma ou mais configurações acima para visualizar as rotas.</div>';
    return;
  }
  records.forEach((record, index) => {
    const card = document.createElement("article");
    card.className = "result-map-card";
    card.style.setProperty("--config-color", record.configuration.color);
    card.innerHTML = `<div class="result-map-title"><strong>${escapeHtml(configurationLabel(record.configuration))}</strong><span>${record.error ? "Falhou" : `${formatDistance(record.outcome.result.distanceMeters)} · ${formatComputationTime(record.computationTimeMs)}`}</span></div><div class="result-map" id="result-map-${index}"></div>`;
    elements.comparisonMaps.appendChild(card);
    const map = L.map(`result-map-${index}`, { zoomControl: false, preferCanvas: true, attributionControl: false });
    addTileLayer(map);
    const explorationLayer = L.layerGroup().addTo(map);
    if (!record.error) {
      drawCorridor(map, record);
      drawStaticStops(map, record.outcome.stops);
      drawFinalRoute(map, record.outcome.result.coordinates, "#176b43");
      fitResultMap(map, record.outcome.result.coordinates);
    } else {
      fitScenarioMap(map);
    }
    map.on("moveend zoomend", () => synchronizeResultMaps(map));
    state.resultMaps.push({ map, explorationLayer, record });
  });
  setTimeout(() => state.resultMaps.forEach(({ map }) => map.invalidateSize()), 0);
}

function renderOverlayMap() {
  if (state.overlayMap) state.overlayMap.remove();
  state.overlayMap = L.map("overlay-map", { zoomControl: false, preferCanvas: true });
  addTileLayer(state.overlayMap);
  const bounds = [];
  const records = selectedResults();
  elements.overlayLegend.innerHTML = "";
  const firstSuccessful = records[0];
  if (firstSuccessful) drawStaticStops(state.overlayMap, firstSuccessful.outcome.stops);
  records.forEach((record) => {
    drawFinalRoute(state.overlayMap, record.outcome.result.coordinates, record.configuration.color, 5);
    bounds.push(...record.outcome.result.coordinates);
    const item = document.createElement("span");
    item.innerHTML = `<i class="color-dot" style="--config-color:${record.configuration.color}"></i>${escapeHtml(configurationLabel(record.configuration))}`;
    elements.overlayLegend.appendChild(item);
  });
  if (bounds.length) state.overlayMap.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
  else fitScenarioMap(state.overlayMap);
}

function updateVisualMode() {
  const overlay = elements.visualMode.value === "overlay";
  const records = selectedResults();
  elements.comparisonMaps.hidden = overlay;
  elements.overlayWrap.hidden = !overlay;
  elements.replay.disabled = overlay || !records.some((record) => record.outcome?.trace.length);
  elements.pause.disabled = true;
  stopPlayback();
  setTimeout(() => {
    if (overlay) state.overlayMap?.invalidateSize();
    else state.resultMaps.forEach(({ map }) => map.invalidateSize());
  }, 0);
}

function startPlayback() {
  if (elements.visualMode.value !== "side-by-side") return;
  stopPlayback();
  state.resultMaps.forEach(({ explorationLayer }) => explorationLayer.clearLayers());
  state.playbackIndexes = state.resultMaps.map(() => 0);
  state.playbackPaused = false;
  elements.pause.disabled = false;
  elements.pause.textContent = "Pausar";

  const frame = () => {
    if (state.playbackPaused) return;
    const stepSize = Math.max(1, Number(elements.playbackSpeed.value) || 1);
    let hasRemaining = false;
    state.resultMaps.forEach((entry, resultIndex) => {
      const trace = entry.record.outcome?.trace || [];
      let count = 0;
      while (state.playbackIndexes[resultIndex] < trace.length && count < stepSize) {
        drawExploration(entry, trace[state.playbackIndexes[resultIndex]++]);
        count += 1;
      }
      if (state.playbackIndexes[resultIndex] < trace.length) hasRemaining = true;
    });
    if (hasRemaining) state.animationFrame = requestAnimationFrame(frame);
    else {
      state.animationFrame = null;
      elements.pause.disabled = true;
    }
  };
  state.animationFrame = requestAnimationFrame(frame);
}

function togglePlaybackPause() {
  if (state.playbackPaused) {
    state.playbackPaused = false;
    elements.pause.textContent = "Pausar";
    const resume = () => {
      if (state.playbackPaused) return;
      const stepSize = Math.max(1, Number(elements.playbackSpeed.value) || 1);
      let hasRemaining = false;
      state.resultMaps.forEach((entry, resultIndex) => {
        const trace = entry.record.outcome?.trace || [];
        for (let count = 0; count < stepSize && state.playbackIndexes[resultIndex] < trace.length; count += 1) {
          drawExploration(entry, trace[state.playbackIndexes[resultIndex]++]);
        }
        if (state.playbackIndexes[resultIndex] < trace.length) hasRemaining = true;
      });
      if (hasRemaining) state.animationFrame = requestAnimationFrame(resume);
      else { state.animationFrame = null; elements.pause.disabled = true; }
    };
    state.animationFrame = requestAnimationFrame(resume);
  } else {
    state.playbackPaused = true;
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
    elements.pause.textContent = "Continuar";
  }
}

function stopPlayback() {
  if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
  state.animationFrame = null;
  state.playbackPaused = false;
  elements.pause.disabled = true;
  elements.pause.textContent = "Pausar";
}

function drawExploration(entry, event) {
  const candidates = (state.visualRoutingGraph?.adjacency.get(event.from) || [])
    .filter((edge) => edge.to === event.to);
  if (!candidates.length) return;
  const edge = candidates.reduce((best, candidate) =>
    candidate.travelTimeSeconds < best.travelTimeSeconds ? candidate : best,
  );
  L.polyline(edge.geometry, {
    color: event.direction === "backward" ? "#2563a7" : "#d7a300",
    weight: 3,
    opacity: .62,
    interactive: false,
  }).addTo(entry.explorationLayer);
}

function drawCorridor(map, record) {
  if (!record.configuration.useH3 || !record.outcome.corridorCells.length || !window.h3) return;
  for (const boundary of getHexagonBoundaries(record.outcome.corridorCells, window.h3)) {
    L.polygon(boundary, { color: "#0284c7", weight: 1, opacity: .35, fillOpacity: .035, interactive: false }).addTo(map);
  }
}

function drawFinalRoute(map, coordinates, color, weight = 5) {
  if (!coordinates?.length) return;
  L.polyline(coordinates, { color: "#fff", weight: weight + 4, opacity: .9, interactive: false }).addTo(map);
  L.polyline(coordinates, { color, weight, opacity: .95, interactive: false }).addTo(map);
}

function drawStaticStops(map, stops) {
  stops.forEach((stop, index) => {
    L.marker([stop.latitude, stop.longitude], {
      icon: createMarkerIcon(stop, index + 1),
      interactive: false,
    }).addTo(map);
  });
}

function fitResultMap(map, coordinates) {
  if (coordinates?.length > 1) map.fitBounds(coordinates, { padding: [25, 25], maxZoom: 16 });
  else fitScenarioMap(map);
}

function fitScenarioMap(map) {
  if (state.stops.length) {
    map.fitBounds(state.stops.map((stop) => [stop.latitude, stop.longitude]), { padding: [30, 30], maxZoom: 15 });
  } else {
    map.setView(state.map.getCenter(), state.map.getZoom());
  }
}

function synchronizeResultMaps(source) {
  if (state.syncingMaps) return;
  state.syncingMaps = true;
  const center = source.getCenter();
  const zoom = source.getZoom();
  state.resultMaps.forEach(({ map }) => {
    if (map !== source) map.setView(center, zoom, { animate: false });
  });
  setTimeout(() => { state.syncingMaps = false; }, 0);
}

function invalidateResults() {
  if (state.currentController) return;
  terminateVisualizationWorker();
  stopPlayback();
  state.results = [];
  state.collapsedResultGroups.clear();
  state.selectedResultIds.clear();
  state.visualRoutingGraph = null;
  state.lastComparisonContext = null;
  elements.results.hidden = true;
  invalidateResultMaps();
  updateReadyState();
}

function invalidateResultMaps() {
  state.resultMaps.forEach(({ map }) => map.remove());
  state.resultMaps = [];
  if (state.overlayMap) {
    state.overlayMap.remove();
    state.overlayMap = null;
  }
  elements.comparisonMaps.innerHTML = "";
}

function addTileLayer(map) {
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
}

function stripMarker(stop) {
  const { marker, ...plainStop } = stop;
  return { ...plainStop };
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function configurationLabel(configuration) {
  const algorithm = ALGORITHM_LABELS[configuration.algorithm] || configuration.algorithm;
  const type = configuration.modelType === "bidirectional" ? "Bidirecional" : "Normal";
  const ordering = configuration.orderStrategy === "ils"
    ? `ILS ${formatOrderBudget(configuration.orderBudgetMs)}`
    : "Prioridade por prazo";
  const h3 = configuration.useH3 ? ` · H3 ${configuration.h3Resolution}` : " · sem H3";
  return `${algorithm} · ${type} · ${ordering}${h3}`;
}

function formatOrderBudget(value) {
  const milliseconds = Number(value) || 500;
  return milliseconds >= 1000 ? `${milliseconds / 1000} s` : `${milliseconds} ms`;
}

async function yieldComparison(signal) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  throwIfCancelled(signal);
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Comparação cancelada.");
  error.name = "AbortError";
  throw error;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function isDeliveryConfigured(stop) {
  return stop.type === "delivery" && Number.isFinite(Date.parse(stop.deadline));
}

function getRemainingDeadlineParts(value) {
  const deadline = Date.parse(value);
  if (!Number.isFinite(deadline)) return { days: 0, hours: 0, minutes: 0 };
  const totalMinutes = Math.max(0, Math.ceil((deadline - Date.now()) / 60_000));
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

function formatRemainingTime(value) {
  const parts = getRemainingDeadlineParts(value);
  return [parts.days ? `${parts.days}d` : "", parts.hours ? `${parts.hours}h` : "", `${parts.minutes}min`]
    .filter(Boolean).join(" ");
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

function formatDuration(seconds) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

function formatComputationTime(milliseconds) {
  if (milliseconds < 1000) return `${milliseconds.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ms`;
  return `${(milliseconds / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} s`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

let toastTimer = null;
function showToast(message, error = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", error);
  elements.toast.classList.add("visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2600);
}
