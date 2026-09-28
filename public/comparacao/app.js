import {
  buildRoutingGraph,
  connectStopsToGraph,
  findNearestEdge,
} from "/algorithms/routing.mjs";
import { getHexagonBoundaries } from "/algorithms/h3_corridor.js";
import { runRouteConfiguration } from "/algorithms/routeComparison.js";

const COLORS = ["#176b43", "#2563a7", "#dc6d2d", "#7c3ba8", "#b2455b", "#14818b", "#7a6420", "#4f5db6"];
const ALGORITHM_LABELS = { astar: "A*", bfs: "BFS", dfs: "DFS", dijkstra: "Dijkstra" };

const state = {
  graph: null,
  routingGraph: null,
  visualRoutingGraph: null,
  map: null,
  stops: [],
  counters: { pickup: 0, delivery: 0 },
  addMode: null,
  editingDeliveryId: null,
  configurations: [],
  configurationCounter: 0,
  currentController: null,
  results: [],
  resultMaps: [],
  overlayMap: null,
  animationFrame: null,
  playbackIndexes: [],
  playbackPaused: false,
  syncingMaps: false,
};

const elements = {
  cityName: document.querySelector("#city-name"),
  scenarioMap: document.querySelector("#scenario-map"),
  loadingMap: document.querySelector("#loading-map"),
  mapInstruction: document.querySelector("#map-instruction"),
  clearStops: document.querySelector("#clear-stops"),
  stopList: document.querySelector("#stop-list"),
  averageSpeed: document.querySelector("#average-speed"),
  speedValue: document.querySelector("#speed-value"),
  configurationList: document.querySelector("#configuration-list"),
  addConfiguration: document.querySelector("#add-configuration"),
  runComparison: document.querySelector("#run-comparison"),
  cancelComparison: document.querySelector("#cancel-comparison"),
  comparisonStatus: document.querySelector("#comparison-status"),
  results: document.querySelector("#results"),
  resultsBody: document.querySelector("#results-body"),
  sortResults: document.querySelector("#sort-results"),
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
  toast: document.querySelector("#toast"),
};

initialize();

async function initialize() {
  initializeScenarioMap();
  bindEvents();
  addConfiguration({ algorithm: "astar", modelType: "normal", useH3: true, h3Resolution: 9 });
  addConfiguration({ algorithm: "astar", modelType: "bidirectional", useH3: false, h3Resolution: 9 });

  try {
    const response = await fetch("/api/grafo");
    if (!response.ok) throw new Error("Não foi possível carregar a rede viária.");
    state.graph = await response.json();
    state.routingGraph = buildRoutingGraph(state.graph, {
      fallbackSpeedKph: Number(elements.averageSpeed.value),
    });
    elements.cityName.textContent = state.graph.city.replace(", Brazil", "");
    state.map.fitBounds(
      L.latLngBounds(state.graph.nodes.map((node) => [node.latitude, node.longitude])),
      { padding: [24, 24] },
    );
    elements.loadingMap.hidden = true;
    updateReadyState();
  } catch (error) {
    console.error(error);
    elements.loadingMap.textContent = "Erro ao carregar a malha viária.";
    showToast(error.message, true);
  }
}

function initializeScenarioMap() {
  state.map = L.map(elements.scenarioMap, { zoomControl: true, preferCanvas: true })
    .setView([-16.68, -49.25], 12);
  addTileLayer(state.map);
  state.map.on("click", (event) => {
    if (!state.addMode || !state.routingGraph || state.currentController) return;
    addStop(state.addMode, event.latlng);
    setAddMode(null);
  });
}

