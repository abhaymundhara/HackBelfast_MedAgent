import { describe, it, expect } from "vitest";
import { formatOutbound, formatApprovalPrompt, formatPatientConfirmation, formatHelp, formatAck, formatFollowUpAnswer } from "../outbound";
import type { MedAgentOutcome } from "@/lib/types";

function makeOutcome(overrides: Partial<MedAgentOutcome>): MedAgentOutcome {
  return {
    requestId: "req_test123",
    patientId: "sarah-bennett",
    requesterId: "dr-murphy",
    decision: "granted",
    tier: 1,
    ttlSeconds: 1800,
    fieldsAllowed: ["allergies", "medications", "conditions", "alerts", "emergencyContact", "recentDischarge", "documents"],
    justification: "Verified clinician. Tier 1 granted.",
    trace: { requestId: "req_test123", patientId: "sarah-bennett", requesterId: "dr-murphy", steps: [] },
    auditLog: {
      chainRef: "5xYz...abc",
      chainSequence: 12345,
      chainTimestamp: new Date().toISOString(),
      status: "submitted",
    },
    summarySubset: {
      demographics: { name: "Sarah Bennett", dob: "1991-08-14", sex: "female", bloodType: "O-" },
      allergies: [{ substance: "Penicillin", severity: "life-threatening", reaction: "Anaphylaxis" }],
      medications: [{ name: "Warfarin", dose: "5 mg", frequency: "Once daily", critical: true }],
      conditions: [{ label: "Atrial fibrillation", major: true }],
      alerts: ["anticoagulants"],
      emergencyContact: { name: "J. Bennett", relation: "Brother", phone: "+44 7700 900 111" },
    },
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    ...overrides,
  };
}

describe("formatOutbound", () => {
  it("formats Tier 1 grant under 1000 chars", () => {
    const messages = formatOutbound({ outcome: makeOutcome({}), identityKind: "clinician" });
    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      expect(msg.length).toBeLessThanOrEqual(1000);
    }
    expect(messages[0]).toContain("Tier 1");
    expect(messages[0]).toContain("GRANTED");
  });

  it("formats Tier 2 grant with withheld note", () => {
    const messages = formatOutbound({
      outcome: makeOutcome({ tier: 2, ttlSeconds: 900, fieldsAllowed: ["allergies", "medications", "conditions", "alerts", "emergencyContact", "documents"] }),
      identityKind: "clinician",
    });
    const combined = messages.join("\n");
    expect(combined).toContain("Tier 2");
    expect(combined).toContain("Withheld");
  });

  it("formats Tier 3 break-glass", () => {
    const messages = formatOutbound({
      outcome: makeOutcome({ tier: 3, ttlSeconds: 1200, fieldsAllowed: ["allergies", "medications", "conditions", "alerts", "emergencyContact"] }),
      identityKind: "clinician",
    });
    const combined = messages.join("\n");
    expect(combined).toContain("Tier 3");
    expect(combined).toContain("BREAK-GLASS");
  });

  it("formats denial", () => {
    const messages = formatOutbound({
      outcome: makeOutcome({ decision: "denied", tier: null, ttlSeconds: 0, fieldsAllowed: [] }),
      identityKind: "clinician",
    });
    expect(messages[0]).toContain("DENIED");
    expect(messages[0]).toContain("BREAK GLASS");
  });

  it("formats awaiting_human for clinician", () => {
    const messages = formatOutbound({
      outcome: makeOutcome({ decision: "awaiting_human", tier: 2, ttlSeconds: 900 }),
      identityKind: "clinician",
    });
    expect(messages[0]).toContain("pending patient approval");
  });

  it("includes Solscan URL for real chain refs", () => {
    const messages = formatOutbound({ outcome: makeOutcome({}), identityKind: "clinician" });
    const combined = messages.join("\n");
    expect(combined).toContain("solscan.io/tx/");
    expect(combined).toContain("cluster=devnet");
  });

  it("omits Solscan URL for local chain refs", () => {
    const messages = formatOutbound({
      outcome: makeOutcome({ auditLog: { chainRef: "local-solana:req_123:1234567890", chainSequence: null, chainTimestamp: null, status: "skipped_missing_config" } }),
      identityKind: "clinician",
    });
    const combined = messages.join("\n");
    expect(combined).not.toContain("solscan.io");
  });
});

describe("formatApprovalPrompt", () => {
  it("formats approval prompt under 1000 chars", () => {
    const text = formatApprovalPrompt({
      requesterLabel: "Dr. Chidi Okonkwo",
      issuerLabel: "NHS Northern Ireland",
      fieldsRequested: ["allergies", "medications"],
      ttlMinutes: 15,
      requestId: "req_short",
    });
    expect(text.length).toBeLessThanOrEqual(1000);
    expect(text).toContain("Approval needed");
    expect(text).toContain("YES");
    expect(text).toContain("NO");
  });
});

describe("formatPatientConfirmation", () => {
  it("confirms approval was recorded", () => {
    const text = formatPatientConfirmation({
      requesterLabel: "Dr. Chidi Okonkwo",
      ttlMinutes: 15,
      patientId: "sarah-bennett",
      appBaseUrl: "http://localhost:3000",
    });
    expect(text).toContain("Approval recorded");
    expect(text).toContain("15 minutes");
    expect(text).toContain("/audit/sarah-bennett");
  });
});

describe("formatHelp", () => {
  it("lists slash commands", () => {
    const text = formatHelp();
    expect(text).toContain("/access");
    expect(text).toContain("/help");
  });
});

describe("formatAck", () => {
  it("returns ack message", () => {
    expect(formatAck()).toContain("working");
  });
});

describe("formatFollowUpAnswer", () => {
  it("formats follow-up answer", () => {
    const text = formatFollowUpAnswer({ sessionId: "sess_1", answer: "The patient takes warfarin.", citedFields: ["medications"] });
    expect(text).toContain("warfarin");
    expect(text).toContain("medications");
  });
});
