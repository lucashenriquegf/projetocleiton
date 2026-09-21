const EARTH_RADIUS_M = 6_371_000;

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;

    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= item.priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }

    this.items[index] = item;
  }

  pop() {
    if (!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();

    if (this.items.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;

        if (left < this.items.length && this.items[left].priority < last.priority) {
          smallest = left;
        }
        if (
          right < this.items.length &&
          this.items[right].priority <
            (smallest === index ? last.priority : this.items[left].priority)
        ) {
          smallest = right;
        }
        if (smallest === index) break;
        this.items[index] = this.items[smallest];
        index = smallest;
      }
      this.items[index] = last;
    }

    return first;
  }

  get size() {
    return this.items.length;
  }
}

export function buildRoutingGraph(graph) {
  const nodes = new Map();
  const adjacency = new Map();
  const incidentRoadNames = new Map();

  for (const node of graph.nodes) {
    nodes.set(node.id, node);
    adjacency.set(node.id, []);
    incidentRoadNames.set(node.id, new Set());
  }

  for (const edge of graph.edges) {
    const fromNode = nodes.get(edge.from);
    const toNode = nodes.get(edge.to);
    if (!fromNode || !toNode) continue;

    const distance = Number(edge.distance_m);
    if (!Number.isFinite(distance) || distance < 0) continue;

    const roadName = normalizeRoadName(edge.road_name);
    adjacency.get(edge.from).push({
      from: edge.from,
      to: edge.to,
      distance,
      roadName,
      geometry: normalizeGeometry(edge.geometry, fromNode, toNode),
    });

    if (roadName) {
      incidentRoadNames.get(edge.from)?.add(roadName);
      incidentRoadNames.get(edge.to)?.add(roadName);
    }
  }

  return { nodes, adjacency, incidentRoadNames };
}

export function findNearestNode(routingGraph, latitude, longitude) {
  let nearest = null;
  let nearestSquaredDistance = Number.POSITIVE_INFINITY;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);

  for (const node of routingGraph.nodes.values()) {
    const latitudeDelta = node.latitude - latitude;
    const longitudeDelta = (node.longitude - longitude) * longitudeScale;
    const squaredDistance =
      latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;

    if (squaredDistance < nearestSquaredDistance) {
      nearest = node;
      nearestSquaredDistance = squaredDistance;
    }
  }

  return nearest;
}

export function shortestPath(routingGraph, startId, endId) {
  return weightedPath(routingGraph, startId, endId, () => 0);
}

export function aStarPath(routingGraph, startId, endId) {
  const target = routingGraph.nodes.get(endId);
  if (!target) return null;

  return weightedPath(routingGraph, startId, endId, (nodeId) => {
    const node = routingGraph.nodes.get(nodeId);
    return calculateStraightLineDistance(node, target);
  });
}

export function depthFirstPath(routingGraph, startId, endId) {
  if (startId === endId) return buildPathResult(routingGraph, [startId]);
  if (!routingGraph.nodes.has(startId) || !routingGraph.nodes.has(endId)) return null;

  const stack = [startId];
  const visited = new Set([startId]);
  const previous = new Map();

  while (stack.length) {
    const currentId = stack.pop();
    if (currentId === endId) break;

    const edges = routingGraph.adjacency.get(currentId) || [];
    for (let index = edges.length - 1; index >= 0; index -= 1) {
      const edge = edges[index];
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      previous.set(edge.to, { nodeId: currentId, edge });
      stack.push(edge.to);
    }
  }

  if (!visited.has(endId)) return null;
  return reconstructPath(routingGraph, startId, endId, previous);
}

export function buildPathResult(routingGraph, nodeIds) {
  if (!nodeIds?.length) return null;
  if (nodeIds.length === 1) {
    const node = routingGraph.nodes.get(nodeIds[0]);
    return {
      nodeIds: [...nodeIds],
      distanceMeters: 0,
      roads: [],
      coordinates: node ? [[node.latitude, node.longitude]] : [],
    };
  }

  const edges = [];
  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    const candidates = (routingGraph.adjacency.get(nodeIds[index]) || [])
      .filter((edge) => edge.to === nodeIds[index + 1]);
    if (!candidates.length) return null;
    edges.push(candidates.reduce((best, edge) => edge.distance < best.distance ? edge : best));
  }

  return summarizePath(nodeIds, edges);
}

