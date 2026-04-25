import { describe, expect, it } from "vitest";

import {
  recommendModeOrder,
  recommendPlanProfile,
  recommendPlanProfileFromTelemetry,
  recommendTopK,
  summarizeTelemetryForOptimizer,
} from "@/lib/rag/eval/planOptimizer";
import { RetrievalExecutionRecord } from "@/lib/agent/state";

function row(partial: Partial<RetrievalExecutionRecord>): RetrievalExecutionRecord {
  return {
    queryPlanIndex: 0,
    executedQuery: "q",
    mode: "balanced",
    targetFields: [],
    targetNoteTypes: [],
    topK: 5,
    ragAttempted: true,
    ragReturnedCount: 2,
    countBeforeTargeting: 10,
    countAfterTargeting: 2,
    baselineContributedCount: 0,
    ragContributedCount: 2,
    zeroResult: false,
    ...partial,
  };
}

describe("plan optimizer", () => {
  it("chooses recall_first when recall pressure is high", () => {
    const highRecallPressureTelemetry = {
      zeroResultPlanCount: 4,
      heavilyPrunedPlanCount: 0,
      retrievalBreadthScore: 0.2,
      cacheFreshHitRate: 0.1,
      staleServeRate: 0.2,
      rerankUpliftHistory: 0.01,
      targetFieldSparsity: 0.9,
      noteTypeSparsity: 0.9,
    };
    const profile = recommendPlanProfile(highRecallPressureTelemetry);

    expect(profile).toBe("recall_first");
    expect(recommendModeOrder(profile)).toEqual(["balanced", "broad", "exact"]);
    expect(
      recommendTopK(profile, highRecallPressureTelemetry),
    ).toBeGreaterThanOrEqual(8);
  });

  it("chooses precision_first when pruning/noise pressure is high", () => {
    const profile = recommendPlanProfile({
      zeroResultPlanCount: 0,
      heavilyPrunedPlanCount: 5,
      retrievalBreadthScore: 0.8,
      cacheFreshHitRate: 0.5,
      staleServeRate: 0.1,
      rerankUpliftHistory: -0.2,
      targetFieldSparsity: 0.2,
      noteTypeSparsity: 0.2,
    });

    expect(profile).toBe("precision_first");
    expect(recommendModeOrder(profile)).toEqual(["balanced", "exact"]);
  });

  it("produces deterministic recommendation from telemetry", () => {
    const log = [
      row({ zeroResult: true, cacheStatus: "miss", semanticTopScore: 0.2, fusionTopScore: 0.3 }),
      row({ zeroResult: false, cacheStatus: "stale_hit", semanticTopScore: 0.1, fusionTopScore: 0.2 }),
    ];

    const summary = summarizeTelemetryForOptimizer(log, 3, 2);
    const first = recommendPlanProfileFromTelemetry({
      executionLog: log,
      fieldsAllowedCount: 3,
      noteTypeHintCount: 2,
    });
    const second = recommendPlanProfileFromTelemetry({
      executionLog: log,
      fieldsAllowedCount: 3,
      noteTypeHintCount: 2,
    });

    expect(summary.zeroResultPlanCount).toBe(1);
    expect(first).toEqual(second);
  });
});
