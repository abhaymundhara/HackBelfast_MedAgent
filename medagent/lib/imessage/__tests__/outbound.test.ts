import { describe, it, expect } from "vitest";
import { formatOutbound, formatHelp, formatAck, formatFollowUpAnswer } from "../outbound";
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
    justification: "Full access granted and audited on Solana.",
    trace: { requestId: "req_test123", patientId: "sarah-bennett", requesterId: "dr-murphy", steps: [] },
    auditLog: {
      chainRef: "5xYzAbc123",
      chainSequence: 12345,
      chainTimestamp: new Date().toISOString(),
      status: "submitted",
    },
    summarySubset: {
      demographics: { name: "Sarah Bennett", dob: "1991-08-14", sex: "female", bloodType: "O-", homeCountry: "United Kingdom" },
      allergies: [{ substance: "Penicillin", severity: "life-threatening", reaction: "Anaphylaxis" }],
      medications: [{ name: "Warfarin", dose: "5 mg", frequency: "Once daily", critical: true }],
      conditions: [{ label: "Atrial fibrillation", major: true }],
      alerts: ["anticoagulants"],
      emergencyContact: { name: "J. Bennett", relation: "Brother", phone: "+44 7700 900 111" },
      recentDischarge: "Belfast City Hospital — A&E discharge 2025-11-14",
    },
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    ...overrides,
  };
}

describe("formatOutbound", () => {
  it("formats access grant with patient data", () => {
    const messages = formatOutbound({ outcome: makeOutcome({}), identityKind: "clinician" });
    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      expect(msg.length).toBeLessThanOrEqual(1000);
    }
    const combined = messages.join("\n");
    expect(combined).toContain("GRANTED");
    expect(combined).toContain("Sarah Bennett");
    expect(combined).toContain("Penicillin");
    expect(combined).toContain("Warfarin");
    expect(combined).toContain("anticoagulants");
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
    expect(combined).toContain("logged locally");
  });
});

describe("formatHelp", () => {
  it("lists commands", () => {
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
