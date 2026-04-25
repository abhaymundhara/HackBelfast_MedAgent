import { z } from "zod";

import { summarizeLatencyMs } from "@/lib/rag/eval/retrievalMetrics";
import { RetrievalObservabilitySnapshotSchema } from "@/lib/rag/observability/retrievalObservability";

export const RetrievalRegressionSnapshotSchema = z.object({
  recallAtK: z.number().min(0).max(1).optional(),
  mrr: z.number().min(0).max(1).optional(),
  ndcg: z.number().min(0).max(1).optional(),
  zeroHitQueryCount: z.number().int().min(0).optional(),
  requestCount: z.number().int().min(0).optional(),
  avgLatencyMs: z.number().min(0).optional(),
  p50LatencyMs: z.number().min(0).optional(),
  p95LatencyMs: z.number().min(0).optional(),
  degradationRate: z.number().min(0).max(1).optional(),
  zeroResultRate: z.number().min(0).max(1).optional(),
});

export type RetrievalRegressionSnapshot = z.infer<
  typeof RetrievalRegressionSnapshotSchema
>;

export const RetrievalRegressionSummarySchema = z.object({
  status: z.enum(["pass", "warn", "fail"]),
  reasons: z.array(z.string()),
});

export type RetrievalRegressionSummary = z.infer<
  typeof RetrievalRegressionSummarySchema
>;

function safeRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function percentDelta(current: number, baseline: number) {
  if (baseline === 0) {
    return current === 0 ? 0 : 1;
  }
  return (current - baseline) / baseline;
}

export function summarizeSnapshotsForRegression(
  snapshots: unknown[],
): RetrievalRegressionSnapshot {
  const parsed = snapshots.flatMap((snapshot) => {
    const result = RetrievalObservabilitySnapshotSchema.safeParse(snapshot);
    return result.success ? [result.data] : [];
  });

  const latency = summarizeLatencyMs(parsed.map((snapshot) => snapshot.totalPlannerLatencyMs));

  const degradationRate = safeRate(
    parsed.filter((snapshot) => snapshot.latencyClassification !== "healthy").length,
    parsed.length,
  );

  const zeroResultRate = safeRate(
    parsed.filter((snapshot) => snapshot.zeroResultPlanCount > 0).length,
    parsed.length,
  );

  return {
    requestCount: parsed.length,
    avgLatencyMs: latency.avg,
    p50LatencyMs: latency.p50,
    p95LatencyMs: latency.p95,
    degradationRate,
    zeroResultRate,
  };
}

export function compareRetrievalRegression(input: {
  baseline: RetrievalRegressionSnapshot;
  current: RetrievalRegressionSnapshot;
}): RetrievalRegressionSummary {
  const reasons: string[] = [];
  let status: RetrievalRegressionSummary["status"] = "pass";

  const maybeWarn = (reason: string) => {
    if (status === "pass") status = "warn";
    reasons.push(reason);
  };

  const maybeFail = (reason: string) => {
    status = "fail";
    reasons.push(reason);
  };

  if (
    input.baseline.p50LatencyMs !== undefined &&
    input.current.p50LatencyMs !== undefined
  ) {
    const delta = percentDelta(input.current.p50LatencyMs, input.baseline.p50LatencyMs);
    if (delta > 0.5) maybeFail(`p50 latency regression ${(delta * 100).toFixed(1)}%`);
    else if (delta > 0.2) maybeWarn(`p50 latency increased ${(delta * 100).toFixed(1)}%`);
  }

  if (
    input.baseline.p95LatencyMs !== undefined &&
    input.current.p95LatencyMs !== undefined
  ) {
    const delta = percentDelta(input.current.p95LatencyMs, input.baseline.p95LatencyMs);
    if (delta > 0.6) maybeFail(`p95 latency regression ${(delta * 100).toFixed(1)}%`);
    else if (delta > 0.25) maybeWarn(`p95 latency increased ${(delta * 100).toFixed(1)}%`);
  }

  if (input.baseline.recallAtK !== undefined && input.current.recallAtK !== undefined) {
    const delta = input.current.recallAtK - input.baseline.recallAtK;
    if (delta < -0.08) maybeFail(`recall@k dropped by ${Math.abs(delta).toFixed(3)}`);
    else if (delta < -0.03) maybeWarn(`recall@k dropped by ${Math.abs(delta).toFixed(3)}`);
  }

  if (input.baseline.mrr !== undefined && input.current.mrr !== undefined) {
    const delta = input.current.mrr - input.baseline.mrr;
    if (delta < -0.06) maybeFail(`MRR dropped by ${Math.abs(delta).toFixed(3)}`);
    else if (delta < -0.02) maybeWarn(`MRR dropped by ${Math.abs(delta).toFixed(3)}`);
  }

  if (input.baseline.ndcg !== undefined && input.current.ndcg !== undefined) {
    const delta = input.current.ndcg - input.baseline.ndcg;
    if (delta < -0.06) maybeFail(`nDCG dropped by ${Math.abs(delta).toFixed(3)}`);
    else if (delta < -0.02) maybeWarn(`nDCG dropped by ${Math.abs(delta).toFixed(3)}`);
  }

  if (
    input.baseline.zeroResultRate !== undefined &&
    input.current.zeroResultRate !== undefined
  ) {
    const delta = input.current.zeroResultRate - input.baseline.zeroResultRate;
    if (delta > 0.2) maybeFail(`zero-result rate increased by ${delta.toFixed(3)}`);
    else if (delta > 0.08) maybeWarn(`zero-result rate increased by ${delta.toFixed(3)}`);
  }

  if (
    input.baseline.degradationRate !== undefined &&
    input.current.degradationRate !== undefined
  ) {
    const delta = input.current.degradationRate - input.baseline.degradationRate;
    if (delta > 0.2) maybeFail(`planner degradation rate increased by ${delta.toFixed(3)}`);
    else if (delta > 0.1) maybeWarn(`planner degradation rate increased by ${delta.toFixed(3)}`);
  }

  return RetrievalRegressionSummarySchema.parse({
    status,
    reasons,
  });
}
