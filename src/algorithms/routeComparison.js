import { aStarWithProgress } from "./AStar.js";
import { bfs } from "./BSF.js";
import { dfs } from "./DFS.js";
import { dijkstra } from "./Dijkstra.js";
import { bidirectionalAStar } from "./BidirectionalAStar.js";
import { bidirectionalBfs } from "./BidirectionalBFS.js";
import { bidirectionalDfs } from "./BidirectionalDFS.js";
import { bidirectionalDijkstra } from "./BidirectionalDijkstra.js";
import { greedyBestFirst } from "./GreedyBestFirst.js";
import { beamSearch } from "./BeamSearch.js";
import { bidirectionalGreedyBestFirst } from "./BidirectionalGreedyBestFirst.js";
import { bidirectionalBeamSearch } from "./BidirectionalBeamSearch.js";
import {
  assembleMultiStopRoute,
  buildStopTravelTimeMatrix,
  buildPathResult,
  buildRoutingGraph,
  connectStopsToGraph,
  findStopsOnPath,
  prioritizeStopOrder,
} from "./routing.mjs";
import { optimizeStopOrderIls } from "./StopOrderILS.js";
import {
  expandCorridor,
  filterGraphByCorridor,
  getBaseCorridor,
} from "./h3_corridor.js";

const SEARCH_BATCH_SIZE = 128;

export function recommendComparisonWorkerCount({
  nodeCount = 0,
  edgeCount = 0,
  totalTasks = 1,
  hardwareConcurrency = 4,
}) {
  let graphLimit = 8;
  if (edgeCount >= 250_000 || nodeCount >= 100_000) graphLimit = 1;
  else if (edgeCount >= 100_000 || nodeCount >= 40_000) graphLimit = 2;
  else if (edgeCount >= 50_000 || nodeCount >= 20_000) graphLimit = 4;
  return Math.max(1, Math.min(hardwareConcurrency || 4, totalTasks, graphLimit));
}

export async function prepareRouteNetwork({
  graph,
  stops,
  averageSpeedKph = 40,
  signal = null,
  yieldControl = null,
}) {
  const preparationStartedAt = now();
  const connected = connectStopsToGraph(graph, stops, { fallbackSpeedKph: averageSpeedKph });
  const calculationGraph = connected.graph;
  const routingGraph = buildRoutingGraph(calculationGraph, {
    fallbackSpeedKph: averageSpeedKph,
  });
  const travelTimeMatrix = await buildStopTravelTimeMatrix(routingGraph, connected.stops, {
    signal,
    yieldControl,
  });
  throwIfCancelled(signal);

  return {
    calculationGraph,
    routingGraph,
    connectedStops: connected.stops,
    travelTimeMatrix,
    preparationTimeMs: now() - preparationStartedAt,
  };
}

export async function prepareRouteComparison({
  graph,
  stops,
  departureTimeMs = Date.now(),
  averageSpeedKph = 40,
  orderStrategy = "priority",
  orderBudgetMs = 500,
  returnToStart = false,
  signal = null,
  yieldControl = null,
  preparedNetwork = null,
}) {
  const preparationStartedAt = now();
  const network = preparedNetwork || await prepareRouteNetwork({
    graph,
    stops,
    averageSpeedKph,
    signal,
    yieldControl,
  });
  const {
    calculationGraph,
    routingGraph,
    connectedStops,
    travelTimeMatrix,
  } = network;
  const priorityStops = prioritizeStopOrder(connectedStops, {
    departureTimeMs,
    averageSpeedKph,
    travelTimeMatrix,
  });
  let plannedStops = priorityStops;
  let orderInfo = {
    strategy: "priority",
    iterations: 0,
    evaluations: 0,
    candidateCount: 1,
  };

  if (orderStrategy === "ils") {
    const optimized = await optimizeStopOrderIls({
      stops: connectedStops,
      initialOrder: priorityStops,
      departureTimeMs,
      averageSpeedKph,
      travelTimeMatrix,
      returnToStart,
      budgetMs: orderBudgetMs,
      signal,
      yieldControl,
    });
    plannedStops = optimized.stops;
    orderInfo = { strategy: "ils", ...optimized };
    delete orderInfo.stops;
  }

  return {
    calculationGraph,
    routingGraph,
    plannedStops,
    travelTimeMatrix,
    returnToStart,
    orderInfo,
    preparationTimeMs: now() - preparationStartedAt,
    networkPreparationTimeMs: network.preparationTimeMs || 0,
  };
}

