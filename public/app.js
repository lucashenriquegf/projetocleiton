import {
  assembleMultiStopRoute,
  buildRoutingGraph,
  buildPathResult,
  findNearestNode,
} from "/algorithms/routing.mjs";
import { aStar } from "/algorithms/AStar.js";
import { bfs } from "/algorithms/BSF.js";

const state = {
  graph: null,
  routingGraph: null,
  map: null,
  networkLayer: null,
  stops: [],
  routeLayers: [],
  addMode: null,
  dragDepth: 0,
  counters: { pickup: 0, delivery: 0 },
  toastTimer: null,
  lastRoute: null,
};

const elements = {
  cityName: document.querySelector("#city-name"),
  loadingState: document.querySelector("#loading-state"),
  stopCount: document.querySelector("#stop-count"),
  stopList: document.querySelector("#stop-list"),
  emptyStops: document.querySelector("#empty-stops"),
  orderHint: document.querySelector("#order-hint"),
  clearRoute: document.querySelector("#clear-route"),
  calculateRoute: document.querySelector("#calculate-route"),
  calculationNote: document.querySelector("#calculation-note"),
  algorithm: document.querySelector("#algorithm"),
  averageSpeed: document.querySelector("#average-speed"),
  speedValue: document.querySelector("#speed-value"),
  routeSummary: document.querySelector("#route-summary"),
  totalDistance: document.querySelector("#total-distance"),
  estimatedTime: document.querySelector("#estimated-time"),
  pickupTotal: document.querySelector("#pickup-total"),
  deliveryTotal: document.querySelector("#delivery-total"),
  computationTime: document.querySelector("#computation-time"),
  selectedAlgorithm: document.querySelector("#selected-algorithm"),
  segmentList: document.querySelector("#segment-list"),
  networkToggle: document.querySelector("#network-toggle"),
  mapInstruction: document.querySelector("#map-instruction"),
  instructionText: document.querySelector("#instruction-text"),
  cancelAdd: document.querySelector("#cancel-add"),
  dropOverlay: document.querySelector("#drop-overlay"),
  toast: document.querySelector("#toast"),
};

async function initialize() {
  initializeMap();
  bindInterfaceEvents();

  try {
    const response = await fetch("/api/grafo");
    if (!response.ok) throw new Error("Não foi possível carregar a rede viária.");

    state.graph = await response.json();
    state.routingGraph = buildRoutingGraph(state.graph);
    elements.cityName.textContent = state.graph.city.replace(", Brazil", "");

    const bounds = L.latLngBounds(
      state.graph.nodes.map((node) => [node.latitude, node.longitude]),
    );
    state.map.fitBounds(bounds, { padding: [28, 28] });
    elements.loadingState.classList.add("hidden");
  } catch (error) {
    console.error(error);
    elements.loadingState.querySelector("span").textContent = "Erro ao carregar o mapa.";
    elements.loadingState.querySelector(".loader")?.remove();
    showToast(error.message, true);
  }
}

function initializeMap() {
  state.map = L.map("map", { zoomControl: false, preferCanvas: true }).setView([-16.36, -49.5], 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);

  L.control.zoom({ position: "topleft" }).addTo(state.map);
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
  elements.clearRoute.addEventListener("click", clearAllStops);
  elements.calculateRoute.addEventListener("click", calculateRoute);
  elements.algorithm.addEventListener("change", invalidateRoute);
  elements.averageSpeed.addEventListener("input", () => {
    elements.speedValue.textContent = elements.averageSpeed.value;
    if (state.lastRoute) {
      renderRouteSummary(state.lastRoute, false);
    }
  });
  elements.networkToggle.addEventListener("change", toggleNetworkLayer);
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
  const node = findNearestNode(state.routingGraph, latlng.lat, latlng.lng);
  if (!node) {
    showToast("Não foi encontrada uma rua próxima a esse local.", true);
    return;
  }

  state.counters[type] += 1;
  const typeName = type === "pickup" ? "Coleta" : "Entrega";
  const stop = {
    id: `${type}-${Date.now()}-${state.counters[type]}`,
    type,
    name: `${typeName} ${state.counters[type]}`,
    roadName: getRoadName(node.id),
    nodeId: node.id,
    latitude: node.latitude,
    longitude: node.longitude,
    marker: null,
  };

  stop.marker = createStopMarker(stop);
  state.stops.push(stop);
  invalidateRoute();
  renderStops();
  showToast(`${stop.name} conectada à rede viária.`);
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
    const nearestNode = findNearestNode(state.routingGraph, position.lat, position.lng);
    if (!nearestNode) return;

    stop.nodeId = nearestNode.id;
    stop.latitude = nearestNode.latitude;
    stop.longitude = nearestNode.longitude;
    stop.roadName = getRoadName(nearestNode.id);
    marker.setLatLng([nearestNode.latitude, nearestNode.longitude]);
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
  return `<div class="stop-popup"><strong>${escapeHtml(stop.name)}</strong><span>${escapeHtml(stop.roadName)}</span><span>${coordinates}</span></div>`;
}

