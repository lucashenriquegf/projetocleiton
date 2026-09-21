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

    edges.push(
      candidates.reduce((best, edge) =>
        edge.distance < best.distance ? edge : best,
      ),
    );
  }

  return summarizePath(nodeIds, edges);
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
  const lastDistance = squaredCoordinateDistance(coordinates.at(-1), fromNode);

  if (lastDistance < firstDistance) {
    coordinates = coordinates.reverse();
  }

  return coordinates;
}

function squaredCoordinateDistance(coordinate, node) {
  return (coordinate[0] - node.latitude) ** 2 +
    (coordinate[1] - node.longitude) ** 2;
}

function normalizeRoadName(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" / ");
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
