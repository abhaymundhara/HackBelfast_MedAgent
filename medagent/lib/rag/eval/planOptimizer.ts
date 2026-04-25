import { RetrievalExecutionRecord } from "@/lib/agent/state";

export type PlanProfile = "precision_first" | "balanced" | "recall_first";

export type PlanOptimizerInput = {
  zeroResultPlanCount: number;
  heavilyPrunedPlanCount: number;
  retrievalBreadthScore: number;
  cacheFreshHitRate: number;
  staleServeRate: number;
  rerankUpliftHistory: number;
  targetFieldSparsity: number;
  noteTypeSparsity: number;
};

export type PlanRecommendation = {
  profile: PlanProfile;
  modeOrder: Array<"balanced" | "broad" | "exact">;
  topK: number;
  evaluationBucket: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

export function recommendPlanProfile(input: PlanOptimizerInput): PlanProfile {
  const recallPressure =
    input.zeroResultPlanCount * 0.5 +
    input.targetFieldSparsity * 0.3 +
    input.noteTypeSparsity * 0.2;

  const precisionPressure =
    input.heavilyPrunedPlanCount * 0.45 +
    (1 - input.retrievalBreadthScore) * 0.25 +
    Math.max(0, -input.rerankUpliftHistory) * 0.3;

  if (recallPressure >= 1.1 && recallPressure > precisionPressure) {
    return "recall_first";
  }

  if (precisionPressure >= 0.9 && precisionPressure >= recallPressure) {
    return "precision_first";
  }

  return "balanced";
}

export function recommendTopK(profile: PlanProfile, input: PlanOptimizerInput) {
  const base =
    profile === "recall_first" ? 8 : profile === "precision_first" ? 4 : 6;
  const upliftAdjust = input.rerankUpliftHistory > 0.08 ? -1 : 0;
  const sparseAdjust = input.targetFieldSparsity > 0.7 ? 2 : 0;
  const staleAdjust = input.staleServeRate > 0.4 ? -1 : 0;

  return clamp(base + upliftAdjust + sparseAdjust + staleAdjust, 3, 12);
}

export function recommendModeOrder(profile: PlanProfile) {
  if (profile === "recall_first") {
    return ["balanced", "broad", "exact"] as const;
  }

  if (profile === "precision_first") {
    return ["balanced", "exact"] as const;
  }

  return ["balanced", "broad", "exact"] as const;
}

export function summarizeTelemetryForOptimizer(
  executionLog: RetrievalExecutionRecord[],
  fieldsAllowedCount: number,
  noteTypeHintCount: number,
) {
  const zeroResultPlanCount = executionLog.filter((row) => row.zeroResult).length;
  const heavilyPrunedPlanCount = executionLog.filter(
    (row) =>
      row.countBeforeTargeting > 0 &&
      row.countAfterTargeting <= Math.floor(row.countBeforeTargeting * 0.4),
  ).length;

  const total = executionLog.length || 1;
  const cacheFreshHitRate = safeRate(
    executionLog.filter((row) => row.cacheStatus === "fresh_hit").length,
    total,
  );
  const staleServeRate = safeRate(
    executionLog.filter((row) => row.cacheStatus === "stale_hit").length,
    total,
  );

  const rerankRows = executionLog.filter(
    (row) => typeof row.semanticTopScore === "number" && typeof row.fusionTopScore === "number",
  );
  const rerankUpliftHistory = rerankRows.length
    ? rerankRows.reduce(
        (sum, row) => sum + ((row.fusionTopScore ?? 0) - (row.semanticTopScore ?? 0)),
        0,
      ) / rerankRows.length
    : 0;

  const retrievalBreadthScore = 1 - safeRate(zeroResultPlanCount, total);
  const targetFieldSparsity = fieldsAllowedCount ? 1 / fieldsAllowedCount : 1;
  const noteTypeSparsity = noteTypeHintCount ? 1 / noteTypeHintCount : 1;

  return {
    zeroResultPlanCount,
    heavilyPrunedPlanCount,
    retrievalBreadthScore,
    cacheFreshHitRate,
    staleServeRate,
    rerankUpliftHistory,
    targetFieldSparsity,
    noteTypeSparsity,
  } satisfies PlanOptimizerInput;
}

export function recommendPlanProfileFromTelemetry(input: {
  executionLog: RetrievalExecutionRecord[];
  fieldsAllowedCount: number;
  noteTypeHintCount: number;
}): PlanRecommendation {
  const metrics = summarizeTelemetryForOptimizer(
    input.executionLog,
    input.fieldsAllowedCount,
    input.noteTypeHintCount,
  );

  const profile = recommendPlanProfile(metrics);
  const modeOrder = [...recommendModeOrder(profile)];
  const topK = recommendTopK(profile, metrics);
  const evaluationBucket = resolveEvaluationBucket(profile);

  return {
    profile,
    modeOrder,
    topK,
    evaluationBucket,
  };
}

export function resolveEvaluationBucket(profile: PlanProfile) {
  return profile === "recall_first"
    ? "recall_stressed"
    : profile === "precision_first"
      ? "precision_stressed"
      : "balanced";
}
