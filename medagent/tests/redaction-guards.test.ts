import { describe, expect, it } from "vitest";

import {
  redactAgentTrace,
  redactSupervisorState,
} from "@/lib/agent/legacySupervisorTypes";

describe("redaction guards", () => {
  it("redacts supervisor state high-risk fields", () => {
    const redacted = redactSupervisorState({
      requestId: "req-1",
      patientId: "patient-raw",
      requesterId: "requester-raw",
      requesterLabel: "Dr A",
      issuerLabel: "Issuer",
      naturalLanguageRequest: "show me allergies and meds",
      targetLocale: "en",
      emergencyMode: true,
      patientApprovalPresent: false,
      presentedCredential: "jwt-raw",
      patientPolicy: { tier2AllowedIssuers: ["a"] },
      verification: { allowed: true, reason: "ok" },
      tierDecision: "tier1_auto",
      approvalToken: "approval-raw",
      approvalMethod: "email",
      requestIntent: {
        intentCategory: "clinical_summary",
        requestedFields: ["allergies"],
      },
      summarySubset: { allergies: ["penicillin"] },
      translatedSummary: { allergies: ["penicillin"] },
      glossary: [{ original: "allergy", translated: "allergy" }],
      brief: "sensitive",
      session: {
        token: "session",
        expiresInSec: 60,
      },
      trace: {
        requestId: "req-1",
        patientId: "patient-raw",
        requesterId: "requester-raw",
        requesterLabel: "Dr A",
        issuerLabel: "Issuer",
        steps: [],
      },
    } as any);

    expect(redacted.patientId).toBe("[REDACTED]");
    expect(redacted.requesterId).toBe("[REDACTED]");
    expect(redacted.naturalLanguageRequest).toBe("[REDACTED]");
    expect(redacted.presentedCredential).toBe("[REDACTED]");
    expect(redacted.approvalToken).toBe("[REDACTED]");
    expect(redacted.patientPolicy).toBe("[REDACTED]");
    expect(redacted.trace.patientId).toBe("[REDACTED]");
    expect(redacted.trace.requesterId).toBe("[REDACTED]");
  });

  it("redacts trace identifiers", () => {
    const redacted = redactAgentTrace({
      requestId: "req-2",
      patientId: "patient-raw",
      requesterId: "requester-raw",
      requesterLabel: "Dr B",
      issuerLabel: "Issuer",
      steps: [],
    });

    expect(redacted.patientId).toBe("[REDACTED]");
    expect(redacted.requesterId).toBe("[REDACTED]");
    expect(redacted.requestId).toBe("req-2");
  });
});