export async function runRouteConfiguration({
  graph,
  stops,
  configuration,
  departureTimeMs = Date.now(),
  averageSpeedKph = 40,
  h3 = null,
  signal = null,
  yieldControl = null,
  onExplore = null,
  collectTrace = true,
  prepared = null,
  orderStrategy = "priority",
  orderBudgetMs = 500,
  returnToStart = false,
}) {
  throwIfCancelled(signal);
  orderStrategy = configuration?.orderStrategy || orderStrategy;
  orderBudgetMs = Number(configuration?.orderBudgetMs) || orderBudgetMs;
  const comparison = prepared || await prepareRouteComparison({
    graph,
    stops,
    departureTimeMs,
    averageSpeedKph,
    orderStrategy,
    orderBudgetMs,
    returnToStart,
    signal,
    yieldControl,
  });
  const { calculationGraph, routingGraph, plannedStops } = comparison;
  const routeStops = comparison.returnToStart && plannedStops.length > 1
    ? [...plannedStops, createReturnStop(plannedStops[0])]
    : plannedStops;

  const trace = [];
  let explorationCount = 0;
  const corridorCells = new Set();
  const orderedStops = [routeStops[0]];
  const remainingStops = routeStops.slice(1);
  const pathResults = [];
  let maxBufferK = 0;
  let legIndex = 0;
  let attemptIndex = 0;

  while (remainingStops.length) {
    throwIfCancelled(signal);
    const current = orderedStops.at(-1);
    const target = remainingStops[0];
    let nodeIds = null;
    let foundInCorridor = false;

    const report = (event, bufferK = null) => {
      explorationCount += 1;
      if (!collectTrace && !onExplore) return;
      const normalized = {
        from: event.from ?? event.de,
        to: event.to ?? event.para,
        direction: event.direction || "forward",
        legIndex,
        attemptIndex,
        bufferK,
      };
      if (collectTrace) trace.push(normalized);
      onExplore?.(normalized);
    };

    if (configuration.useH3 && h3) {
      const startNode = routingGraph.nodes.get(current.nodeId);
      const targetNode = routingGraph.nodes.get(target.nodeId);

      if (startNode && targetNode) {
        const resolution = Number(configuration.h3Resolution) || 9;
        const startCell = h3.latLngToCell(
          Number(startNode.latitude), Number(startNode.longitude), resolution,
        );
        const goalCell = h3.latLngToCell(
          Number(targetNode.latitude), Number(targetNode.longitude), resolution,
        );
        const baseLine = getBaseCorridor(startCell, goalCell, resolution, h3);
        let bufferK = 0;
        let previousCellCount = 0;

        while (true) {
          throwIfCancelled(signal);
          attemptIndex += 1;
          const allowedCells = expandCorridor(baseLine, bufferK, h3);
          if (allowedCells.size === previousCellCount && bufferK > 0) break;
          previousCellCount = allowedCells.size;
          allowedCells.forEach((cell) => corridorCells.add(cell));

          const corridorGraph = filterGraphByCorridor(
            calculationGraph,
            allowedCells,
            new Set(),
            resolution,
            current.nodeId,
            target.nodeId,
            h3,
          );
          const corridorRoutingGraph = buildRoutingGraph(corridorGraph, {
            fallbackSpeedKph: averageSpeedKph,
          });
          nodeIds = await calculatePath({
            configuration,
            graph: corridorGraph,
            routingGraph: corridorRoutingGraph,
            start: current.nodeId,
            target: target.nodeId,
            averageSpeedKph,
            signal,
            yieldControl,
            onExplore: (event) => report(event, bufferK),
          });

          if (nodeIds?.at(-1) === target.nodeId) {
            foundInCorridor = true;
            maxBufferK = Math.max(maxBufferK, bufferK);
            break;
          }

          if (bufferK === 0) bufferK = 1;
          else if (bufferK < 4) bufferK += 1;
          else if (bufferK < 10) bufferK += 2;
          else bufferK += Math.max(3, Math.floor(bufferK * 0.3));

          if (corridorGraph.nodes.length >= calculationGraph.nodes.length || bufferK > 200) break;
        }
      }
    }

    if (!configuration.useH3 || !h3 || !foundInCorridor || nodeIds?.at(-1) !== target.nodeId) {
      attemptIndex += 1;
      nodeIds = await calculatePath({
        configuration,
        graph: calculationGraph,
        routingGraph,
        start: current.nodeId,
        target: target.nodeId,
        averageSpeedKph,
        signal,
        yieldControl,
        onExplore: (event) => report(event),
      });
    }

    if (!nodeIds || nodeIds.at(-1) !== target.nodeId) {
      const result = assembleMultiStopRoute([current, target], [null]);
      return {
        result,
        stops: plannedStops,
        trace,
        explorationCount,
        corridorCells: collectTrace ? [...corridorCells] : [],
        h3Info: configuration.useH3
          ? { bufferK: maxBufferK, cellCount: corridorCells.size, resolution: configuration.h3Resolution }
          : null,
        deadlineInfo: emptyDeadlineInfo(),
        planningInfo: comparison.orderInfo,
      };
    }

    const encounteredStops = findStopsOnPath(nodeIds, remainingStops, target.type);
    let previousNodeIndex = 0;
    for (const stop of encounteredStops) {
      const nodeIndex = nodeIds.indexOf(stop.nodeId, previousNodeIndex);
      if (nodeIndex < 0) continue;
      pathResults.push(buildPathResult(
        routingGraph,
        nodeIds.slice(previousNodeIndex, nodeIndex + 1),
      ));
      orderedStops.push(stop);
      remainingStops.splice(remainingStops.indexOf(stop), 1);
      previousNodeIndex = nodeIndex;
    }

    legIndex += 1;
    if (yieldControl) await yieldControl();
  }

  const result = assembleMultiStopRoute(orderedStops, pathResults);
  const h3Info = configuration.useH3
    ? {
        bufferK: maxBufferK,
        cellCount: corridorCells.size,
        resolution: Number(configuration.h3Resolution) || 9,
      }
    : null;
  if (!result.error) result.h3Info = h3Info;
  if (!result.error) {
    result.returnToStart = comparison.returnToStart;
    result.planningInfo = comparison.orderInfo;
  }

  return {
    result,
    stops: orderedStops.filter((stop) => stop.type !== "return"),
    trace,
    explorationCount,
    corridorCells: collectTrace ? [...corridorCells] : [],
    h3Info,
    deadlineInfo: evaluateDeadlines(result, departureTimeMs),
    planningInfo: comparison.orderInfo,
    preparationTimeMs: comparison.preparationTimeMs,
  };
}