function getRoadName(nodeId) {
  const names = [...(state.routingGraph.incidentRoadNames.get(nodeId) || [])];
  return names[0] || "Via local sem nome";
}

function renderStops() {
  elements.stopCount.textContent = state.stops.length;
  elements.emptyStops.hidden = state.stops.length > 0;
  elements.orderHint.hidden = state.stops.length < 2;
  elements.clearRoute.disabled = state.stops.length === 0;

  const pickupCount = state.stops.filter((stop) => stop.type === "pickup").length;
  const deliveryCount = state.stops.length - pickupCount;
  elements.calculateRoute.disabled = pickupCount === 0 || deliveryCount === 0;
  elements.calculationNote.textContent = getCalculationNote(pickupCount, deliveryCount);

  elements.stopList.innerHTML = "";
  state.stops.forEach((stop, index) => {
    stop.marker.setIcon(createStopIcon(stop, index + 1));
    stop.marker.setTooltipContent(`${index + 1}. ${stop.name}`);

    const item = document.createElement("li");
    item.className = `stop-item ${stop.type}`;
    item.draggable = true;
    item.dataset.stopId = stop.id;
    item.innerHTML = `
      <span class="stop-sequence">${index + 1}</span>
      <span class="stop-copy"><strong>${escapeHtml(stop.name)}</strong><small>${escapeHtml(stop.roadName)}</small></span>
      <button class="remove-stop" type="button" aria-label="Remover ${escapeHtml(stop.name)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>`;

    item.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      state.map.flyTo([stop.latitude, stop.longitude], Math.max(state.map.getZoom(), 16));
      stop.marker.openPopup();
    });
    item.querySelector(".remove-stop").addEventListener("click", () => removeStop(stop.id));
    bindStopReordering(item);
    elements.stopList.appendChild(item);
  });
}

function bindStopReordering(item) {
  item.addEventListener("dragstart", (event) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-cooproute-order", item.dataset.stopId);
    requestAnimationFrame(() => item.classList.add("dragging"));
  });
  item.addEventListener("dragend", () => {
    item.classList.remove("dragging");
    document.querySelectorAll(".stop-item").forEach((row) => row.classList.remove("drag-over"));
  });
  item.addEventListener("dragover", (event) => {
    if (![...(event.dataTransfer?.types || [])].includes("application/x-cooproute-order")) return;
    event.preventDefault();
    event.stopPropagation();
    item.classList.add("drag-over");
  });
  item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
  item.addEventListener("drop", (event) => {
    const draggedId = event.dataTransfer.getData("application/x-cooproute-order");
    if (!draggedId) return;
    event.preventDefault();
    event.stopPropagation();
    item.classList.remove("drag-over");

    const fromIndex = state.stops.findIndex((stop) => stop.id === draggedId);
    const toIndex = state.stops.findIndex((stop) => stop.id === item.dataset.stopId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [movedStop] = state.stops.splice(fromIndex, 1);
    state.stops.splice(toIndex, 0, movedStop);
    invalidateRoute();
    renderStops();
  });
}

function getCalculationNote(pickups, deliveries) {
  if (!pickups && !deliveries) return "Adicione os pontos para começar";
  if (!pickups) return "Adicione ao menos um ponto de coleta";
  if (!deliveries) return "Adicione ao menos um ponto de entrega";
  return `${pickups} ${pluralize(pickups, "coleta", "coletas")} • ${deliveries} ${pluralize(deliveries, "entrega", "entregas")}`;
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
  state.lastRoute = null;
  elements.routeSummary.hidden = true;
  elements.calculateRoute.querySelector("span").textContent = "Calcular rota";
}

