import { afterEach, describe, expect, it } from "vitest";

import type { MedAgentOutcome } from "@/lib/types";

import {
  formatAck,
  formatApprovalPrompt,
  formatFollowUpAnswer,
  formatHelp,
  formatOutbound,
  formatPatientConfirmation,
} from "../outbound";

function makeOutcome(overrides: Partial<MedAgentOutcome>): MedAgentOutcome {
  return {
    requestId: "req_test123",
    patientId: "sarah-bennett",
    requesterId: "dr-murphy",
    decision: "granted",
    tier: 1,
    ttlSeconds: 1800,
    fieldsAllowed: [
      "allergies",
      "medications",
      "conditions",
      "alerts",
      "emergencyContact",
      "recentDischarge",
      "documents",
    ],
    justification: "Full access granted and audited on Solana.",
    trace: {
      requestId: "req_test123",
      patientId: "sarah-bennett",
      requesterId: "dr-murphy",
      steps: [],
    },
    auditLog: {
      chainRef: "5xYzAbc123",
      chainSequence: 12345,
      chainTimestamp: new Date().toISOString(),
      status: "submitted",
    },
    summarySubset: {
      demographics: {
        name: "Sarah Bennett",
        dob: "1991-08-14",
        sex: "female",
        bloodType: "O-",
        homeCountry: "United Kingdom",
      },
      allergies: [
        {
          substance: "Penicillin",
          severity: "life-threatening",
          reaction: "Anaphylaxis",
        },
      ],
      medications: [
        {
          name: "Warfarin",
          dose: "5 mg",
          frequency: "Once daily",
          critical: true,
        },
      ],
      conditions: [{ label: "Atrial fibrillation", major: true }],
      alerts: ["anticoagulants"],
      emergencyContact: {
        name: "J. Bennett",
        relation: "Brother",
        phone: "+44 7700 900 111",
      },
      recentDischarge: "Belfast City Hospital — A&E discharge 2025-11-14",
    },
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    ...overrides,
  };
}

describe("formatOutbound", () => {
  it("formats access grant with patient data", () => {
    const messages = formatOutbound({
      outcome: makeOutcome({}),
      identityKind: "clinician",
    });
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
    const messages = formatOutbound({
      outcome: makeOutcome({}),
      identityKind: "clinician",
    });
    const combined = messages.join("\n");
    expect(combined).toContain("solscan.io/tx/");
    expect(combined).toContain("cluster=devnet");
  });

  it("omits Solscan URL for local chain refs", () => {
    const messages = formatOutbound({
      outcome: makeOutcome({
        auditLog: {
          chainRef: "local-solana:req_123:1234567890",
          chainSequence: null,
          chainTimestamp: null,
          status: "skipped_missing_config",
        },
      }),
      identityKind: "clinician",
    });
    const combined = messages.join("\n");
    expect(combined).not.toContain("solscan.io");
    expect(combined).toContain("logged locally");
  });

  it("formats demographics languages defensively", () => {
    const arrayMessages = formatOutbound({
      outcome: makeOutcome({
        summarySubset: {
          demographics: {
            name: "Sarah Bennett",
            dob: "1991-08-14",
            languages: ["English", 42, "Irish"],
          },
        },
      }),
      identityKind: "clinician",
    });
    expect(arrayMessages.join("\n")).toContain("Languages: English, Irish");

    const stringMessages = formatOutbound({
      outcome: makeOutcome({
        summarySubset: {
          demographics: {
            name: "Sarah Bennett",
            dob: "1991-08-14",
            languages: "English",
          },
        },
      }),
      identityKind: "clinician",
    });
    expect(stringMessages.join("\n")).toContain("Languages: English");

    const invalidMessages = formatOutbound({
      outcome: makeOutcome({
        summarySubset: {
          demographics: {
            name: "Sarah Bennett",
            dob: "1991-08-14",
            languages: { primary: "English" },
          },
        },
      }),
      identityKind: "clinician",
    });
    expect(invalidMessages.join("\n")).not.toContain("Languages:");
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
    expect(text).toContain("Dr. Chidi Okonkwo");
    expect(text).toContain("req_short");
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
    expect(text).toContain("Dr. Chidi Okonkwo");
    expect(text).toContain("/audit/sarah-bennett");
  });
});

describe("formatHelp", () => {
  const originalActivationKeyword = process.env.IMESSAGE_ACTIVATION_KEYWORD;

  afterEach(() => {
    if (originalActivationKeyword === undefined) {
      delete process.env.IMESSAGE_ACTIVATION_KEYWORD;
    } else {
      process.env.IMESSAGE_ACTIVATION_KEYWORD = originalActivationKeyword;
    }
  });

  it("lists slash commands", () => {
    const text = formatHelp();
    expect(text).toContain("/access");
    expect(text).toContain("/help");
  });

  it("uses the shared normalized activation keyword", () => {
    process.env.IMESSAGE_ACTIVATION_KEYWORD = "  HEY BAYMAX!  ";

    expect(formatHelp()).toContain("Wake word: hey baymax!");
  });
});

describe("formatAck", () => {
  it("returns ack message", () => {
    expect(formatAck()).toContain("working");
  });
});

describe("formatFollowUpAnswer", () => {
  it("formats follow-up answer", () => {
    const text = formatFollowUpAnswer({
      sessionId: "sess_1",
      answer: "The patient takes warfarin.",
      citedFields: ["medications"],
    });
    expect(text).toContain("warfarin");
    expect(text).toContain("medications");
  });
});
