import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentStateType, CanonicalEvidenceItem } from "@/lib/agent/state";
import { resetDatabase } from "@/lib/db";
import { runSessionIssuer } from "@/lib/agent/policy/issuer";
import { seedDemo } from "@/scripts/seed-demo";

function makeEvidenceItem(
  id: string,
  fieldKey = "allergies",
): CanonicalEvidenceItem {
  return {
    id,
    patientHash: "patient-hash",
    content: `Evidence ${id}`,
    authorization: {
      fieldKey,
      allowedForTiers: [1, 2, 3],
      sensitivityClass: "critical_only",
      requiresExplicitApproval: false,
    },
    sourceType: "document",
    noteType: "allergy",
    extractionMode: "narrative",
    sensitivityTags: [],
    clinicalTags: [],
    recencyBucket: "historical",
    language: "en",
    provenance: {
      timestamp: new Date().toISOString(),
    },
  };
}

function makeState(overrides?: Partial<AgentStateType>): AgentStateType {
  const base = {
    requestContext: {
      requestId: "req-1",
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      naturalLanguageRequest: "Need emergency summary",
      targetLocale: "en-GB",
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
      executionLog: [],
      rawCandidates: [],
      totalBaselineCandidates: 0,
      totalRagCandidates: 0,
      totalUniqueCandidates: 0,
      ragUsed: false,
      retryCount: 0,
    },
    evidenceContext: {
      authorizedChunks: [makeEvidenceItem("ev-1")],
      reviewJudgement: {
        acceptedEvidenceIds: ["ev-1"],
        rejectedEvidenceIds: [],
        rejectionReasons: {},
        missingCategories: [],
        partialAnswerViable: true,
        confidence: "high",
        worthAnotherRetrievalPass: false,
        clarificationIsBetter: false,
        retrievalGapType: "none",
        semanticSufficiency: true,
      },
    },
    responseContext: {
      answerStatus: "partial",
      clinicianBrief: "Grounded brief",
      citedEvidenceIds: ["ev-1"],
      unsupportedClaims: [],
    },
    completedAgents: [],
    trace: {
      requestId: "req-1",
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      steps: [],
    },
  } as unknown as AgentStateType;

  if (!overrides) {
    return base;
  }

  return {
    ...base,
    ...overrides,
    requestContext: {
      ...base.requestContext,
      ...(overrides.requestContext ?? {}),
    },
    policyContext: {
      ...base.policyContext,
      ...(overrides.policyContext ?? {}),
    },
    understandingContext: {
      ...base.understandingContext,
      ...(overrides.understandingContext ?? {}),
    },
    retrievalContext: {
      ...base.retrievalContext,
      ...(overrides.retrievalContext ?? {}),
    },
    evidenceContext: {
      ...base.evidenceContext,
      ...(overrides.evidenceContext ?? {}),
    },
    responseContext: {
      ...base.responseContext,
      ...(overrides.responseContext ?? {}),
    },
    trace: {
      ...base.trace,
      ...(overrides.trace ?? {}),
      steps: overrides.trace?.steps ?? base.trace.steps,
    },
  } as AgentStateType;
}

function pushTrace(state: any, tool: string, summary: string) {
  const trace = state.trace ?? { steps: [] };
  return {
    ...trace,
    steps: [
      ...(trace.steps ?? []),
      {
        order: (trace.steps?.length ?? 0) + 1,
        tool,
        status: "completed",
        summary,
        startedAt: new Date().toISOString(),
      },
    ],
  } as unknown as AgentStateType;
}