function bindEvents() {
  document.querySelectorAll(".stop-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.currentController) setAddMode(button.dataset.stopType);
    });
  });
  elements.clearStops.addEventListener("click", clearStops);
  elements.averageSpeed.addEventListener("input", () => {
    elements.speedValue.textContent = elements.averageSpeed.value;
    invalidateResults();
  });
  elements.addConfiguration.addEventListener("click", () => addConfiguration());
  elements.runComparison.addEventListener("click", runComparison);
  elements.cancelComparison.addEventListener("click", cancelComparison);
  elements.sortResults.addEventListener("change", renderResultsTable);
  elements.visualMode.addEventListener("change", updateVisualMode);
  elements.replay.addEventListener("click", startPlayback);
  elements.pause.addEventListener("click", togglePlaybackPause);
  elements.deadlineForm.addEventListener("submit", saveDeadline);
  elements.closeDeadline.addEventListener("click", closeDeadlineDialog);
  elements.cancelDeadline.addEventListener("click", closeDeadlineDialog);
  elements.deadlineDialog.addEventListener("close", () => { state.editingDeliveryId = null; });
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
        ${stop.type === "delivery" ? '<button class="icon-button edit" type="button">Prazo</button>' : ""}
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
  if (!stop) return;
  state.editingDeliveryId = stopId;
  elements.deadlineTitle.textContent = stop.name;
  const remaining = getRemainingDeadlineParts(stop.deadline);
  elements.deadlineDays.value = remaining.days;
  elements.deadlineHours.value = remaining.hours || (stop.deadline ? 0 : 1);
  elements.deadlineMinutes.value = remaining.minutes;
  elements.deadlineDialog.showModal();
}

function closeDeadlineDialog() {
  if (elements.deadlineDialog.open) elements.deadlineDialog.close();
  state.editingDeliveryId = null;
}

function saveDeadline(event) {
  event.preventDefault();
  const stop = state.stops.find((candidate) => candidate.id === state.editingDeliveryId);
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
  state.configurationCounter += 1;
  const configuration = {
    id: `configuration-${Date.now()}-${state.configurationCounter}`,
    number: state.configurationCounter,
    color: COLORS[(state.configurationCounter - 1) % COLORS.length],
    algorithm: template?.algorithm || "dijkstra",
    modelType: template?.modelType || "normal",
    useH3: template?.useH3 ?? true,
    h3Resolution: Number(template?.h3Resolution) || 9,
  };
  state.configurations.push(configuration);
  renderConfigurations();
  invalidateResults();
}

