import { describe, expect, it } from "vitest";

import {
  CanonicalEvidenceItem,
  RetrievalExecutionRecord,
} from "@/lib/agent/state";
import {
  computeBackgroundRefreshRate,
  computeCacheHitRate,
  computeFieldCoverageScore,
  computeLexicalOnlyVsRerankedDelta,
  computeMrr,
  computeNdcgLite,
  computeNoteTypeCoverageScore,
  computePrecisionAtK,
  computeRecallAtK,
  computeRerankUpliftDelta,
  computeStaleCacheServeRate,
} from "@/lib/rag/eval/retrievalMetrics";

function item(
  id: string,
  fieldKey: string,
  noteType: string,
): CanonicalEvidenceItem {
  return {
    id,
    patientHash: "p1",
    content: id,
    authorization: {
      fieldKey,
      allowedForTiers: [1, 2, 3],
      sensitivityClass: "standard",
      requiresExplicitApproval: false,
    },
    sourceType: "structured_ips",
    noteType,
    extractionMode: "structured",
    sensitivityTags: [],
    clinicalTags: [],
    recencyBucket: "historical",
    language: "en",
    provenance: { timestamp: new Date().toISOString() },
  };
}

function exec(
  partial: Partial<RetrievalExecutionRecord>,
): RetrievalExecutionRecord {
  return {
    ...partial,
    queryPlanIndex: partial.queryPlanIndex ?? 0,
    executedQuery: partial.executedQuery ?? "q",
    mode: partial.mode ?? "balanced",
    targetFields: partial.targetFields ?? [],
    targetNoteTypes: partial.targetNoteTypes ?? [],
    topK: partial.topK ?? 5,
    ragAttempted: partial.ragAttempted ?? true,
    ragReturnedCount: partial.ragReturnedCount ?? 2,
    countBeforeTargeting: partial.countBeforeTargeting ?? 2,
    countAfterTargeting: partial.countAfterTargeting ?? 2,
    baselineContributedCount: partial.baselineContributedCount ?? 0,
    ragContributedCount: partial.ragContributedCount ?? 2,
    zeroResult: partial.zeroResult ?? false,
  };
}

describe("retrieval metrics", () => {
  it("scores perfect recall and precision", () => {
    const ranked = [
      item("e1", "allergies", "allergy_record"),
      item("e2", "medications", "medication_record"),
    ];
    const expected = ["e1", "e2"];

    expect(
      computeRecallAtK({
        expectedEvidenceIds: expected,
        rankedItems: ranked,
        k: 2,
      }),
    ).toBe(1);
    expect(
      computePrecisionAtK({
        expectedEvidenceIds: expected,
        rankedItems: ranked,
        k: 2,
      }),
    ).toBe(1);
    expect(
      computeMrr({ expectedEvidenceIds: expected, rankedItems: ranked }),
    ).toBe(1);
    expect(
      computeNdcgLite({
        expectedEvidenceIds: expected,
        rankedItems: ranked,
        k: 2,
      }),
    ).toBe(1);
  });

  it("scores partial recall", () => {
    const ranked = [
      item("e1", "allergies", "allergy_record"),
      item("x", "alerts", "medical_alert"),
    ];
    const expected = ["e1", "e2"];

    expect(
      computeRecallAtK({
        expectedEvidenceIds: expected,
        rankedItems: ranked,
        k: 2,
      }),
    ).toBe(0.5);
    expect(
      computePrecisionAtK({
        expectedEvidenceIds: expected,
        rankedItems: ranked,
        k: 2,
      }),
    ).toBe(0.5);
  });

  it("computes coverage scores", () => {
    const ranked = [
      item("e1", "allergies", "allergy_record"),
      item("e2", "medications", "medication_record"),
    ];
    expect(
      computeFieldCoverageScore({
        expectedFieldKeys: ["allergies", "medications", "alerts"],
        rankedItems: ranked,
        k: 2,
      }),
    ).toBeCloseTo(2 / 3);
    expect(
      computeNoteTypeCoverageScore({
        expectedNoteTypes: [
          "allergy_record",
          "medication_record",
          "medical_alert",
        ],
        rankedItems: ranked,
        k: 2,
      }),
    ).toBeCloseTo(2 / 3);
  });

  it("computes cache and refresh rates", () => {
    const log = [
      exec({ cacheStatus: "fresh_hit", backgroundRefreshQueued: false }),
      exec({ cacheStatus: "stale_hit", backgroundRefreshQueued: true }),
      exec({ cacheStatus: "miss", backgroundRefreshQueued: false }),
    ];

    expect(computeCacheHitRate(log)).toBeCloseTo(1 / 3);
    expect(computeStaleCacheServeRate(log)).toBeCloseTo(1 / 3);
    expect(computeBackgroundRefreshRate(log)).toBeCloseTo(1 / 3);
  });

  it("computes rerank deltas", () => {
    const log = [
      exec({ semanticTopScore: 0.4, fusionTopScore: 0.5, rerankApplied: true }),
      exec({ semanticTopScore: 0.2, fusionTopScore: 0.3, rerankApplied: true }),
      exec({ fusionTopScore: 0.25, rerankApplied: false }),
    ];

    expect(computeRerankUpliftDelta(log)).toBeCloseTo(0.1);
    expect(computeLexicalOnlyVsRerankedDelta(log)).toBeGreaterThan(0);
  });
});