async function loadSupervisorWithMocks(config: {
  deterministicDecision?: "granted" | "denied" | "awaiting_human";
  reviewJudgement?: AgentStateType["evidenceContext"]["reviewJudgement"];
  authorizedChunks?: CanonicalEvidenceItem[];
  retrievalModesByCall?: Array<"balanced" | "broad" | "exact">;
  synthesisAnswerStatus?: "complete" | "partial" | "clarification_needed";
}) {
  vi.resetModules();

  const observed = {
    retrievalCalls: [] as string[],
    synthesizerInputIds: [] as string[],
    auditCalls: 0,
    requestUnderstandingCalls: 0,
    evidenceReviewerCalls: 0,
    synthesizerCalls: 0,
  };

  const retrievalModes = config.retrievalModesByCall ?? ["balanced"];

  vi.doMock("@/lib/agent/policy/deterministicEngine", () => ({
    runDeterministicPolicyEngine: vi.fn(async (state: AgentStateType) => ({
      policyContext: {
        ...state.policyContext,
        decision: config.deterministicDecision ?? "granted",
        tier: 1,
        fieldsAllowed: ["allergies"],
      },
      trace: pushTrace(state, "decideTier", "deterministicEngine"),
      completedAgents: ["deterministicEngine"],
    })),
  }));

  vi.doMock("@/lib/agent/agents/requestUnderstanding", () => ({
    runRequestUnderstanding: vi.fn(async (state: AgentStateType) => {
      observed.requestUnderstandingCalls += 1;
      return {
        understandingContext: {
          ...state.understandingContext,
          focusAreas: ["allergies"],
          ambiguityFlags: [],
        },
        trace: pushTrace(state, "analyzeRequestIntent", "requestUnderstanding"),
        completedAgents: ["requestUnderstanding"],
      };
    }),
  }));

  vi.doMock("@/lib/agent/agents/retrievalPlanner", () => ({
    runRetrievalPlanner: vi.fn(async (state: AgentStateType) => {
      const mode =
        retrievalModes[
          Math.min(observed.retrievalCalls.length, retrievalModes.length - 1)
        ];
      observed.retrievalCalls.push(mode);
      const idx = observed.retrievalCalls.length - 1;
      return {
        retrievalContext: {
          ...state.retrievalContext,
          queryPlans: [{ query: `${mode} query`, mode, topK: 3 }],
          retryCount: idx + 1,
          rawCandidates: [makeEvidenceItem("ev-1"), makeEvidenceItem("ev-2")],
          totalUniqueCandidates: 2,
          totalRagCandidates: 1,
        },
        trace: pushTrace(state, "ragRetrieve", "retrieveCandidateChunks"),
        completedAgents: ["retrievalPlanner"],
      };
    }),
  }));

  vi.doMock("@/lib/agent/policy/evidenceFilter", () => ({
    runEvidenceFilter: vi.fn(async (state: AgentStateType) => ({
      evidenceContext: {
        ...state.evidenceContext,
        authorizedChunks: config.authorizedChunks ?? [
          makeEvidenceItem("ev-1"),
          makeEvidenceItem("ev-2"),
        ],
      },
      completedAgents: ["evidenceFilter"],
    })),
  }));

  vi.doMock("@/lib/agent/agents/evidenceReviewer", () => ({
    runEvidenceReviewer: vi.fn(async (state: AgentStateType) => {
      observed.evidenceReviewerCalls += 1;
      return {
        evidenceContext: {
          ...state.evidenceContext,
          reviewJudgement: config.reviewJudgement ?? {
            acceptedEvidenceIds: ["ev-1"],
            rejectedEvidenceIds: ["ev-2"],
            rejectionReasons: { "ev-2": "irrelevant" },
            missingCategories: [],
            partialAnswerViable: true,
            confidence: "medium",
            worthAnotherRetrievalPass: false,
            clarificationIsBetter: false,
            retrievalGapType: "none",
            semanticSufficiency: true,
          },
        },
        trace: pushTrace(state, "ragRetrieve", "rerankChunks"),
        completedAgents: ["evidenceReviewer"],
      };
    }),
  }));

  vi.doMock("@/lib/agent/agents/medicalSynthesizer", () => ({
    runMedicalSynthesizer: vi.fn(async (state: AgentStateType) => {
      observed.synthesizerCalls += 1;
      observed.synthesizerInputIds = (
        state.evidenceContext.authorizedChunks ?? []
      ).map((c) => c.id);
      return {
        responseContext: {
          ...state.responseContext,
          answerStatus: config.synthesisAnswerStatus ?? "partial",
          clinicianBrief: "Grounded brief",
          citedEvidenceIds: observed.synthesizerInputIds,
          unsupportedClaims: [],
        },
        trace: pushTrace(state, "ragRetrieve", "composeClinicianBrief"),
        completedAgents: ["medicalSynthesizer"],
      };
    }),
  }));

  vi.doMock("@/lib/agent/policy/issuer", () => ({
    runSessionIssuer: vi.fn(async (state: AgentStateType) => ({
      responseContext: {
        ...state.responseContext,
        sessionToken:
          state.responseContext.answerStatus === "clarification_needed"
            ? undefined
            : "dummy.jwt.token",
      },
      trace: pushTrace(state, "issueSessionToken", "issueSessionToken"),
      completedAgents: ["sessionIssuer"],
    })),
  }));

  vi.doMock("@/lib/agent/agents/auditAgent", () => ({
    runAuditAgent: vi.fn(async (state: AgentStateType) => {
      observed.auditCalls += 1;
      return {
        trace: pushTrace(state, "logAuditOnChain", "logAuditOnChain"),
        completedAgents: ["auditAgent"],
      };
    }),
  }));

  const supervisor = await import("@/lib/agent/supervisor");
  return { medAgentApp: supervisor.medAgentApp, observed };
}