function renderConfigurations() {
  elements.configurationList.innerHTML = "";
  state.configurations.forEach((configuration, index) => {
    const card = document.createElement("div");
    card.className = "configuration-card";
    card.style.setProperty("--config-color", configuration.color);
    card.innerHTML = `
      <div class="configuration-title">
        <strong>Configuração ${index + 1}</strong>
        <span class="configuration-actions"><button class="icon-button duplicate" type="button">Duplicar</button><button class="icon-button remove" type="button">Remover</button></span>
      </div>
      <div class="configuration-fields">
        <label>Algoritmo<select class="algorithm">
          <option value="astar" ${configuration.algorithm === "astar" ? "selected" : ""}>A*</option>
          <option value="bfs" ${configuration.algorithm === "bfs" ? "selected" : ""}>BFS</option>
          <option value="dfs" ${configuration.algorithm === "dfs" ? "selected" : ""}>DFS</option>
          <option value="dijkstra" ${configuration.algorithm === "dijkstra" ? "selected" : ""}>Dijkstra</option>
        </select></label>
        <label>Tipo<select class="model-type"><option value="normal" ${configuration.modelType === "normal" ? "selected" : ""}>Normal</option><option value="bidirectional" ${configuration.modelType === "bidirectional" ? "selected" : ""}>Bidirecional</option></select></label>
        <div class="h3-field">
          <label class="h3-toggle"><input class="use-h3" type="checkbox" ${configuration.useH3 ? "checked" : ""} />Usar corredor H3</label>
          <label>Resolução<select class="h3-resolution" ${configuration.useH3 ? "" : "disabled"}>${[7,8,9,10].map((value) => `<option value="${value}" ${configuration.h3Resolution === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
        </div>
      </div>`;
    card.querySelector(".algorithm").addEventListener("change", (event) => updateConfiguration(configuration.id, { algorithm: event.target.value }));
    card.querySelector(".model-type").addEventListener("change", (event) => updateConfiguration(configuration.id, { modelType: event.target.value }));
    card.querySelector(".use-h3").addEventListener("change", (event) => updateConfiguration(configuration.id, { useH3: event.target.checked }));
    card.querySelector(".h3-resolution").addEventListener("change", (event) => updateConfiguration(configuration.id, { h3Resolution: Number(event.target.value) }));
    card.querySelector(".duplicate").addEventListener("click", () => addConfiguration(configuration));
    card.querySelector(".remove").addEventListener("click", () => {
      if (state.currentController) return;
      state.configurations = state.configurations.filter((candidate) => candidate.id !== configuration.id);
      renderConfigurations();
      invalidateResults();
    });
    elements.configurationList.appendChild(card);
  });
  updateReadyState();
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
  const ready = Boolean(state.graph) && pickups > 0 && deliveries.length > 0 && deadlinesReady && state.configurations.length >= 2 && !state.currentController;
  elements.runComparison.disabled = !ready;
  if (state.currentController) return;
  if (!pickups || !deliveries.length) elements.comparisonStatus.textContent = "Adicione ao menos uma coleta e uma entrega.";
  else if (!deadlinesReady) elements.comparisonStatus.textContent = "Preencha o prazo de todas as entregas.";
  else if (state.configurations.length < 2) elements.comparisonStatus.textContent = "Adicione ao menos duas configurações.";
  else elements.comparisonStatus.textContent = `${state.configurations.length} configurações prontas para comparar.`;
}

async function runComparison() {
  if (state.currentController || elements.runComparison.disabled) return;
  stopPlayback();
  invalidateResultMaps();
  const controller = new AbortController();
  state.currentController = controller;
  state.results = [];
  elements.runComparison.disabled = true;
  elements.cancelComparison.hidden = false;
  elements.clearStops.disabled = true;
  elements.addConfiguration.disabled = true;
  elements.results.hidden = true;
  setConfigurationControlsDisabled(true);
  const departureTimeMs = Date.now();

  try {
    for (let index = 0; index < state.configurations.length; index += 1) {
      throwIfCancelled(controller.signal);
      const configuration = { ...state.configurations[index] };
      elements.comparisonStatus.textContent = `Calculando ${index + 1}/${state.configurations.length}: ${configurationLabel(configuration)}…`;
      await nextFrame();
      const startedAt = performance.now();
      let outcome;
      let runtimeError = null;
      try {
        outcome = await runRouteConfiguration({
          graph: state.graph,
          stops: state.stops.map(stripMarker),
          configuration,
          departureTimeMs,
          averageSpeedKph: Number(elements.averageSpeed.value),
          h3: window.h3,
          signal: controller.signal,
          yieldControl: () => yieldComparison(controller.signal),
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
      });
    }

    throwIfCancelled(controller.signal);
    const visualConnected = connectStopsToGraph(state.graph, state.stops.map(stripMarker), {
      fallbackSpeedKph: Number(elements.averageSpeed.value),
    });
    state.visualRoutingGraph = buildRoutingGraph(visualConnected.graph, {
      fallbackSpeedKph: Number(elements.averageSpeed.value),
    });
    elements.comparisonStatus.textContent = "Comparação concluída.";
    elements.results.hidden = false;
    renderResultsTable();
    renderResultMaps();
    renderOverlayMap();
    updateVisualMode();
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
    state.currentController = null;
    elements.cancelComparison.hidden = true;
    elements.addConfiguration.disabled = false;
    setConfigurationControlsDisabled(false);
    renderStops();
    updateReadyState();
  }
}

function cancelComparison() {
  if (!state.currentController) return;
  state.currentController.abort();
  elements.cancelComparison.disabled = true;
  elements.comparisonStatus.textContent = "Cancelando…";
  setTimeout(() => { elements.cancelComparison.disabled = false; }, 0);
}

function setConfigurationControlsDisabled(disabled) {
  elements.configurationList.querySelectorAll("button, select, input").forEach((control) => { control.disabled = disabled; });
  elements.averageSpeed.disabled = disabled;
  document.querySelectorAll(".stop-button").forEach((control) => { control.disabled = disabled; });
}

function renderResultsTable() {
  const metric = elements.sortResults.value;
  const sorted = [...state.results].sort((first, second) => metricValue(first, metric) - metricValue(second, metric));
  const best = sorted.find((record) => !record.error);
  elements.resultsBody.innerHTML = sorted.map((record) => {
    const result = record.outcome?.result;
    const info = record.outcome?.h3Info;
    const deadlines = record.outcome?.deadlineInfo || { lateCount: 0, onTimeCount: 0 };
    if (record.error) {
      return `<tr><td><span class="result-name" style="--config-color:${record.configuration.color}"><i class="color-dot"></i>${escapeHtml(configurationLabel(record.configuration))}</span></td><td colspan="6" class="failed">${escapeHtml(record.error)}</td></tr>`;
    }
    return `<tr class="${record === best ? "best" : ""}">
      <td><span class="result-name" style="--config-color:${record.configuration.color}"><i class="color-dot"></i>${escapeHtml(configurationLabel(record.configuration))}${record === best ? '<span class="winner">Melhor no critério</span>' : ""}</span></td>
      <td>${formatComputationTime(record.computationTimeMs)}</td>
      <td>${formatDuration(result.travelTimeSeconds)}</td>
      <td>${formatDistance(result.distanceMeters)}</td>
      <td>${record.outcome.trace.length.toLocaleString("pt-BR")}</td>
      <td>${info ? `Nível ${info.bufferK} · ${info.cellCount.toLocaleString("pt-BR")} hex` : "Desativado"}</td>
      <td class="${deadlines.lateCount ? "failed" : ""}">${deadlines.lateCount ? `${deadlines.lateCount} atrasada(s)` : `${deadlines.onTimeCount} no prazo`}</td>
    </tr>`;
  }).join("");
}

function metricValue(record, metric) {
  if (record.error) return Number.POSITIVE_INFINITY;
  if (metric === "computationTimeMs") return record.computationTimeMs;
  if (metric === "explorations") return record.outcome.trace.length;
  if (metric === "lateCount") return record.outcome.deadlineInfo.lateCount;
  return Number(record.outcome.result[metric]) || 0;
}

function renderResultMaps() {
  invalidateResultMaps();
  elements.comparisonMaps.innerHTML = "";
  state.results.forEach((record, index) => {
    const card = document.createElement("article");
    card.className = "result-map-card";
    card.style.setProperty("--config-color", record.configuration.color);
    card.innerHTML = `<div class="result-map-title"><strong>${escapeHtml(configurationLabel(record.configuration))}</strong><span>${record.error ? "Falhou" : `${formatDistance(record.outcome.result.distanceMeters)} · ${formatComputationTime(record.computationTimeMs)}`}</span></div><div class="result-map" id="result-map-${index}"></div>`;
    elements.comparisonMaps.appendChild(card);
    const map = L.map(`result-map-${index}`, { zoomControl: true, preferCanvas: true, attributionControl: false });
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
  state.overlayMap = L.map("overlay-map", { zoomControl: true, preferCanvas: true });
  addTileLayer(state.overlayMap);
  const bounds = [];
  elements.overlayLegend.innerHTML = "";
  const firstSuccessful = state.results.find((record) => !record.error);
  if (firstSuccessful) drawStaticStops(state.overlayMap, firstSuccessful.outcome.stops);
  state.results.forEach((record) => {
    if (record.error) return;
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
  elements.comparisonMaps.hidden = overlay;
  elements.overlayWrap.hidden = !overlay;
  elements.replay.disabled = overlay || !state.results.some((record) => record.outcome?.trace.length);
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
  stopPlayback();
  state.results = [];
  state.visualRoutingGraph = null;
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

function configurationLabel(configuration) {
  const algorithm = ALGORITHM_LABELS[configuration.algorithm] || configuration.algorithm;
  const type = configuration.modelType === "bidirectional" ? "Bidirecional" : "Normal";
  const h3 = configuration.useH3 ? ` · H3 ${configuration.h3Resolution}` : " · sem H3";
  return `${algorithm} · ${type}${h3}`;
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
