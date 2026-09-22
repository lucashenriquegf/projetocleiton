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

    const distance = Number(edge.distance_m);
    if (!Number.isFinite(distance) || distance < 0) return;

    const roadName = normalizeRoadName(edge.road_name);
    const speedKph = resolveEdgeSpeedKph(edge, fallbackSpeedKph);
    const suppliedTravelTime = Number(edge.travel_time_s ?? edge.travel_time);
    const travelTimeSeconds = Number.isFinite(suppliedTravelTime) && suppliedTravelTime >= 0
      ? suppliedTravelTime
      : distance / (speedKph / 3.6);
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

  return { nodes, edges, adjacency, incidentRoadNames };
}

export function findNearestNode(routingGraph, latitude, longitude) {
  let nearest = null;
  let nearestSquaredDistance = Number.POSITIVE_INFINITY;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);

  for (const node of routingGraph.nodes.values()) {
    const latitudeDelta = node.latitude - latitude;
    const longitudeDelta = (node.longitude - longitude) * longitudeScale;
    const squaredDistance = latitudeDelta ** 2 + longitudeDelta ** 2;

    if (squaredDistance < nearestSquaredDistance) {
      nearest = node;
      nearestSquaredDistance = squaredDistance;
    }
  }

  return nearest;
}

export function findNearestEdge(routingGraph, latitude, longitude) {
  let nearest = null;

  for (const edge of routingGraph.edges) {
    const projection = projectPointOntoGeometry(edge.geometry, latitude, longitude);
    if (!nearest || projection.distanceMeters < nearest.distanceMeters) {
      nearest = { ...edge, ...projection };
    }
  }

  return nearest;
}

export function connectStopsToGraph(graph, stops, { fallbackSpeedKph = 40 } = {}) {
  const baseRoutingGraph = buildRoutingGraph(graph, { fallbackSpeedKph });
  const augmentedNodes = graph.nodes.map((node) => ({ ...node }));
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

  graph.edges.forEach((edge, edgeIndex) => {
    if (!attachmentsByEdge.has(edgeIndex)) {
      augmentedEdges.push({ ...edge });
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
  { departureTimeMs = Date.now(), averageSpeedKph = 40 } = {},
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
      estimatedTravelTimeSeconds(first, anchor, averageSpeedKph) -
      estimatedTravelTimeSeconds(second, anchor, averageSpeedKph),
    );
    const nearest = remainingPickups.shift();
    reversePickupOrder.push(nearest);
    anchor = nearest;
  }

  const pickupOrder = reversePickupOrder.reverse();
  const deliveryOrder = [];
  const remainingDeliveries = [...deliveries];
  let current = pickupOrder.at(-1);
  let elapsedSeconds = estimatedSequenceTime(pickupOrder, averageSpeedKph);

  while (remainingDeliveries.length) {
    remainingDeliveries.sort((first, second) => {
      const firstTravel = estimatedTravelTimeSeconds(current, first, averageSpeedKph);
      const secondTravel = estimatedTravelTimeSeconds(current, second, averageSpeedKph);
      const firstSlack = deadlineTimestamp(first) -
        (departureTimeMs + (elapsedSeconds + firstTravel) * 1000);
      const secondSlack = deadlineTimestamp(second) -
        (departureTimeMs + (elapsedSeconds + secondTravel) * 1000);

      return firstSlack - secondSlack || firstTravel - secondTravel;
    });

    const next = remainingDeliveries.shift();
    elapsedSeconds += estimatedTravelTimeSeconds(current, next, averageSpeedKph);
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

  return { segments, nodeIds, coordinates, distanceMeters, travelTimeSeconds };
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

function estimatedSequenceTime(stops, averageSpeedKph) {
  let elapsedSeconds = 0;
  for (let index = 1; index < stops.length; index += 1) {
    elapsedSeconds += estimatedTravelTimeSeconds(
      stops[index - 1],
      stops[index],
      averageSpeedKph,
    );
  }
  return elapsedSeconds;
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

function coordinateDistanceMeters(first, second) {
  const latitude1 = toRadians(first[0]);
  const latitude2 = toRadians(second[0]);
  const deltaLatitude = toRadians(second[0] - first[0]);
  const deltaLongitude = toRadians(second[1] - first[1]);
  const haversine = Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function resolveEdgeSpeedKph(edge, fallbackSpeedKph) {
  const suppliedSpeed = Number(edge.speed_kph);
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

  return parsedSpeeds.length ? Math.min(...parsedSpeeds) : fallbackSpeedKph;
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
