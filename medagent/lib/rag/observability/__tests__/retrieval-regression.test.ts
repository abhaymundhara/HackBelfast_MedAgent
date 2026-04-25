import { describe, expect, it } from "vitest";

import {
  compareRetrievalRegression,
  summarizeSnapshotsForRegression,
} from "@/lib/rag/observability/retrievalRegression";

describe("retrieval regression", () => {
  it("fails on major regressions", () => {
    const baseline = {
      recallAtK: 0.7,
      mrr: 0.6,
      ndcg: 0.65,
      p50LatencyMs: 100,
      p95LatencyMs: 200,
      degradationRate: 0.1,
      zeroResultRate: 0.1,
    };
    const current = {
      recallAtK: 0.55,
      mrr: 0.45,
      ndcg: 0.5,
      p50LatencyMs: 180,
      p95LatencyMs: 360,
      degradationRate: 0.35,
      zeroResultRate: 0.35,
    };

    const result = compareRetrievalRegression({ baseline, current });
    expect(result.status).toBe("fail");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("warns on mild regressions", () => {
    const result = compareRetrievalRegression({
      baseline: { recallAtK: 0.7, p50LatencyMs: 100, p95LatencyMs: 200 },
      current: { recallAtK: 0.67, p50LatencyMs: 122, p95LatencyMs: 240 },
    });

    expect(result.status).toBe("warn");
  });

  it("passes when stable", () => {
    const result = compareRetrievalRegression({
      baseline: { recallAtK: 0.7, mrr: 0.6, p50LatencyMs: 100 },
      current: { recallAtK: 0.71, mrr: 0.62, p50LatencyMs: 102 },
    });

    expect(result.status).toBe("pass");
  });

  it("summarizes malformed snapshots safely", () => {
    const summary = summarizeSnapshotsForRegression([
      { bad: true },
      {
        requestId: "r1",
        timestamp: new Date().toISOString(),
        retryCount: 0,
        planCount: 1,
        cacheStateSummary: {
          freshHitCount: 0,
          staleServedCount: 0,
          missCount: 1,
          backgroundRefreshQueued: false,
        },
        indexFreshnessSummary: {
          indexStatus: "ready",
          indexFreshness: "fresh",
        },
        totalPlannerLatencyMs: 100,
        totalLexicalLatencyMs: 20,
        totalRerankLatencyMs: 10,
        totalCacheLookupLatencyMs: 5,
        totalIndexEnsureLatencyMs: 10,
        totalCandidatesBeforeDedupe: 2,
        totalUniqueCandidates: 2,
        totalAuthorizedCandidates: 2,
        totalAcceptedEvidence: 1,
        ragUsed: true,
        rerankApplied: true,
        zeroResultPlanCount: 0,
        heavilyPrunedPlanCount: 0,
        plansWithRagHits: 1,
        latencyClassification: "healthy",
        latencyBreaches: [],
        estimatedRequestCostUsd: 0.002,
        costBudgetUsd: 0.01,
        costBudgetStatus: "healthy",
        costBreakdownUsd: {
          embedUsd: 0.001,
          rerankUsd: 0.0005,
          judgeUsd: 0,
          chainWriteUsd: 0.0005,
        },
      },
    ]);

    expect(summary.requestCount).toBe(1);
    expect(summary.avgLatencyMs).toBe(100);
  });
});
