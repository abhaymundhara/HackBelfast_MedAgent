import fs from "fs";
import path from "path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  appendRetrievalMetricsSnapshot,
  buildRetrievalCostDashboard,
  generateAndSaveRetrievalCostDashboard,
  loadRecentRetrievalMetrics,
  saveRegressionReport,
} from "@/lib/rag/observability/metricsStore";

const TMP = path.join(
  process.cwd(),
  "data",
  "retrieval-observability",
  "test-metrics.jsonl",
);

describe("metrics store", () => {
  beforeEach(() => {
    if (fs.existsSync(TMP)) {
      fs.rmSync(TMP, { force: true });
    }
  });

  it("appends and loads snapshots", () => {
    appendRetrievalMetricsSnapshot(
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
      TMP,
    );

    const loaded = loadRecentRetrievalMetrics({ inputPath: TMP, limit: 10 });
    expect(loaded.length).toBe(1);
    expect(loaded[0].requestId).toBe("r1");
  });

  it("ignores malformed lines safely", () => {
    fs.mkdirSync(path.dirname(TMP), { recursive: true });
    fs.writeFileSync(TMP, "{bad json\n\n");

    const loaded = loadRecentRetrievalMetrics({ inputPath: TMP, limit: 10 });
    expect(loaded.length).toBe(0);
  });

  it("saves regression report", () => {
    const output = saveRegressionReport({
      report: {
        status: "warn",
        reasons: ["p50 latency increased"],
      },
    });

    expect(fs.existsSync(output)).toBe(true);
  });

  it("builds healthy retrieval cost dashboard", () => {
    const snapshots = loadRecentRetrievalMetrics({ inputPath: TMP, limit: 10 });
    const dashboardEmpty = buildRetrievalCostDashboard({ snapshots });
    expect(dashboardEmpty.status).toBe("warn");

    appendRetrievalMetricsSnapshot(
      {
        requestId: "r2",
        timestamp: new Date().toISOString(),
        retryCount: 0,
        planCount: 1,
        cacheStateSummary: {
          freshHitCount: 1,
          staleServedCount: 0,
          missCount: 0,
          backgroundRefreshQueued: false,
        },
        indexFreshnessSummary: {
          indexStatus: "ready",
          indexFreshness: "fresh",
        },
        totalPlannerLatencyMs: 90,
        totalLexicalLatencyMs: 15,
        totalRerankLatencyMs: 8,
        totalCacheLookupLatencyMs: 3,
        totalIndexEnsureLatencyMs: 6,
        totalCandidatesBeforeDedupe: 2,
        totalUniqueCandidates: 2,
        totalAuthorizedCandidates: 2,
        totalAcceptedEvidence: 2,
        ragUsed: true,
        rerankApplied: true,
        zeroResultPlanCount: 0,
        heavilyPrunedPlanCount: 0,
        plansWithRagHits: 1,
        latencyClassification: "healthy",
        latencyBreaches: [],
        estimatedRequestCostUsd: 0.003,
        costBudgetUsd: 0.01,
        costBudgetStatus: "healthy",
        costBreakdownUsd: {
          embedUsd: 0.001,
          rerankUsd: 0.001,
          judgeUsd: 0,
          chainWriteUsd: 0.001,
        },
      },
      TMP,
    );

    const loaded = loadRecentRetrievalMetrics({ inputPath: TMP, limit: 10 });
    const dashboard = buildRetrievalCostDashboard({ snapshots: loaded });
    expect(dashboard.status).toBe("healthy");
    expect(dashboard.costTelemetryCoverage).toBe(1);
  });

  it("generates and saves retrieval cost dashboard", () => {
    const output = generateAndSaveRetrievalCostDashboard({
      inputPath: TMP,
      outputPath: path.join(
        process.cwd(),
        "data",
        "retrieval-observability",
        "alerts",
        "test-cost-dashboard.json",
      ),
      limit: 20,
    });

    expect(fs.existsSync(output.outputPath)).toBe(true);
    expect(output.dashboard.sampleSize).toBeGreaterThanOrEqual(0);
  });
});
