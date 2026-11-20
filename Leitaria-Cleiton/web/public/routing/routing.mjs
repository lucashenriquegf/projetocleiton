const EARTH_RADIUS_M = 6_371_000;

export function buildRoutingGraph(graph, { fallbackSpeedKph = 40 } = {}) {
  const nodes = new Map();
  const adjacency = new Map();
  const incidentRoadNames = new Map();
  const edges = [];

  for (const node of graph.nodes) {
    nodes.set(node.id, node);
    adjacency.set(node.id, []);
    incidentRoadNames.set(node.id, new Set());
  }

  graph.edges.forEach((edge, edgeIndex) => {
    const fromNode = nodes.get(edge.from);
    const toNode = nodes.get(edge.to);
    if (!fromNode || !toNode) return;

    const distance = resolveEdgeDistanceMeters(edge, fromNode, toNode);
    if (!Number.isFinite(distance) || distance < 0) return;

    const roadName = normalizeRoadName(edge.road_name);
    const speedKph = resolveEdgeSpeedKph(edge, fallbackSpeedKph);
    const travelTimeSeconds = resolveEdgeTravelTimeSeconds(edge, distance, speedKph, fallbackSpeedKph);
    const routingEdge = {
      edgeIndex,
      from: edge.from,
      to: edge.to,
      distance,
      roadName,
      speedKph,
      travelTimeSeconds,
      geometry: normalizeGeometry(edge.geometry, fromNode, toNode),
    };

    adjacency.get(edge.from).push(routingEdge);
    edges.push(routingEdge);

    if (roadName) {
      incidentRoadNames.get(edge.from)?.add(roadName);
      incidentRoadNames.get(edge.to)?.add(roadName);
    }
  });

  const nodeIds = [...nodes.keys()];
  const mainScc = nodeIds.length > 50
    ? findLargestStronglyConnectedComponent(nodeIds, adjacency)
    : new Set(nodeIds);

  edges.forEach((edge) => {
    edge.isRoutable = mainScc.has(edge.from) && mainScc.has(edge.to);
  });

  return { nodes, edges, adjacency, incidentRoadNames, mainScc };
}

function findLargestStronglyConnectedComponent(nodeIds, adjacency) {
  const radj = new Map();
  for (const id of nodeIds) radj.set(id, []);
  for (const [from, outgoing] of adjacency) {
    for (const edge of outgoing) {
      radj.get(edge.to)?.push(from);
    }
  }

  const visited = new Set();
  const order = [];

  for (const id of nodeIds) {
    if (visited.has(id)) continue;
    const stack = [{ u: id, idx: 0 }];
    visited.add(id);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const neighbors = adjacency.get(top.u) || [];
      if (top.idx < neighbors.length) {
        const v = neighbors[top.idx++].to;
        if (!visited.has(v)) {
          visited.add(v);
          stack.push({ u: v, idx: 0 });
        }
      } else {
        order.push(top.u);
        stack.pop();
      }
    }
  }

  const sccVisited = new Set();
  let largest = new Set();

  for (let i = order.length - 1; i >= 0; i--) {
    const root = order[i];
    if (sccVisited.has(root)) continue;
    const component = new Set([root]);
    sccVisited.add(root);
    const q = [root];
    while (q.length) {
      const u = q.pop();
      for (const v of (radj.get(u) || [])) {
        if (!sccVisited.has(v)) {
          sccVisited.add(v);
          component.add(v);
          q.push(v);
        }
      }
    }
    if (component.size > largest.size) {
      largest = component;
    }
  }

  return largest;
}

export function findNearestNode(routingGraph, latitude, longitude) {
  let nearestRoutable = null;
  let nearestAny = null;
  let nearestRoutableSqDist = Number.POSITIVE_INFINITY;
  let nearestAnySqDist = Number.POSITIVE_INFINITY;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);

  for (const node of routingGraph.nodes.values()) {
    const latitudeDelta = node.latitude - latitude;
    const longitudeDelta = (node.longitude - longitude) * longitudeScale;
    const squaredDistance = latitudeDelta ** 2 + longitudeDelta ** 2;

    if (squaredDistance < nearestAnySqDist) {
      nearestAny = node;
      nearestAnySqDist = squaredDistance;
    }

    if (routingGraph.mainScc?.has(node.id)) {
      if (squaredDistance < nearestRoutableSqDist) {
        nearestRoutable = node;
        nearestRoutableSqDist = squaredDistance;
      }
    }
  }

  return nearestRoutable || nearestAny;
}

