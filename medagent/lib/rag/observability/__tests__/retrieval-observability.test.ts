import { describe, expect, it } from "vitest";

import { AgentStateType } from "@/lib/agent/state";
import { buildRetrievalObservabilitySnapshot } from "@/lib/rag/observability/retrievalObservability";

function state(): AgentStateType {
  return {
    requestContext: {
      requestId: "req-1",
      patientId: "p1",
      requesterId: "r1",
      naturalLanguageRequest: "need emergency allergy context",
      targetLocale: "en",
      emergencyMode: true,
      patientApprovalPresent: false,
    },
    policyContext: {
      verified: true,
      decision: "granted",
      tier: 1,
      fieldsAllowed: ["allergies"],
    },
    understandingContext: {
      focusAreas: ["allergies"],
      withheldAreas: [],
      ambiguityFlags: [],
      suggestedStrategy: "fallback",
    },
    retrievalContext: {
      queryPlans: [],
      executionLog: [
        {
          queryPlanIndex: 0,
          executedQuery: "q",
          mode: "balanced",
          targetFields: ["allergies"],
          targetNoteTypes: ["allergy_record"],
          topK: 5,
          ragAttempted: true,
          ragReturnedCount: 2,
          countBeforeTargeting: 2,
          countAfterTargeting: 2,
          baselineContributedCount: 0,
          ragContributedCount: 2,
          lexicalLatencyMs: 40,
          rerankLatencyMs: 25,
          cacheStatus: "miss",
          zeroResult: false,
        },
      ],
      rawCandidates: [],
      totalBaselineCandidates: 1,
      totalRagCandidates: 2,
      totalSemanticCandidates: 2,
      totalUniqueCandidates: 2,
      patientHashUsed: "hash1",
      ragUsed: true,
      semanticUsed: true,
      cacheHitCount: 0,
      staleCacheServedCount: 0,
      cacheMissCount: 1,
      backgroundRefreshQueued: false,
      indexStatus: "ready",
      indexFreshness: "fresh",
      retryCount: 1,
      optimizerApplied: false,
      optimizerProfile: "none",
      recommendedModeOrder: [],
      recommendedTopK: 0,
      retrievalProfile: "default",
      plannerLatencyMs: 120,
      indexEnsureLatencyMs: 20,
      lexicalLatencyMs: 40,
      rerankLatencyMs: 25,
      latencyClassification: "healthy",
      cacheLookupLatencyMs: 5,
      cacheWriteLatencyMs: 2,
    },
    evidenceContext: {
      authorizedChunks: [],
      reviewJudgement: {
        acceptedEvidenceIds: ["a"],
        rejectedEvidenceIds: [],
        rejectionReasons: {},
        missingCategories: [],
        partialAnswerViable: true,
        confidence: "high",
        worthAnotherRetrievalPass: false,
        clarificationIsBetter: false,
        retrievalGapType: "none",
        semanticSufficiency: true,
        retrievalDiagnostic: "retrieval_healthy",
        retrievalBreadthScore: 0.8,
      },
    },
    responseContext: {
      answerStatus: "partial",
    },
    completedAgents: [],
    trace: {
      requestId: "req-1",
      patientId: "p1",
      requesterId: "r1",
      steps: [],
    },
  } as AgentStateType;
}

describe("retrieval observability", () => {
  it("builds deterministic invocation snapshot", () => {
    const snapshot = buildRetrievalObservabilitySnapshot({
      state: state(),
      timings: {
        lexicalMs: 40,
        rerankMs: 25,
        cacheLookupMs: 5,
        indexEnsureMs: 20,
        totalPlannerMs: 120,
      },
      totalCandidatesBeforeDedupe: 3,
      totalAuthorizedCandidates: 2,
      totalAcceptedEvidence: 1,
      plansWithRagHits: 1,
      zeroResultPlanCount: 0,
      heavilyPrunedPlanCount: 0,
    });

    expect(snapshot.requestId).toBe("req-1");
    expect(snapshot.totalPlannerLatencyMs).toBe(120);
    expect(snapshot.latencyClassification).toBe("healthy");
    expect(snapshot.plansWithRagHits).toBe(1);
    expect(snapshot.estimatedRequestCostUsd).toBeGreaterThan(0);
    expect(snapshot.costBudgetStatus).toMatch(
      /healthy|degraded|budget_exceeded/,
    );
  });

  it("classifies budget breaches as diagnostics, not exceptions", () => {
    const snapshot = buildRetrievalObservabilitySnapshot({
      state: state(),
      timings: {
        lexicalMs: 999,
        rerankMs: 999,
        cacheLookupMs: 999,
        indexEnsureMs: 999,
        totalPlannerMs: 999,
      },
      totalCandidatesBeforeDedupe: 3,
      totalAuthorizedCandidates: 2,
      totalAcceptedEvidence: 1,
      plansWithRagHits: 1,
      zeroResultPlanCount: 0,
      heavilyPrunedPlanCount: 0,
    });

    expect(snapshot.latencyClassification).toBe("budget_exceeded");
    expect(snapshot.latencyBreaches.length).toBeGreaterThan(0);
  });

  it("flags request-cost budget breaches", () => {
    process.env.MEDAGENT_RETRIEVAL_COST_BUDGET_USD = "0.001";
    process.env.MEDAGENT_RETRIEVAL_EMBED_COST_USD = "0.001";
    process.env.MEDAGENT_RETRIEVAL_RERANK_COST_USD = "0.001";
    process.env.MEDAGENT_RETRIEVAL_CHAIN_WRITE_COST_USD = "0.001";

    const snapshot = buildRetrievalObservabilitySnapshot({
      state: state(),
      timings: {
        lexicalMs: 40,
        rerankMs: 25,
        cacheLookupMs: 5,
        indexEnsureMs: 20,
        totalPlannerMs: 120,
      },
      totalCandidatesBeforeDedupe: 3,
      totalAuthorizedCandidates: 2,
      totalAcceptedEvidence: 1,
      plansWithRagHits: 1,
      zeroResultPlanCount: 0,
      heavilyPrunedPlanCount: 0,
    });

    expect(snapshot.costBudgetStatus).toBe("budget_exceeded");
    expect(snapshot.estimatedRequestCostUsd).toBeGreaterThan(
      snapshot.costBudgetUsd,
    );

    delete process.env.MEDAGENT_RETRIEVAL_COST_BUDGET_USD;
    delete process.env.MEDAGENT_RETRIEVAL_EMBED_COST_USD;
    delete process.env.MEDAGENT_RETRIEVAL_RERANK_COST_USD;
    delete process.env.MEDAGENT_RETRIEVAL_CHAIN_WRITE_COST_USD;
  });
});