export function calculateMultiStopRoute(routingGraph, stops, algorithm = "dijkstra") {
  const pathfinder = {
    dijkstra: shortestPath,
    astar: aStarPath,
    dfs: depthFirstPath,
  }[algorithm];

  if (!pathfinder) throw new Error(`Algoritmo não suportado: ${algorithm}`);

  const pathResults = [];
  for (let index = 0; index < stops.length - 1; index += 1) {
    pathResults.push(pathfinder(routingGraph, stops[index].nodeId, stops[index + 1].nodeId));
  }
  return assembleMultiStopRoute(stops, pathResults);
}

export function assembleMultiStopRoute(stops, pathResults) {
  if (stops.length < 2) {
    return { segments: [], nodeIds: [], coordinates: [], distanceMeters: 0 };
  }

  const segments = [];
  const nodeIds = [];
  const coordinates = [];
  let distanceMeters = 0;

  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = stops[index];
    const to = stops[index + 1];
    const result = pathResults[index];

    if (!result) {
      return {
        error: `Não existe caminho viário entre “${from.name}” e “${to.name}”.`,
        failedSegmentIndex: index,
      };
    }

    segments.push({ from, to, ...result });
    nodeIds.push(...result.nodeIds.slice(index === 0 ? 0 : 1));
    coordinates.push(...result.coordinates.slice(index === 0 ? 0 : 1));
    distanceMeters += result.distanceMeters;
  }

  return { segments, nodeIds, coordinates, distanceMeters };
}

export function calculateStraightLineDistance(from, to) {
  const latitude1 = (from.latitude * Math.PI) / 180;
  const latitude2 = (to.latitude * Math.PI) / 180;
  const deltaLatitude = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLongitude = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function weightedPath(routingGraph, startId, endId, heuristic) {
  if (startId === endId) return buildPathResult(routingGraph, [startId]);
  if (!routingGraph.nodes.has(startId) || !routingGraph.nodes.has(endId)) return null;

  const distances = new Map([[startId, 0]]);
  const previous = new Map();
  const queue = new MinHeap();
  queue.push({ id: startId, distance: 0, priority: heuristic(startId) });

  while (queue.size) {
    const current = queue.pop();
    if (!current) break;
    if (current.distance !== distances.get(current.id)) continue;
    if (current.id === endId) break;

    for (const edge of routingGraph.adjacency.get(current.id) || []) {
      const nextDistance = current.distance + edge.distance;
      if (nextDistance >= (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;

      distances.set(edge.to, nextDistance);
      previous.set(edge.to, { nodeId: current.id, edge });
      queue.push({
        id: edge.to,
        distance: nextDistance,
        priority: nextDistance + heuristic(edge.to),
      });
    }
  }

  if (!distances.has(endId)) return null;
  return reconstructPath(routingGraph, startId, endId, previous);
}

function reconstructPath(routingGraph, startId, endId, previous) {
  const nodeIds = [endId];
  const edges = [];
  let currentId = endId;

  while (currentId !== startId) {
    const step = previous.get(currentId);
    if (!step) return null;
    edges.unshift(step.edge);
    currentId = step.nodeId;
    nodeIds.unshift(currentId);
  }

  return summarizePath(nodeIds, edges);
}

function summarizePath(nodeIds, edges) {
  const coordinates = [];
  const roads = [];
  let distanceMeters = 0;

  for (const edge of edges) {
    coordinates.push(...edge.geometry.slice(coordinates.length ? 1 : 0));
    distanceMeters += edge.distance;
    if (edge.roadName) roads.push(edge.roadName);
  }

  return {
    nodeIds,
    coordinates,
    distanceMeters,
    roads: [...new Set(roads)],
  };
}

function normalizeGeometry(geometry, fromNode, toNode) {
  let coordinates = Array.isArray(geometry) && geometry.length >= 2
    ? geometry.map((coordinate) => [Number(coordinate[0]), Number(coordinate[1])])
    : [
        [fromNode.latitude, fromNode.longitude],
        [toNode.latitude, toNode.longitude],
      ];

  const firstDistance = squaredCoordinateDistance(coordinates[0], fromNode);
  const lastDistance = squaredCoordinateDistance(coordinates[coordinates.length - 1], fromNode);
  if (lastDistance < firstDistance) coordinates = coordinates.reverse();
  return coordinates;
}

function squaredCoordinateDistance(coordinate, node) {
  return (coordinate[0] - node.latitude) ** 2 + (coordinate[1] - node.longitude) ** 2;
}

function normalizeRoadName(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" / ");
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