export function findNearestEdge(routingGraph, latitude, longitude) {
  let nearestRoutable = null;
  let nearestAny = null;

  for (const edge of routingGraph.edges) {
    const projection = projectPointOntoGeometry(edge.geometry, latitude, longitude);
    const candidate = { ...edge, ...projection };

    if (!nearestAny || projection.distanceMeters < nearestAny.distanceMeters) {
      nearestAny = candidate;
    }

    if (edge.isRoutable) {
      if (!nearestRoutable || projection.distanceMeters < nearestRoutable.distanceMeters) {
        nearestRoutable = candidate;
      }
    }
  }

  if (nearestRoutable && (!nearestAny || nearestRoutable.distanceMeters <= nearestAny.distanceMeters + 500)) {
    return nearestRoutable;
  }
  return nearestAny;
}

export function connectStopsToGraph(graph, stops, { fallbackSpeedKph = 40 } = {}) {
  const baseRoutingGraph = buildRoutingGraph(graph, { fallbackSpeedKph });
  const augmentedNodes = [...graph.nodes];
  const augmentedEdges = [];
  const attachmentsByEdge = new Map();

  const connectedStops = stops.map((stop) => {
    const selectedEdge = Number.isInteger(stop.edgeIndex)
      ? baseRoutingGraph.edges.find((edge) => edge.edgeIndex === stop.edgeIndex)
      : null;
    const edge = selectedEdge || findNearestEdge(baseRoutingGraph, stop.latitude, stop.longitude);
    if (!edge) throw new Error(`Não foi encontrada uma rua próxima de “${stop.name}”.`);

    const projection = projectPointOntoGeometry(edge.geometry, stop.latitude, stop.longitude);
    const nodeId = `stop:${stop.id}`;
    const connectedStop = {
      ...stop,
      nodeId,
      edgeIndex: edge.edgeIndex,
      latitude: projection.latitude,
      longitude: projection.longitude,
    };

    augmentedNodes.push({
      id: nodeId,
      latitude: projection.latitude,
      longitude: projection.longitude,
    });
    attachStop(attachmentsByEdge, edge, connectedStop, projection);

    const reverseCandidates = (baseRoutingGraph.adjacency.get(edge.to) || [])
      .filter((candidate) => candidate.to === edge.from)
      .map((candidate) => ({
        edge: candidate,
        projection: projectPointOntoGeometry(
          candidate.geometry,
          projection.latitude,
          projection.longitude,
        ),
      }))
      .filter(({ edge: candidate, projection: candidateProjection }) =>
        candidateProjection.distanceMeters <= 15 &&
        (!edge.roadName || !candidate.roadName || candidate.roadName === edge.roadName),
      )
      .sort((first, second) => first.projection.distanceMeters - second.projection.distanceMeters);

    if (reverseCandidates.length) {
      attachStop(
        attachmentsByEdge,
        reverseCandidates[0].edge,
        connectedStop,
        reverseCandidates[0].projection,
      );
    }

    return connectedStop;
  });

  const baseEdgesByIndex = new Map(baseRoutingGraph.edges.map((edge) => [edge.edgeIndex, edge]));

  graph.edges.forEach((edge, edgeIndex) => {
    if (!attachmentsByEdge.has(edgeIndex)) {
      const baseEdge = baseEdgesByIndex.get(edgeIndex);
      if (baseEdge) {
        augmentedEdges.push(edge);
      } else {
        augmentedEdges.push(edge);
      }
    }
  });

  for (const [edgeIndex, attachments] of attachmentsByEdge) {
    const edge = baseRoutingGraph.edges.find((candidate) => candidate.edgeIndex === edgeIndex);
    if (!edge) continue;

    const points = [
      { nodeId: edge.from, fraction: 0 },
      ...attachments.sort((first, second) => first.fraction - second.fraction),
      { nodeId: edge.to, fraction: 1 },
    ];

    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const fraction = Math.max(0, to.fraction - from.fraction);

      augmentedEdges.push({
        from: from.nodeId,
        to: to.nodeId,
        distance_m: edge.distance * fraction,
        road_name: edge.roadName,
        speed_kph: edge.speedKph,
        travel_time_s: edge.travelTimeSeconds * fraction,
        geometry: sliceGeometry(edge.geometry, from.fraction, to.fraction),
        virtual: true,
      });
    }
  }

  return {
    graph: { ...graph, nodes: augmentedNodes, edges: augmentedEdges },
    stops: connectedStops,
  };
}

