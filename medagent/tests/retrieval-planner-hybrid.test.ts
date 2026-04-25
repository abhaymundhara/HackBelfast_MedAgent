import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentStateType } from "@/lib/agent/state";
import { runEvidenceFilter } from "@/lib/agent/policy/evidenceFilter";
import { resetDatabase } from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";

function baseState(): AgentStateType {
  return {
    requestContext: {
      requestId: "req-retrieval-hybrid",
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      naturalLanguageRequest: "Need emergency allergy and medication context",
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
      totalSemanticCandidates: 0,
      totalUniqueCandidates: 0,
      ragUsed: false,
      semanticUsed: false,
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
      requestId: "req-retrieval-hybrid",
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      steps: [],
    },
  } as unknown as AgentStateType;
}

describe("retrieval planner hybrid flow", () => {
  beforeEach(async () => {
    resetDatabase();
    await seedDemo();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("supports hybrid rescue when lexical misses and semantic hits", async () => {
    vi.doMock("@/lib/agent/retrieval/localLexicalSearch", () => ({
      localLexicalSearch: vi.fn(() => []),
    }));

    vi.doMock("@/lib/agent/tools/retrievers/localSemanticSearch", () => ({
      localSemanticSearch: vi.fn((input: any) => ({
        latencyMs: 2,
        semanticIndexHit: true,
        candidates: [
          {
            id: "semantic-only-hit",
            patientHash: input.patientHash,
            content: "Severe medication allergy",
            authorization: {
              fieldKey: "allergies",
              allowedForTiers: [1, 2, 3],
              sensitivityClass: "standard",
              requiresExplicitApproval: false,
            },
            sourceType: "document",
            noteType: "allergy_record",
            extractionMode: "narrative",
            sensitivityTags: [],
            clinicalTags: ["test"],
            recencyBucket: "current_admission",
            language: "en",
            provenance: { timestamp: "2026-04-01T00:00:00.000Z" },
            retrieval: {
              source: "rag",
              retryIteration: 0,
              mode: input.mode,
              query: input.query,
              queryPlanIndex: input.queryPlanIndex,
              rank: 1,
              semanticScore: 0.9,
              score: 0.9,
              bestScore: 0.9,
              matchedQueries: ["allergy"],
              sourcesSeen: ["rag"],
              contributingPlanIndexes: [input.queryPlanIndex],
            },
          },
        ],
      })),
    }));

    const { runRetrievalPlanner } =
      await import("@/lib/agent/agents/retrievalPlanner");

    const result = await runRetrievalPlanner(baseState());
    const retrieval = result.retrievalContext!;

    expect(retrieval.totalRagCandidates).toBeGreaterThan(0);
    expect(retrieval.totalSemanticCandidates).toBeGreaterThan(0);
    expect(retrieval.semanticUsed).toBe(true);
    expect(retrieval.executionLog.length).toBeGreaterThan(0);
    expect(
      retrieval.executionLog.every(
        (entry) =>
          (entry.lexicalReturnedCount ?? 0) === 0 &&
          (entry.semanticReturnedCount ?? 0) > 0,
      ),
    ).toBe(true);
  });

  it("fails open on semantic index/embed failure and remains consumable by evidence filter", async () => {
    process.env.MEDAGENT_LOCAL_EMBED_DIMS = "0";

    try {
      const { runRetrievalPlanner } =
        await import("@/lib/agent/agents/retrievalPlanner");

      const plannerResult = await runRetrievalPlanner(baseState());
      const retrieval = plannerResult.retrievalContext!;

      expect(retrieval.totalBaselineCandidates).toBeGreaterThan(0);
      expect(retrieval.totalRagCandidates).toBeGreaterThanOrEqual(0);

      const mergedState = {
        ...baseState(),
        retrievalContext: retrieval,
        trace: plannerResult.trace ?? baseState().trace,
      } as AgentStateType;

      const filterResult = await runEvidenceFilter(mergedState);
      expect(filterResult.evidenceContext?.authorizedChunks).toBeDefined();
    } finally {
      delete process.env.MEDAGENT_LOCAL_EMBED_DIMS;
    }
  });
});