describe("workflow invariants", () => {
  const originalJwt = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    resetDatabase();
    await seedDemo();
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwt;
  });

  it("A. unauthorized evidence never reaches synthesis", async () => {
    const { medAgentApp, observed } = await loadSupervisorWithMocks({
      authorizedChunks: [makeEvidenceItem("ev-1"), makeEvidenceItem("ev-2")],
      reviewJudgement: {
        acceptedEvidenceIds: ["ev-1"],
        rejectedEvidenceIds: ["ev-2"],
        rejectionReasons: { "ev-2": "irrelevant" },
        missingCategories: [],
        partialAnswerViable: true,
        confidence: "medium",
        worthAnotherRetrievalPass: false,
        clarificationIsBetter: false,
        retrievalGapType: "none",
        semanticSufficiency: true,
      },
    });

    const result = await medAgentApp.invoke(makeState(), {
      configurable: { thread_id: "A" },
    });

    expect(observed.synthesizerInputIds).toEqual(["ev-1"]);
    expect(result.responseContext.citedEvidenceIds).toEqual(["ev-1"]);
    expect(
      result.trace.steps.some((s: any) =>
        String(s.summary).includes("composeClinicianBrief"),
      ),
    ).toBe(true);
  });

  it("B/C. token is never issued for clarification_needed or missing citations", async () => {
    const base = makeState();

    const clarificationState = {
      ...base,
      responseContext: {
        ...base.responseContext,
        answerStatus: "clarification_needed",
      },
    } as AgentStateType;

    const clarificationResult = await runSessionIssuer(clarificationState);
    expect(clarificationResult.responseContext?.sessionToken).toBeUndefined();
    expect(clarificationResult.trace?.steps.at(-1)?.summary).toContain(
      "Session issuance skipped",
    );

    const missingCitationState = {
      ...base,
      responseContext: {
        ...base.responseContext,
        answerStatus: "partial",
        clinicianBrief: "brief present",
        citedEvidenceIds: [],
      },
    } as AgentStateType;

    const citationResult = await runSessionIssuer(missingCitationState);
    expect(citationResult.responseContext?.sessionToken).toBeUndefined();
    expect(citationResult.trace?.steps.at(-1)?.summary).toContain(
      "missing_citations",
    );
  });

  it("D. retry loop stops deterministically at exact", async () => {
    const { medAgentApp, observed } = await loadSupervisorWithMocks({
      retrievalModesByCall: ["balanced", "broad", "exact"],
      reviewJudgement: {
        acceptedEvidenceIds: [],
        rejectedEvidenceIds: [],
        rejectionReasons: {},
        missingCategories: ["allergies"],
        partialAnswerViable: false,
        confidence: "low",
        worthAnotherRetrievalPass: true,
        clarificationIsBetter: false,
        retrievalGapType: "recoverable",
        semanticSufficiency: false,
      },
    });

    await medAgentApp.invoke(makeState(), {
      configurable: { thread_id: "D" },
    });

    expect(observed.retrievalCalls).toEqual(["balanced", "broad", "exact"]);
    expect(observed.retrievalCalls).toHaveLength(3);
  });

  it("E. policy_blocked never retries", async () => {
    const { medAgentApp, observed } = await loadSupervisorWithMocks({
      retrievalModesByCall: ["balanced", "broad", "exact"],
      reviewJudgement: {
        acceptedEvidenceIds: [],
        rejectedEvidenceIds: [],
        rejectionReasons: {},
        missingCategories: [],
        partialAnswerViable: false,
        confidence: "low",
        worthAnotherRetrievalPass: true,
        clarificationIsBetter: false,
        retrievalGapType: "policy_blocked",
        semanticSufficiency: false,
      },
    });

    await medAgentApp.invoke(makeState(), {
      configurable: { thread_id: "E" },
    });

    expect(observed.retrievalCalls).toHaveLength(1);
    expect(observed.synthesizerCalls).toBe(1);
  });

  it("F. denied and awaiting_human bypass retrieval path", async () => {
    for (const decision of ["denied", "awaiting_human"] as const) {
      const { medAgentApp, observed } = await loadSupervisorWithMocks({
        deterministicDecision: decision,
      });

      const result = await medAgentApp.invoke(makeState(), {
        configurable: { thread_id: `F-${decision}` },
      });

      expect(observed.auditCalls).toBe(1);
      expect(observed.requestUnderstandingCalls).toBe(0);
      expect(observed.retrievalCalls).toHaveLength(0);
      expect(observed.evidenceReviewerCalls).toBe(0);
      expect(observed.synthesizerCalls).toBe(0);
      expect(
        result.trace.steps.some((s: any) =>
          String(s.summary).includes("logAuditOnChain"),
        ),
      ).toBe(true);
    }
  });

  it("G. LLM synthesis failure falls back safely", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/agent/agents/medicalSynthesizer");
    vi.doMock("@langchain/openai", () => ({
      ChatOpenAI: class {
        withStructuredOutput() {
          return {
            invoke: vi.fn().mockRejectedValue(new Error("llm down")),
          };
        }
      },
    }));

    const { runMedicalSynthesizer } =
      await import("@/lib/agent/agents/medicalSynthesizer");
    const state = makeState();
    state.evidenceContext.authorizedChunks = [
      makeEvidenceItem("ev-1"),
      makeEvidenceItem("ev-2"),
      makeEvidenceItem("ev-3"),
      makeEvidenceItem("ev-4"),
    ];

    const result = await runMedicalSynthesizer(state);

    expect(result.responseContext?.clinicianBrief).toContain(
      "Grounded extractive summary",
    );
    expect(
      (result.responseContext?.citedEvidenceIds ?? []).every((id) =>
        ["ev-1", "ev-2", "ev-3", "ev-4"].includes(id),
      ),
    ).toBe(true);
    expect(result.responseContext?.unsupportedClaims).toContain(
      "llm_synthesis_unavailable_extractive_fallback",
    );
    expect(result.responseContext?.answerStatus).not.toBe("complete");
  });

  it("H. invalid citation IDs are downgraded", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/agent/agents/medicalSynthesizer");
    vi.doMock("@langchain/openai", () => ({
      ChatOpenAI: class {
        withStructuredOutput() {
          return {
            invoke: vi.fn().mockResolvedValue({
              clinicianBrief: "Brief with mixed citations",
              citedEvidenceIds: ["ev-1", "bad-id"],
              unsupportedClaims: [],
            }),
          };
        }
      },
    }));

    const { runMedicalSynthesizer } =
      await import("@/lib/agent/agents/medicalSynthesizer");
    const state = makeState();

    const result = await runMedicalSynthesizer(state);
    expect(result.responseContext?.citedEvidenceIds).toEqual(["ev-1"]);
    expect(result.responseContext?.unsupportedClaims).toContain(
      "invalid_citation_id:bad-id",
    );
    expect(result.responseContext?.answerStatus).not.toBe("complete");
  });

  it("I. empty authorized evidence yields clarification and no token", async () => {
    const state = makeState({
      evidenceContext: {
        authorizedChunks: [],
        reviewJudgement: {
          acceptedEvidenceIds: [],
          rejectedEvidenceIds: [],
          rejectionReasons: {},
          missingCategories: ["allergies"],
          partialAnswerViable: false,
          confidence: "low",
          worthAnotherRetrievalPass: false,
          clarificationIsBetter: true,
          retrievalGapType: "recoverable",
          semanticSufficiency: false,
        },
      } as any,
    });

    vi.resetModules();
    vi.doUnmock("@/lib/agent/agents/medicalSynthesizer");
    const { runMedicalSynthesizer } =
      await import("@/lib/agent/agents/medicalSynthesizer");
    const synth = await runMedicalSynthesizer(state);

    expect(synth.responseContext?.answerStatus).toBe("clarification_needed");
    expect(synth.responseContext?.clarificationQuestion).toBeTruthy();
    expect(synth.responseContext?.clinicianBrief).toBeFalsy();

    const issuerInput = {
      ...state,
      responseContext: {
        ...state.responseContext,
        ...synth.responseContext,
      },
    } as AgentStateType;

    const issued = await runSessionIssuer(issuerInput);
    expect(issued.responseContext?.sessionToken).toBeUndefined();
  });

  it("J. audit runs on terminal paths", async () => {
    const terminalStatuses: Array<
      "clarification_needed" | "partial" | "complete"
    > = ["clarification_needed", "partial", "complete"];

    for (const status of terminalStatuses) {
      const { medAgentApp, observed } = await loadSupervisorWithMocks({
        deterministicDecision: "granted",
        synthesisAnswerStatus: status,
      });
      const result = await medAgentApp.invoke(makeState(), {
        configurable: { thread_id: `J-${status}` },
      });
      expect(observed.auditCalls).toBe(1);
      expect(
        result.trace.steps.some((s: any) =>
          String(s.summary).includes("logAuditOnChain"),
        ),
      ).toBe(true);
      expect(
        result.trace.steps.some((s: any) =>
          String(s.summary).includes("issueSessionToken"),
        ),
      ).toBe(true);
    }

    for (const decision of ["denied", "awaiting_human"] as const) {
      const { medAgentApp, observed } = await loadSupervisorWithMocks({
        deterministicDecision: decision,
      });
      const result = await medAgentApp.invoke(makeState(), {
        configurable: { thread_id: `J-${decision}` },
      });
      expect(observed.auditCalls).toBe(1);
      expect(
        result.trace.steps.some((s: any) =>
          String(s.summary).includes("logAuditOnChain"),
        ),
      ).toBe(true);
    }
  }, 30_000);
});
