import { beforeEach, describe, expect, it } from "vitest";

import { runRetrievalPlanner } from "@/lib/agent/agents/retrievalPlanner";
import { AgentStateType } from "@/lib/agent/state";
import { resetDatabase } from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";
import { clearRetrievalCacheForTests } from "@/lib/rag/cache/retrievalCache";

function baseState(): AgentStateType {
  return {
    requestContext: {
      requestId: "req-retrieval-lexical",
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      naturalLanguageRequest: "Need allergy and medication safety context",
      targetLocale: "en",
      emergencyMode: true,
      patientApprovalPresent: false,
    },
    policyContext: {
      verified: true,
      decision: "granted",
      tier: 1,
      fieldsAllowed: ["allergies", "medications", "conditions"],
    },
    understandingContext: {
      focusAreas: ["allergies", "medications"],
      withheldAreas: [],
      ambiguityFlags: [],
      suggestedStrategy: "fallback",
    },
    retrievalContext: {
      queryPlans: [],
      executionLog: [],
      rawCandidates: [],
      totalBaselineCandidates: 0,
      totalRagCandidates: 0,
      totalUniqueCandidates: 0,
      ragUsed: false,
      retryCount: 0,
    },
    evidenceContext: {
      authorizedChunks: [],
    },
    responseContext: {
      answerStatus: "pending",
    },
    completedAgents: [],
    trace: {
      requestId: "req-retrieval-lexical",
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      steps: [],
    },
  } as unknown as AgentStateType;
}

describe("retrievalPlanner lexical integration", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedDemo();
    await clearRetrievalCacheForTests();
  });

  it("merges lexical RAG results with baseline candidates", async () => {
    const result = await runRetrievalPlanner(baseState());
    const retrieval = result.retrievalContext;

    expect(retrieval).toBeDefined();
    expect(retrieval?.totalBaselineCandidates).toBeGreaterThan(0);
    expect(retrieval?.rawCandidates.length).toBeGreaterThan(0);
    expect(retrieval?.totalUniqueCandidates).toBeGreaterThan(0);

    const hasRagSource = retrieval?.rawCandidates.some((item) =>
      item.retrieval?.sourcesSeen?.includes("rag"),
    );
    expect(hasRagSource).toBe(true);
    const scores = retrieval?.rawCandidates.map(
      (item) => item.retrieval?.bestScore ?? item.retrieval?.score ?? 0,
    );
    expect(scores).toBeDefined();
    expect(scores).toEqual([...scores!].sort((a, b) => b - a));

    expect(retrieval?.executionLog.length).toBeGreaterThan(0);
    expect(
      retrieval?.executionLog.every(
        (entry) =>
          typeof entry.lexicalReturnedCount === "number" &&
          typeof entry.lexicalContributedCount === "number" &&
          typeof entry.lexicalLatencyMs === "number" &&
          typeof entry.rerankApplied === "boolean" &&
          typeof entry.rerankInputCount === "number" &&
          typeof entry.rerankLatencyMs === "number" &&
          typeof entry.rerankModel === "string",
      ),
    ).toBe(true);
  });

  it("falls back to lexical-only when local reranker fails", async () => {
    process.env.MEDAGENT_FORCE_LOCAL_RERANK_FAILURE = "1";

    try {
      const result = await runRetrievalPlanner(baseState());
      const retrieval = result.retrievalContext;

      expect(retrieval).toBeDefined();
      expect(retrieval?.rawCandidates.length).toBeGreaterThan(0);
      expect(
        retrieval?.executionLog.every((entry) => entry.rerankApplied === false),
      ).toBe(true);
    } finally {
      delete process.env.MEDAGENT_FORCE_LOCAL_RERANK_FAILURE;
    }
  });

  it("does not crash when lexical search contributes zero results", async () => {
    const state = baseState();
    state.policyContext.fieldsAllowed = ["unknownField"];
    state.understandingContext.focusAreas = ["unknownField"];
    state.retrievalContext.retryCount = 2;

    const result = await runRetrievalPlanner(state);
    const retrieval = result.retrievalContext;

    expect(retrieval).toBeDefined();
    expect(retrieval?.totalBaselineCandidates).toBeGreaterThan(0);
    expect(retrieval?.totalRagCandidates).toBe(0);
    expect(retrieval?.rawCandidates.length).toBeGreaterThan(0);
    expect(retrieval?.executionLog.length).toBeGreaterThan(0);
    expect(retrieval?.executionLog.every((entry) => entry.zeroResult)).toBe(
      true,
    );
  });
});