export function prioritizeStopOrder(
  stops,
  {
    departureTimeMs = Date.now(),
    averageSpeedKph = 40,
    travelTimeMatrix = null,
  } = {},
) {
  const pickups = stops.filter((stop) => stop.type === "pickup");
  const deliveries = stops.filter((stop) => stop.type === "delivery");
  if (!pickups.length || !deliveries.length) return [...stops];

  const urgentDelivery = deliveries.reduce((urgent, delivery) =>
    deadlineTimestamp(delivery) < deadlineTimestamp(urgent) ? delivery : urgent,
  );

  const reversePickupOrder = [];
  const remainingPickups = [...pickups];
  let anchor = urgentDelivery;

  while (remainingPickups.length) {
    remainingPickups.sort((first, second) =>
      travelTimeBetweenStops(first, anchor, { travelTimeMatrix, averageSpeedKph }) -
      travelTimeBetweenStops(second, anchor, { travelTimeMatrix, averageSpeedKph }),
    );
    const nearest = remainingPickups.shift();
    reversePickupOrder.push(nearest);
    anchor = nearest;
  }

  const pickupOrder = reversePickupOrder.reverse();
  const deliveryOrder = [];
  const remainingDeliveries = [...deliveries];
  let current = pickupOrder.at(-1);
  let elapsedSeconds = estimatedSequenceTime(pickupOrder, {
    averageSpeedKph,
    travelTimeMatrix,
  });

  while (remainingDeliveries.length) {
    remainingDeliveries.sort((first, second) => {
      const firstTravel = travelTimeBetweenStops(current, first, {
        travelTimeMatrix,
        averageSpeedKph,
      });
      const secondTravel = travelTimeBetweenStops(current, second, {
        travelTimeMatrix,
        averageSpeedKph,
      });
      const firstSlack = deadlineTimestamp(first) -
        (departureTimeMs + (elapsedSeconds + firstTravel) * 1000);
      const secondSlack = deadlineTimestamp(second) -
        (departureTimeMs + (elapsedSeconds + secondTravel) * 1000);

      return firstSlack - secondSlack || firstTravel - secondTravel;
    });

    const next = remainingDeliveries.shift();
    elapsedSeconds += travelTimeBetweenStops(current, next, {
      travelTimeMatrix,
      averageSpeedKph,
    });
    deliveryOrder.push(next);
    current = next;
  }

  return [...pickupOrder, ...deliveryOrder];
}

export function buildPathResult(routingGraph, nodeIds) {
  if (!nodeIds?.length) return null;

  if (nodeIds.length === 1) {
    const node = routingGraph.nodes.get(nodeIds[0]);
    return {
      nodeIds: [...nodeIds],
      distanceMeters: 0,
      travelTimeSeconds: 0,
      roads: [],
      coordinates: node ? [[node.latitude, node.longitude]] : [],
    };
  }

  const edges = [];

  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    const candidates = (routingGraph.adjacency.get(nodeIds[index]) || [])
      .filter((edge) => edge.to === nodeIds[index + 1]);

    if (!candidates.length) return null;

    edges.push(
      candidates.reduce((best, edge) =>
        edge.travelTimeSeconds < best.travelTimeSeconds ? edge : best,
      ),
    );
  }

  return summarizePath(nodeIds, edges);
}