async function calculateRoute() {
  const pickups = state.stops.filter((stop) => stop.type === "pickup");
  const deliveries = state.stops.filter((stop) => stop.type === "delivery");
  if (!pickups.length || !deliveries.length) {
    showToast("Adicione ao menos uma coleta e uma entrega.", true);
    return;
  }

  elements.calculateRoute.classList.add("loading");
  elements.calculateRoute.disabled = true;
  elements.calculateRoute.querySelector("span").textContent = "Calculando";
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const algorithm = elements.algorithm.value;
  const startedAt = performance.now();
  let result;

  try {
    result = await calculateSelectedAlgorithmRoute(algorithm);
  } catch (error) {
    console.error(error);
    showToast("Ocorreu um erro durante o cálculo.", true);
    result = { error: error.message };
  }

  const computationTimeMs = performance.now() - startedAt;
  elements.calculateRoute.classList.remove("loading");
  elements.calculateRoute.disabled = false;

  if (result.error) {
    elements.calculateRoute.querySelector("span").textContent = "Calcular rota";
    showToast(result.error, true);
    return;
  }

  state.lastRoute = {
    ...result,
    computationTimeMs,
    algorithm,
    pickupCount: pickups.length,
    deliveryCount: deliveries.length,
  };
  drawRoute(state.lastRoute);
  renderRouteSummary(state.lastRoute);
  elements.calculateRoute.querySelector("span").textContent = "Recalcular rota";
  showToast("Rota calculada.");
}

async function calculateSelectedAlgorithmRoute(algorithm) {
  const pathResults = [];

  for (let index = 0; index < state.stops.length - 1; index += 1) {
    const parameters = {
      grafo: state.graph,
      inicio: state.stops[index].nodeId,
      destino: state.stops[index + 1].nodeId,
    };
    const nodeIds = algorithm === "bfs"
      ? await bfs({ ...parameters, markers: new Map(), velocidade: 0 })
      : aStar(parameters);

    pathResults.push(buildPathResult(state.routingGraph, nodeIds));
  }

  return assembleMultiStopRoute(state.stops, pathResults);
}

function drawRoute(result) {
  clearRouteLayers();
  const latlngs = result.coordinates;
  if (latlngs.length < 2) return;

  const casing = L.polyline(latlngs, { color: "#fff", weight: 9, opacity: .94, lineJoin: "round", interactive: false }).addTo(state.map);
  const route = L.polyline(latlngs, { color: "#176b43", weight: 5, opacity: 1, lineJoin: "round" }).addTo(state.map);
  state.routeLayers.push(casing, route);
  state.stops.forEach((stop) => stop.marker.setZIndexOffset(1000));
  state.map.fitBounds(route.getBounds(), { padding: [55, 55], maxZoom: 16 });
}

function renderRouteSummary(result, scrollToSummary = true) {
  const speed = Number(elements.averageSpeed.value);
  elements.totalDistance.textContent = formatDistance(result.distanceMeters);
  elements.estimatedTime.textContent = formatDuration(result.distanceMeters, speed);
  elements.pickupTotal.textContent = result.pickupCount;
  elements.deliveryTotal.textContent = result.deliveryCount;
  elements.computationTime.textContent = formatComputationTime(result.computationTimeMs);
  elements.selectedAlgorithm.textContent = getAlgorithmLabel(result.algorithm);
  elements.segmentList.innerHTML = result.segments.map((segment, index) => {
    const mainRoad = segment.roads[0] || "Vias locais";
    return `<div class="segment-row">
      <span class="segment-number">${index + 1}</span>
      <span class="segment-copy"><strong>${escapeHtml(segment.from.name)} → ${escapeHtml(segment.to.name)}</strong><small>${escapeHtml(mainRoad)}</small></span>
      <span class="segment-metric">${formatDistance(segment.distanceMeters)} · ${formatDuration(segment.distanceMeters, speed)}</span>
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

function formatDuration(meters, speedKmh) {
  const totalMinutes = Math.max(1, Math.round((meters / 1000 / speedKmh) * 60));
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
  }[value] || value;
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
