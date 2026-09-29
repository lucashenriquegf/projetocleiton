import { evaluateStopSequence } from "./routing.mjs";

const DEFAULT_BUDGET_MS = 500;

export async function optimizeStopOrderIls({
  stops,
  initialOrder = stops,
  departureTimeMs = Date.now(),
  averageSpeedKph = 40,
  travelTimeMatrix = null,
  returnToStart = false,
  budgetMs = DEFAULT_BUDGET_MS,
  maxIterations = 10_000,
  signal = null,
  yieldControl = null,
  yieldEvery = 128,
  seed = sequenceSeed(stops),
} = {}) {
  const startedAt = now();
  const deadline = startedAt + Math.max(0, Number(budgetMs) || DEFAULT_BUDGET_MS);
  const random = createDeterministicRandom(seed);
  const seen = new Set();
  let evaluations = 0;
  let iterations = 0;

  let current = normalizePhaseOrder(initialOrder);
  let currentMetrics = scoreSequence(current);
  let best = [...current];
  let bestMetrics = currentMetrics;
  seen.add(sequenceKey(current));

  while (iterations < maxIterations && now() < deadline) {
    throwIfCancelled(signal);
    const local = await firstImprovement(current, currentMetrics);
    current = local.stops;
    currentMetrics = local.metrics;

    if (compareMetrics(currentMetrics, bestMetrics) < 0) {
      best = [...current];
      bestMetrics = currentMetrics;
    }

    const perturbed = perturbWithinPhase(current, random);
    const key = sequenceKey(perturbed);
    if (!seen.has(key)) {
      seen.add(key);
      const metrics = scoreSequence(perturbed);
      evaluations += 1;
      if (compareMetrics(metrics, currentMetrics) <= 0 || random() < 0.12) {
        current = perturbed;
        currentMetrics = metrics;
      }
    }

    iterations += 1;
    await maybeYield();
  }

  return {
    stops: best,
    metrics: bestMetrics,
    iterations,
    evaluations,
    elapsedMs: now() - startedAt,
    budgetMs: Math.max(0, Number(budgetMs) || DEFAULT_BUDGET_MS),
    candidateCount: seen.size,
  };

  async function firstImprovement(startOrder, startMetrics) {
    let incumbent = [...startOrder];
    let incumbentMetrics = startMetrics;
    const pickupCount = incumbent.filter((stop) => stop.type === "pickup").length;
    const ranges = [
      [0, pickupCount],
      [pickupCount, incumbent.length],
    ];

    let improved = true;
    while (improved && now() < deadline) {
      improved = false;
      for (const [start, end] of ranges) {
        for (let first = start; first < end - 1; first += 1) {
          for (let second = first + 1; second < end; second += 1) {
            throwIfCancelled(signal);
            if (now() >= deadline) return { stops: incumbent, metrics: incumbentMetrics };
            const candidate = reverseRange(incumbent, first, second);
            const key = sequenceKey(candidate);
            if (seen.has(key)) continue;
            seen.add(key);
            const candidateMetrics = scoreSequence(candidate);
            evaluations += 1;
            await maybeYield();

            if (compareMetrics(candidateMetrics, incumbentMetrics) < 0) {
              incumbent = candidate;
              incumbentMetrics = candidateMetrics;
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }

    return { stops: incumbent, metrics: incumbentMetrics };
  }

  function scoreSequence(sequence) {
    return evaluateStopSequence(sequence, {
      departureTimeMs,
      averageSpeedKph,
      travelTimeMatrix,
      returnToStart,
    });
  }

  async function maybeYield() {
    if (!yieldControl || evaluations === 0 || evaluations % Math.max(1, Number(yieldEvery) || 1) !== 0) {
      return;
    }
    await yieldControl();
    throwIfCancelled(signal);
  }
}

function compareMetrics(first, second) {
  const criteria = [
    "lateCount",
    "totalLatenessSeconds",
    "travelTimeSeconds",
  ];
  for (const criterion of criteria) {
    const firstValue = Number(first?.[criterion]);
    const secondValue = Number(second?.[criterion]);
    const safeFirst = Number.isFinite(firstValue) ? firstValue : Number.POSITIVE_INFINITY;
    const safeSecond = Number.isFinite(secondValue) ? secondValue : Number.POSITIVE_INFINITY;
    if (safeFirst < safeSecond) return -1;
    if (safeFirst > safeSecond) return 1;
  }
  return 0;
}

function normalizePhaseOrder(stops) {
  return [
    ...stops.filter((stop) => stop.type === "pickup"),
    ...stops.filter((stop) => stop.type === "delivery"),
  ];
}

function perturbWithinPhase(stops, random) {
  const pickupCount = stops.filter((stop) => stop.type === "pickup").length;
  const ranges = [
    [0, pickupCount],
    [pickupCount, stops.length],
  ].filter(([start, end]) => end - start > 1);
  if (!ranges.length) return [...stops];

  const [start, end] = ranges[Math.floor(random() * ranges.length)];
  const first = start + Math.floor(random() * (end - start));
  let second = start + Math.floor(random() * (end - start));
  if (second === first) second = start + ((second - start + 1) % (end - start));
  const candidate = [...stops];
  [candidate[first], candidate[second]] = [candidate[second], candidate[first]];
  return candidate;
}

function reverseRange(stops, first, second) {
  return [
    ...stops.slice(0, first),
    ...stops.slice(first, second + 1).reverse(),
    ...stops.slice(second + 1),
  ];
}

function sequenceKey(stops) {
  return stops.map((stop) => stop.id).join("\u001f");
}

function sequenceSeed(stops = []) {
  let hash = 2166136261;
  for (const character of sequenceKey(stops)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createDeterministicRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Cálculo cancelado.");
  error.name = "AbortError";
  throw error;
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}