export function assembleMultiStopRoute(stops, pathResults) {
  if (stops.length < 2) {
    return {
      segments: [],
      nodeIds: [],
      coordinates: [],
      distanceMeters: 0,
      travelTimeSeconds: 0,
    };
  }

  const segments = [];
  const nodeIds = [];
  const coordinates = [];
  let distanceMeters = 0;
  let travelTimeSeconds = 0;

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
    travelTimeSeconds += result.travelTimeSeconds;
  }

  return {
    segments,
    nodeIds,
    coordinates,
    distanceMeters,
    travelTimeSeconds,
  };
}

export function findStopsOnPath(nodeIds, remainingStops, allowedType) {
  const nodePositions = new Map(
    nodeIds.map((nodeId, index) => [nodeId, index]),
  );

  return remainingStops
    .filter((stop) => stop.type === allowedType && nodePositions.has(stop.nodeId))
    .sort((first, second) =>
      nodePositions.get(first.nodeId) - nodePositions.get(second.nodeId),
    );
}

function estimatedSequenceTime(
  stops,
  { averageSpeedKph = 40, travelTimeMatrix = null } = {},
) {
  let elapsedSeconds = 0;
  for (let index = 1; index < stops.length; index += 1) {
    elapsedSeconds += travelTimeBetweenStops(
      stops[index - 1],
      stops[index],
      { averageSpeedKph, travelTimeMatrix },
    );
  }
  return elapsedSeconds;
}

export function travelTimeBetweenStops(
  from,
  to,
  { travelTimeMatrix = null, averageSpeedKph = 40 } = {},
) {
  if (!from || !to) return Number.POSITIVE_INFINITY;
  if (from.id === to.id || (from.nodeId && from.nodeId === to.nodeId)) return 0;

  const row = travelTimeMatrix?.get?.(from.nodeId);
  const matrixValue = row?.get?.(to.nodeId);
  if (Number.isFinite(matrixValue) && matrixValue >= 0) return matrixValue;

  return estimatedTravelTimeSeconds(from, to, averageSpeedKph);
}

export function evaluateStopSequence(
  stops,
  {
    departureTimeMs = Date.now(),
    averageSpeedKph = 40,
    travelTimeMatrix = null,
    returnToStart = false,
  } = {},
) {
  if (!stops.length) {
    return {
      lateCount: 0,
      totalLatenessSeconds: 0,
      minSlackSeconds: Number.POSITIVE_INFINITY,
      travelTimeSeconds: 0,
    };
  }

  let elapsedSeconds = 0;
  let travelTimeSeconds = 0;
  let lateCount = 0;
  let totalLatenessSeconds = 0;
  let minSlackSeconds = Number.POSITIVE_INFINITY;

  if (stops[0].type === "delivery") {
    const slack = (deadlineTimestamp(stops[0]) - departureTimeMs) / 1000 - elapsedSeconds;
    minSlackSeconds = Math.min(minSlackSeconds, slack);
    if (slack < 0) {
      lateCount += 1;
      totalLatenessSeconds += -slack;
    }
  }

  for (let index = 1; index < stops.length; index += 1) {
    const from = stops[index - 1];
    const to = stops[index];
    const travel = travelTimeBetweenStops(from, to, {
      travelTimeMatrix,
      averageSpeedKph,
    });
    travelTimeSeconds += travel;
    elapsedSeconds += travel;

    if (to.type === "delivery") {
      const slack = (deadlineTimestamp(to) - departureTimeMs) / 1000 - elapsedSeconds;
      minSlackSeconds = Math.min(minSlackSeconds, slack);
      if (slack < 0) {
        lateCount += 1;
        totalLatenessSeconds += -slack;
      }
    }
  }

  if (returnToStart && stops.length > 1) {
    const returnTravel = travelTimeBetweenStops(stops.at(-1), stops[0], {
      travelTimeMatrix,
      averageSpeedKph,
    });
    travelTimeSeconds += returnTravel;
    elapsedSeconds += returnTravel;
  }

  return {
    lateCount,
    totalLatenessSeconds,
    minSlackSeconds,
    travelTimeSeconds,
  };
}

