import { aStarWithProgress } from "./AStar.js";
import { bfs } from "./BSF.js";
import { dfs } from "./DFS.js";
import { dijkstra } from "./Dijkstra.js";
import { bidirectionalAStar } from "./BidirectionalAStar.js";
import { bidirectionalBfs } from "./BidirectionalBFS.js";
import { bidirectionalDfs } from "./BidirectionalDFS.js";
import { bidirectionalDijkstra } from "./BidirectionalDijkstra.js";
import {
  assembleMultiStopRoute,
  buildPathResult,
  buildRoutingGraph,
  connectStopsToGraph,
  findStopsOnPath,
  prioritizeStopOrder,
} from "./routing.mjs";
import {
  expandCorridor,
  filterGraphByCorridor,
  getBaseCorridor,
} from "./h3_corridor.js";

const SEARCH_BATCH_SIZE = 128;

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
}) {
  throwIfCancelled(signal);
  const connected = connectStopsToGraph(graph, stops, { fallbackSpeedKph: averageSpeedKph });
  const calculationGraph = connected.graph;
  const routingGraph = buildRoutingGraph(calculationGraph, {
    fallbackSpeedKph: averageSpeedKph,
  });
  const plannedStops = prioritizeStopOrder(connected.stops, {
    departureTimeMs,
    averageSpeedKph,
  });

  const trace = [];
  const corridorCells = new Set();
  const orderedStops = [plannedStops[0]];
  const remainingStops = plannedStops.slice(1);
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
      const normalized = {
        from: event.from ?? event.de,
        to: event.to ?? event.para,
        direction: event.direction || "forward",
        legIndex,
        attemptIndex,
        bufferK,
      };
      trace.push(normalized);
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
        corridorCells: [...corridorCells],
        h3Info: configuration.useH3
          ? { bufferK: maxBufferK, cellCount: corridorCells.size, resolution: configuration.h3Resolution }
          : null,
        deadlineInfo: { lateCount: 0, onTimeCount: 0 },
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

  return {
    result,
    stops: orderedStops,
    trace,
    corridorCells: [...corridorCells],
    h3Info,
    deadlineInfo: evaluateDeadlines(result, departureTimeMs),
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
  if (!result || result.error) return { lateCount: 0, onTimeCount: 0 };
  let elapsedSeconds = 0;
  let lateCount = 0;
  let onTimeCount = 0;

  for (const segment of result.segments) {
    elapsedSeconds += segment.travelTimeSeconds;
    if (segment.to.type !== "delivery") continue;
    const deadline = Date.parse(segment.to.deadline);
    if (Number.isFinite(deadline) && departureTimeMs + elapsedSeconds * 1000 > deadline) {
      lateCount += 1;
    } else {
      onTimeCount += 1;
    }
  }
  return { lateCount, onTimeCount };
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Comparação cancelada.");
  error.name = "AbortError";
  throw error;
}