async function calculatePath({
  configuration,
  graph,
  routingGraph,
  start,
  target,
  averageSpeedKph,
  signal,
  yieldControl,
  onExplore,
}) {
  throwIfCancelled(signal);
  const common = {
    grafo: graph,
    inicio: start,
    destino: target,
    fallbackSpeedKph: averageSpeedKph,
    signal,
    yieldControl,
    yieldEvery: SEARCH_BATCH_SIZE,
  };

  if (configuration.modelType === "bidirectional") {
    if (configuration.algorithm === "astar") {
      return bidirectionalAStar({ ...common, cost: "time", onExplore });
    }
    if (configuration.algorithm === "dijkstra") {
      return bidirectionalDijkstra({ ...common, cost: "time", onExplore });
    }
    if (configuration.algorithm === "dfs") {
      return bidirectionalDfs({ ...common, onExplore });
    }
    if (configuration.algorithm === "greedy") {
      return bidirectionalGreedyBestFirst({ ...common, cost: "time", onExplore });
    }
    if (configuration.algorithm === "beam") {
      return bidirectionalBeamSearch({ ...common, cost: "time", onExplore });
    }
    return bidirectionalBfs({ ...common, onExplore });
  }

  if (configuration.algorithm === "astar") {
    return aStarWithProgress({
      ...common,
      cost: "time",
      onExplore: (event) => onExplore?.({ ...event, direction: "forward" }),
    });
  }
  if (configuration.algorithm === "dijkstra") {
    return dijkstra({
      ...common,
      cost: "time",
      onExplore: (event) => onExplore?.({ ...event, direction: "forward" }),
    });
  }
  if (configuration.algorithm === "dfs") {
    return dfs({
      ...common,
      onExplore: (event) => onExplore?.({ ...event, direction: "forward" }),
    });
  }
  if (configuration.algorithm === "greedy") {
    return greedyBestFirst({
      ...common,
      cost: "time",
      onExplore: (event) => onExplore?.({ ...event, direction: "forward" }),
    });
  }
  if (configuration.algorithm === "beam") {
    return beamSearch({
      ...common,
      cost: "time",
      onExplore: (event) => onExplore?.({ ...event, direction: "forward" }),
    });
  }

  const predecessors = buildBfsPredecessors(graph, start, target);
  const markers = new Map();
  for (const [node, predecessor] of predecessors) {
    markers.set(node, {
      setStyle: () => {
        throwIfCancelled(signal);
        onExplore?.({ de: predecessor, para: node, direction: "forward" });
      },
    });
  }
  const path = await bfs({
    ...common,
    markers,
    velocidade: 0,
  });

  throwIfCancelled(signal);
  return path;
}