export async function buildStopTravelTimeMatrix(
  routingGraph,
  stops,
  {
    signal = null,
    yieldControl = null,
    yieldEvery = 4096,
  } = {},
) {
  const uniqueNodeIds = [...new Set(stops.map((stop) => stop.nodeId).filter(Boolean))];
  const targetNodeIds = new Set(uniqueNodeIds);
  const matrix = new Map();

  for (const sourceNodeId of uniqueNodeIds) {
    throwIfRoutingCancelled(signal);
    matrix.set(sourceNodeId, await shortestTravelTimesFrom(
      routingGraph,
      sourceNodeId,
      targetNodeIds,
      { signal, yieldControl, yieldEvery },
    ));
  }

  return matrix;
}

async function shortestTravelTimesFrom(
  routingGraph,
  sourceNodeId,
  targetNodeIds,
  { signal, yieldControl, yieldEvery },
) {
  const distances = new Map([[sourceNodeId, 0]]);
  const results = new Map([[sourceNodeId, 0]]);
  const remainingTargets = new Set(targetNodeIds);
  remainingTargets.delete(sourceNodeId);
  const settled = new Set();
  const queue = new TravelTimePriorityQueue();
  queue.push({ nodeId: sourceNodeId, cost: 0 });
  let expansions = 0;

  while (queue.size && remainingTargets.size) {
    throwIfRoutingCancelled(signal);
    const current = queue.pop();
    if (settled.has(current.nodeId) || current.cost !== distances.get(current.nodeId)) continue;
    settled.add(current.nodeId);

    if (remainingTargets.delete(current.nodeId)) {
      results.set(current.nodeId, current.cost);
    }

    expansions += 1;
    if (yieldControl && expansions % Math.max(1, Number(yieldEvery) || 1) === 0) {
      await yieldControl();
      throwIfRoutingCancelled(signal);
    }

    for (const edge of routingGraph.adjacency.get(current.nodeId) || []) {
      const nextCost = current.cost + edge.travelTimeSeconds;
      if (nextCost >= (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(edge.to, nextCost);
      queue.push({ nodeId: edge.to, cost: nextCost });
    }
  }

  return results;
}

class TravelTimePriorityQueue {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].cost <= item.cost) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        let smallest = left;
        if (right < this.items.length && this.items[right].cost < this.items[left].cost) {
          smallest = right;
        }
        if (this.items[smallest].cost >= last.cost) break;
        this.items[index] = this.items[smallest];
        index = smallest;
      }
      this.items[index] = last;
    }
    return first;
  }
}

function throwIfRoutingCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Cálculo cancelado.");
  error.name = "AbortError";
  throw error;
}

function estimatedTravelTimeSeconds(from, to, averageSpeedKph) {
  const distanceMeters = coordinateDistanceMeters(
    [Number(from.latitude), Number(from.longitude)],
    [Number(to.latitude), Number(to.longitude)],
  );
  const speedMetersPerSecond = Math.max(1, Number(averageSpeedKph)) / 3.6;
  return distanceMeters / speedMetersPerSecond;
}

