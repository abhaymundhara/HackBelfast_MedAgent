import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runSessionIssuer } from "@/lib/agent/policy/issuer";
import { createAccessRequest, resetDatabase } from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";
import { AgentStateType } from "@/lib/agent/state";

const mockedBuildAuditEvent = vi.fn();
const mockedLogAuditOnChain = vi.fn();

vi.mock("@/lib/agent/tools/logAuditOnChain", () => ({
  buildAuditEvent: mockedBuildAuditEvent,
  logAuditOnChain: mockedLogAuditOnChain,
}));

function baseState(): AgentStateType {
  return {
    requestContext: {
      requestId: "req-test",
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      naturalLanguageRequest: "Need emergency allergies and meds summary",
      targetLocale: "en-GB",
      emergencyMode: true,
      patientApprovalPresent: false,
    },
    policyContext: {
      verified: true,
      decision: "granted",
      tier: 1,
      fieldsAllowed: ["allergies", "medications"],
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
      authorizedChunks: [
        {
          id: "ev-1",
          patientHash: "hash-1",
          content: "Severe penicillin allergy with prior anaphylaxis.",
          authorization: {
            fieldKey: "allergies",
            allowedForTiers: [1, 2, 3],
            sensitivityClass: "critical_only",
            requiresExplicitApproval: false,
          },
          sourceType: "document",
          noteType: "allergy",
          extractionMode: "narrative",
          sensitivityTags: [],
          clinicalTags: ["critical"],
          recencyBucket: "historical",
          language: "en",
          provenance: {
            timestamp: new Date().toISOString(),
          },
        },
      ],
    },
    responseContext: {
      answerStatus: "partial",
      clinicianBrief: "Patient has severe penicillin allergy.",
      citedEvidenceIds: ["ev-1"],
      unsupportedClaims: [],
    },
    completedAgents: [],
    trace: {
      requestId: "req-test",
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      steps: [],
    },
  } as unknown as AgentStateType;
}

describe("session issuer deterministic gates", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("issues token when all deterministic gates pass", async () => {
    const state = baseState();
    state.responseContext.answerStatus = "complete";

    const result = await runSessionIssuer(state);
    expect(result.responseContext?.sessionToken).toBeDefined();
  });

  it("skips issuance for non-issuable states", async () => {
    const scenarios: Array<{
      mutate: (s: AgentStateType) => void;
      expected: string;
    }> = [
      {
        mutate: (s) => {
          s.responseContext.answerStatus = "clarification_needed";
        },
        expected: "invalid_status",
      },
      {
        mutate: (s) => {
          s.responseContext.clinicianBrief = "";
        },
        expected: "missing_brief",
      },
      {
        mutate: (s) => {
          s.responseContext.citedEvidenceIds = [];
        },
        expected: "missing_citations",
      },
      {
        mutate: (s) => {
          s.policyContext.decision = "denied";
        },
        expected: "decision_not_granted",
      },
      {
        mutate: (s) => {
          s.policyContext.decision = "awaiting_human";
        },
        expected: "decision_not_granted",
      },
      {
        mutate: () => {
          delete process.env.JWT_SECRET;
        },
        expected: "missing_jwt_secret",
      },
    ];

    for (const scenario of scenarios) {
      process.env.JWT_SECRET = "test-secret";
      const state = baseState();
      scenario.mutate(state);
      const result = await runSessionIssuer(state);
      expect(result.responseContext?.sessionToken).toBeUndefined();
      expect(result.trace?.steps.at(-1)?.summary).toContain(scenario.expected);
    }
  });

  it("uses deterministic TTL by tier", async () => {
    const cases: Array<{ tier: 1 | 2 | 3; ttl: number }> = [
      { tier: 1, ttl: 30 * 60 },
      { tier: 2, ttl: 15 * 60 },
      { tier: 3, ttl: 20 * 60 },
    ];

    for (const testCase of cases) {
      const state = baseState();
      state.policyContext.tier = testCase.tier;
      state.responseContext.answerStatus = "complete";
      const result = await runSessionIssuer(state);
      const token = result.responseContext?.sessionToken;
      expect(token).toBeDefined();

      const payload = jwt.decode(token as string) as {
        exp: number;
        iat: number;
      };
      expect(payload.exp - payload.iat).toBe(testCase.ttl);
    }
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });
});

describe("audit tail deterministic behavior", () => {
  beforeEach(async () => {
    resetDatabase();
    await seedDemo();
    vi.clearAllMocks();

    mockedBuildAuditEvent.mockImplementation((input: any) => ({
      event_type: input.eventType,
      request_id: input.requestId,
      doctor_hash: "doctor-hash",
      patient_hash: "patient-hash",
      jurisdiction: input.jurisdiction,
      decision: input.decision === "granted" ? "allow" : "deny",
      token_expiry: input.tokenExpiry,
      timestamp: new Date().toISOString(),
    }));

    mockedLogAuditOnChain.mockResolvedValue({
      chainRef: "sig-1",
      chainSequence: 100,
      chainTimestamp: new Date().toISOString(),
      status: "submitted",
    });
  });

  async function runAuditWithToken(sessionToken?: string) {
    const { runAuditAgent } = await import("@/lib/agent/agents/auditAgent");
    const requestId = `req-audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    createAccessRequest({
      id: requestId,
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      naturalLanguageRequest: "Need emergency summary",
      emergencyMode: true,
      requesterLabel: "Dr. Demo",
      issuerLabel: "Demo Hospital",
    });

    const state = {
      ...baseState(),
      requestContext: {
        ...baseState().requestContext,
        requestId,
      },
      responseContext: {
        ...baseState().responseContext,
        sessionToken,
      },
      trace: {
        requestId,
        patientId: "sarah-bennett",
        requesterId: "did:solana:demo:doctor-1",
        steps: [],
      },
    } as AgentStateType;

    return runAuditAgent(state);
  }

  it("uses token_issued event type when token exists", async () => {
    const token = jwt.sign(
      { sub: "session-1", exp: Math.floor(Date.now() / 1000) + 900 },
      "secret",
    );
    await runAuditWithToken(token);

    expect(mockedBuildAuditEvent).toHaveBeenCalled();
    expect(mockedBuildAuditEvent.mock.calls[0][0].eventType).toBe(
      "token_issued",
    );
  });

  it("uses access_decision event type when token is absent", async () => {
    await runAuditWithToken(undefined);

    expect(mockedBuildAuditEvent).toHaveBeenCalled();
    expect(mockedBuildAuditEvent.mock.calls[0][0].eventType).toBe(
      "access_decision",
    );
  });

  it("does not crash when audit submission is skipped/missing config", async () => {
    mockedLogAuditOnChain.mockResolvedValue({
      chainRef: "local-solana:req-audit",
      chainSequence: null,
      chainTimestamp: new Date().toISOString(),
      status: "skipped_missing_config",
    });

    const result = await runAuditWithToken(undefined);
    expect(result.completedAgents).toContain("auditAgent");
  });

  it("updates trace for both success and failure paths", async () => {
    const success = await runAuditWithToken(undefined);
    expect(success.trace?.steps.at(-1)?.summary).toContain(
      "Audit event submitted",
    );

    mockedLogAuditOnChain.mockRejectedValue(new Error("boom"));
    const failure = await runAuditWithToken(undefined);
    expect(failure.trace?.steps.at(-1)?.summary).toContain("submission failed");
  });
});
