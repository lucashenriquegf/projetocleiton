/**
 * Dynamic H3 Corridor Spatial Utilities for Graph Routing.
 *
 * Constrains graph exploration for A*, Dijkstra, BFS, and DFS within
 * a dynamically expandable lateral hexagonal corridor.
 */

const EARTH_RADIUS_M = 6_371_000;
const corridorIndexCache = new WeakMap();

export function getH3() {
  if (typeof window !== "undefined" && window.h3) {
    return window.h3;
  }
  if (typeof globalThis !== "undefined" && globalThis.h3) {
    return globalThis.h3;
  }
  return null;
}

export function haversineDistance([lat1, lon1], [lat2, lon2]) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlam = toRad(lon2 - lon1);

  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  const clamped = Math.max(0, Math.min(1, a));
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

export function lerpLineCells(startCell, goalCell, resolution = 9, h3 = getH3()) {
  if (startCell === goalCell) return [startCell];
  if (!h3) return [startCell, goalCell];

  const coord1 = h3.cellToLatLng(startCell);
  const coord2 = h3.cellToLatLng(goalCell);
  const distMeters = haversineDistance(coord1, coord2);

  // Approximate edge length at resolution 9 is ~200m
  const approxEdgeLength = Math.max(20, 200 * Math.pow(1 / Math.sqrt(7), resolution - 9));
  const stepSize = Math.max(approxEdgeLength * 0.5, 10);
  const numSamples = Math.max(Math.ceil(distMeters / stepSize), 2);

  const cells = [];
  for (let i = 0; i <= numSamples; i++) {
    const fraction = i / numSamples;
    const lat = coord1[0] + fraction * (coord2[0] - coord1[0]);
    const lng = coord1[1] + fraction * (coord2[1] - coord1[1]);
    const cell = h3.latLngToCell(lat, lng, resolution);
    if (!cells.length || cells.at(-1) !== cell) {
      cells.push(cell);
    }
  }

  if (cells[0] !== startCell) cells.unshift(startCell);
  if (cells.at(-1) !== goalCell) cells.push(goalCell);
  return cells;
}

export function getBaseCorridor(startCell, goalCell, resolution = 9, h3 = getH3()) {
  if (startCell === goalCell) return [startCell];
  if (!h3) return [startCell, goalCell];

  try {
    const path = h3.gridPathCells(startCell, goalCell);
    if (Array.isArray(path) && path.length > 0) {
      return path;
    }
  } catch (err) {
    // gridPathCells can fail across pentagon faces or large distortions
  }

  return lerpLineCells(startCell, goalCell, resolution, h3);
}

export function expandCorridor(baseCells, bufferK = 0, h3 = getH3()) {
  if (!baseCells || !baseCells.length) return new Set();
  if (bufferK <= 0 || !h3) return new Set(baseCells);

  const allowed = new Set();
  for (const cell of baseCells) {
    try {
      const disk = h3.gridDisk(cell, bufferK);
      for (const d of disk) allowed.add(d);
    } catch {
      allowed.add(cell);
    }
  }
  return allowed;
}

export function filterGraphByCorridor(
  graph,
  allowedH3Cells,
  blockedH3Cells = new Set(),
  resolution = 9,
  startNodeId = null,
  targetNodeId = null,
  h3 = getH3()
) {
  if (!h3 || !allowedH3Cells || !allowedH3Cells.size) {
    return graph;
  }

  const index = getCorridorIndex(graph, resolution, h3);
  const allowedNodeIds = new Set();

  for (const cell of allowedH3Cells) {
    if (blockedH3Cells.has(cell)) continue;
    for (const nodeId of index.nodeIdsByCell.get(cell) || []) {
      allowedNodeIds.add(nodeId);
    }
  }

  if (startNodeId) allowedNodeIds.add(startNodeId);
  if (targetNodeId) allowedNodeIds.add(targetNodeId);

  const filteredNodes = [];
  for (const nodeId of allowedNodeIds) {
    const node = index.nodesById.get(nodeId);
    if (node) filteredNodes.push(node);
  }

  const filteredEdges = [];
  for (const fromNodeId of allowedNodeIds) {
    for (const edge of index.edgesByFrom.get(fromNodeId) || []) {
      if (allowedNodeIds.has(edge.to)) filteredEdges.push(edge);
    }
  }

  return {
    ...graph,
    nodes: filteredNodes,
    edges: filteredEdges,
  };
}

function getCorridorIndex(graph, resolution, h3) {
  let byResolution = corridorIndexCache.get(graph);
  if (!byResolution) {
    byResolution = new Map();
    corridorIndexCache.set(graph, byResolution);
  }
  if (byResolution.has(resolution)) return byResolution.get(resolution);

  const nodesById = new Map();
  const nodeIdsByCell = new Map();
  const edgesByFrom = new Map();

  for (const node of graph.nodes) {
    nodesById.set(node.id, node);
    node._h3Cells = node._h3Cells || {};
    let cell = node._h3Cells[resolution];
    if (!cell) {
      cell = h3.latLngToCell(Number(node.latitude), Number(node.longitude), resolution);
      node._h3Cells[resolution] = cell;
    }
    if (!nodeIdsByCell.has(cell)) nodeIdsByCell.set(cell, []);
    nodeIdsByCell.get(cell).push(node.id);
  }

  for (const edge of graph.edges) {
    if (!edgesByFrom.has(edge.from)) edgesByFrom.set(edge.from, []);
    edgesByFrom.get(edge.from).push(edge);
  }

  const index = { nodesById, nodeIdsByCell, edgesByFrom };
  byResolution.set(resolution, index);
  return index;
}

export function getHexagonBoundaries(h3Cells, h3 = getH3()) {
  if (!h3 || !h3Cells) return [];
  const boundaries = [];
  for (const cell of h3Cells) {
    try {
      boundaries.push(h3.cellToBoundary(cell));
    } catch {}
  }
  return boundaries;
}