function deadlineTimestamp(stop) {
  const timestamp = Date.parse(stop.deadline);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function attachStop(attachmentsByEdge, edge, stop, projection) {
  if (!attachmentsByEdge.has(edge.edgeIndex)) attachmentsByEdge.set(edge.edgeIndex, []);
  attachmentsByEdge.get(edge.edgeIndex).push({ nodeId: stop.nodeId, fraction: projection.fraction });
}

function summarizePath(nodeIds, edges) {
  const coordinates = [];
  const roads = [];
  let distanceMeters = 0;
  let travelTimeSeconds = 0;

  for (const edge of edges) {
    coordinates.push(...edge.geometry.slice(coordinates.length ? 1 : 0));
    distanceMeters += edge.distance;
    travelTimeSeconds += edge.travelTimeSeconds;
    if (edge.roadName) roads.push(edge.roadName);
  }

  return {
    nodeIds,
    coordinates,
    distanceMeters,
    travelTimeSeconds,
    roads: [...new Set(roads)],
  };
}

function projectPointOntoGeometry(geometry, latitude, longitude) {
  const measurements = measureGeometry(geometry);
  let best = null;

  for (let index = 0; index < geometry.length - 1; index += 1) {
    const start = geometry[index];
    const end = geometry[index + 1];
    const referenceLatitude = (latitude + start[0] + end[0]) / 3;
    const longitudeScale = Math.cos((referenceLatitude * Math.PI) / 180);
    const pointX = longitude * longitudeScale;
    const startX = start[1] * longitudeScale;
    const endX = end[1] * longitudeScale;
    const deltaX = endX - startX;
    const deltaY = end[0] - start[0];
    const denominator = deltaX ** 2 + deltaY ** 2;
    const segmentFraction = denominator === 0
      ? 0
      : Math.max(0, Math.min(1, ((pointX - startX) * deltaX + (latitude - start[0]) * deltaY) / denominator));
    const projectedLatitude = start[0] + deltaY * segmentFraction;
    const projectedLongitude = start[1] + (end[1] - start[1]) * segmentFraction;
    const distanceMeters = coordinateDistanceMeters(
      [latitude, longitude],
      [projectedLatitude, projectedLongitude],
    );

    if (!best || distanceMeters < best.distanceMeters) {
      const distanceAlong = measurements.cumulative[index] + measurements.segments[index] * segmentFraction;
      best = {
        latitude: projectedLatitude,
        longitude: projectedLongitude,
        distanceMeters,
        fraction: measurements.total ? distanceAlong / measurements.total : 0,
      };
    }
  }

  return best || {
    latitude: geometry[0][0],
    longitude: geometry[0][1],
    distanceMeters: coordinateDistanceMeters([latitude, longitude], geometry[0]),
    fraction: 0,
  };
}

function sliceGeometry(geometry, startFraction, endFraction) {
  const measurements = measureGeometry(geometry);
  if (!measurements.total) return [geometry[0], geometry.at(-1)];

  const startDistance = measurements.total * startFraction;
  const endDistance = measurements.total * endFraction;
  const coordinates = [pointAtDistance(geometry, measurements, startDistance)];

  for (let index = 1; index < geometry.length - 1; index += 1) {
    if (measurements.cumulative[index] > startDistance && measurements.cumulative[index] < endDistance) {
      coordinates.push(geometry[index]);
    }
  }

  coordinates.push(pointAtDistance(geometry, measurements, endDistance));
  return deduplicateCoordinates(coordinates);
}

function pointAtDistance(geometry, measurements, targetDistance) {
  if (targetDistance <= 0) return [...geometry[0]];
  if (targetDistance >= measurements.total) return [...geometry.at(-1)];

  for (let index = 0; index < measurements.segments.length; index += 1) {
    const segmentEnd = measurements.cumulative[index + 1];
    if (targetDistance <= segmentEnd) {
      const start = geometry[index];
      const end = geometry[index + 1];
      const segmentLength = measurements.segments[index];
      const fraction = segmentLength
        ? (targetDistance - measurements.cumulative[index]) / segmentLength
        : 0;
      return [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ];
    }
  }

  return [...geometry.at(-1)];
}

function measureGeometry(geometry) {
  const segments = [];
  const cumulative = [0];
  let total = 0;

  for (let index = 0; index < geometry.length - 1; index += 1) {
    const distance = coordinateDistanceMeters(geometry[index], geometry[index + 1]);
    segments.push(distance);
    total += distance;
    cumulative.push(total);
  }

  return { segments, cumulative, total };
}

function deduplicateCoordinates(coordinates) {
  return coordinates.filter((coordinate, index) =>
    index === 0 || coordinate[0] !== coordinates[index - 1][0] || coordinate[1] !== coordinates[index - 1][1],
  );
}

export function coordinateDistanceMeters(first, second) {
  const latitude1 = toRadians(first[0]);
  const latitude2 = toRadians(second[0]);
  const deltaLatitude = toRadians(second[0] - first[0]);
  const deltaLongitude = toRadians(second[1] - first[1]);
  const haversine = Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  const clampedHaversine = Math.max(0, Math.min(1, haversine));
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(clampedHaversine), Math.sqrt(1 - clampedHaversine));
}

