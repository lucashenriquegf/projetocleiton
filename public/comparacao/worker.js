import {
  prepareRouteComparison,
  prepareRouteNetwork,
  runRouteConfiguration,
} from "/algorithms/routeComparison.js";
import * as h3 from "/vendor/h3-js/h3-js.es.js";

self.h3 = h3;
globalThis.h3 = h3;

let cachedNetwork = null;

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};

  if (type === "INIT") {
    try {
      cachedNetwork = await prepareRouteNetwork({
        graph: payload?.graph,
        stops: payload?.stops || [],
        averageSpeedKph: payload?.averageSpeedKph,
      });
      self.postMessage({
        type: "INIT_OK",
        preparationTimeMs: cachedNetwork.preparationTimeMs,
      });
    } catch (error) {
      cachedNetwork = null;
      self.postMessage({ type: "INIT_ERROR", error: error.message || String(error) });
    }
    return;
  }

  if (type === "RUN") {
    const {
      taskId,
      configuration,
      departureTimeMs,
      averageSpeedKph,
      collectTrace = false,
    } = payload;

    const startedAt = performance.now();

    try {
      if (!cachedNetwork) throw new Error("O grafo de comparação não foi preparado.");
      const prepared = await prepareRouteComparison({
        preparedNetwork: cachedNetwork,
        departureTimeMs,
        averageSpeedKph,
        orderStrategy: configuration.orderStrategy,
        orderBudgetMs: configuration.orderBudgetMs,
        returnToStart: payload.returnToStart,
      });
      const outcome = await runRouteConfiguration({
        prepared,
        configuration,
        departureTimeMs,
        averageSpeedKph,
        h3,
        collectTrace,
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
