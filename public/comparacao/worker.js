import { runRouteConfiguration } from "/algorithms/routeComparison.js";
import * as h3 from "/vendor/h3-js/h3-js.es.js";

self.h3 = h3;
globalThis.h3 = h3;

let cachedGraph = null;

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};

  if (type === "INIT") {
    cachedGraph = payload?.graph || null;
    self.postMessage({ type: "INIT_OK" });
    return;
  }

  if (type === "RUN") {
    const {
      taskId,
      graph,
      stops,
      configuration,
      departureTimeMs,
      averageSpeedKph,
    } = payload;

    const targetGraph = graph || cachedGraph;
    const startedAt = performance.now();

    try {
      const outcome = await runRouteConfiguration({
        graph: targetGraph,
        stops,
        configuration,
        departureTimeMs,
        averageSpeedKph,
        h3,
      });

      const computationTimeMs = performance.now() - startedAt;

      self.postMessage({
        type: "SUCCESS",
        taskId,
        outcome,
        computationTimeMs,
      });
    } catch (error) {
      const computationTimeMs = performance.now() - startedAt;
      self.postMessage({
        type: "ERROR",
        taskId,
        error: error.message || String(error),
        computationTimeMs,
      });
    }
  }
};