export function resolveEdgeDistanceMeters(edge, fromNode, toNode) {
  const rawDistance = Array.isArray(edge.distance_m ?? edge.distance ?? edge.length)
    ? (edge.distance_m ?? edge.distance ?? edge.length)[0]
    : (edge.distance_m ?? edge.distance ?? edge.length);
  const distance = Number(rawDistance);
  if (Number.isFinite(distance) && distance >= 0) return distance;

  if (fromNode && toNode) {
    const lat1 = Number(fromNode.latitude);
    const lon1 = Number(fromNode.longitude);
    const lat2 = Number(toNode.latitude);
    const lon2 = Number(toNode.longitude);
    if (Number.isFinite(lat1) && Number.isFinite(lon1) && Number.isFinite(lat2) && Number.isFinite(lon2)) {
      return coordinateDistanceMeters([lat1, lon1], [lat2, lon2]);
    }
  }

  return null;
}

export function resolveEdgeSpeedKph(edge, fallbackSpeedKph = 40) {
  const rawSpeed = Array.isArray(edge.speed_kph) ? edge.speed_kph[0] : edge.speed_kph;
  const suppliedSpeed = Number(rawSpeed);
  if (Number.isFinite(suppliedSpeed) && suppliedSpeed > 0) return suppliedSpeed;

  const values = Array.isArray(edge.max_speed) ? edge.max_speed : [edge.max_speed];
  const parsedSpeeds = values
    .flatMap((value) => String(value ?? "").split(/[;,|]/))
    .map((value) => {
      const numeric = Number.parseFloat(value);
      if (!Number.isFinite(numeric) || numeric <= 0) return null;
      return /mph/i.test(value) ? numeric * 1.609344 : numeric;
    })
    .filter((value) => value !== null);

  const fallback = Number.isFinite(Number(fallbackSpeedKph)) && Number(fallbackSpeedKph) > 0
    ? Number(fallbackSpeedKph)
    : 40;
  return parsedSpeeds.length ? Math.min(...parsedSpeeds) : fallback;
}

export function resolveEdgeTravelTimeSeconds(edge, distance, speedKph, fallbackSpeedKph = 40) {
  const rawTravelTime = Array.isArray(edge.travel_time_s ?? edge.travel_time)
    ? (edge.travel_time_s ?? edge.travel_time)[0]
    : (edge.travel_time_s ?? edge.travel_time);
  const suppliedTravelTime = Number(rawTravelTime);

  const numericDistance = Number(distance);
  if (Number.isFinite(suppliedTravelTime) && (suppliedTravelTime > 0 || (numericDistance === 0 && suppliedTravelTime >= 0))) {
    return suppliedTravelTime;
  }

  const safeSpeed = Number.isFinite(speedKph) && speedKph > 0
    ? speedKph
    : resolveEdgeSpeedKph(edge, fallbackSpeedKph);
  return Math.max(0, numericDistance) / (safeSpeed / 3.6);
}

function normalizeGeometry(geometry, fromNode, toNode) {
  let coordinates = Array.isArray(geometry) && geometry.length >= 2
    ? geometry.map((coordinate) => [Number(coordinate[0]), Number(coordinate[1])])
    : [
        [fromNode.latitude, fromNode.longitude],
        [toNode.latitude, toNode.longitude],
      ];

  const firstDistance = squaredCoordinateDistance(coordinates[0], fromNode);
  const lastDistance = squaredCoordinateDistance(coordinates.at(-1), fromNode);
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

function toRadians(value) {
  return (value * Math.PI) / 180;
}