function buildBfsPredecessors(graph, start, target) {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    if (adjacency.has(edge.from) && adjacency.has(edge.to)) {
      adjacency.get(edge.from).push(edge.to);
    }
  }

  const predecessors = new Map();
  const visited = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (current === target) break;
    for (const neighbor of adjacency.get(current) || []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      predecessors.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  return predecessors;
}

function evaluateDeadlines(result, departureTimeMs) {
  if (!result || result.error) return emptyDeadlineInfo();
  let elapsedSeconds = 0;
  let lateCount = 0;
  let onTimeCount = 0;
  let totalLatenessSeconds = 0;
  let minSlackSeconds = Number.POSITIVE_INFINITY;
  const details = [];

  for (const segment of result.segments) {
    elapsedSeconds += segment.travelTimeSeconds;
    if (segment.to.type !== "delivery") continue;
    const deadline = Date.parse(segment.to.deadline);
    const arrivalTimeMs = departureTimeMs + elapsedSeconds * 1000;
    const slackSeconds = Number.isFinite(deadline)
      ? (deadline - arrivalTimeMs) / 1000
      : Number.POSITIVE_INFINITY;
    minSlackSeconds = Math.min(minSlackSeconds, slackSeconds);
    if (slackSeconds < 0) {
      lateCount += 1;
      totalLatenessSeconds += -slackSeconds;
    } else {
      onTimeCount += 1;
    }
    details.push({
      stopId: segment.to.id,
      arrivalTimeMs,
      slackSeconds,
      late: slackSeconds < 0,
    });
  }
  return {
    lateCount,
    onTimeCount,
    totalLatenessSeconds,
    minSlackSeconds: Number.isFinite(minSlackSeconds) ? minSlackSeconds : null,
    details,
  };
}

function emptyDeadlineInfo() {
  return {
    lateCount: 0,
    onTimeCount: 0,
    totalLatenessSeconds: 0,
    minSlackSeconds: null,
    details: [],
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

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Comparação cancelada.");
  error.name = "AbortError";
  throw error;
}
