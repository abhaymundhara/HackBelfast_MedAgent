import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bridgeSpies = vi.hoisted(() => ({
  sendText: vi.fn(),
  markChatRead: vi.fn(),
  showTypingIndicator: vi.fn(),
}));

vi.mock("@/lib/imessage/bridge", () => ({
  getBridge: () => ({
    sendText: bridgeSpies.sendText,
    markChatRead: bridgeSpies.markChatRead,
    showTypingIndicator: bridgeSpies.showTypingIndicator,
    isHealthy: vi.fn().mockResolvedValue({ healthy: true, detail: "ok" }),
  }),
}));

import { POST } from "@/app/api/imessage/webhook/route";
import {
  getImessageUser,
  getPatientPolicy,
  getPatientSummary,
  resetDatabase,
} from "@/lib/db";
import { __setPdfTextExtractorForTests } from "@/lib/imessage/medicalReportPdf";

function inboundPayload(input: {
  text?: string;
  handle?: string;
  attachments?: Array<Record<string, unknown>>;
}) {
  const handle = input.handle ?? "+15550001111";
  return {
    type: "new-message",
    data: {
      guid: `imsg-${randomUUID()}`,
      text: input.text ?? "",
      handle: { address: handle },
      chats: [{ guid: `iMessage;-;${handle}` }],
      isFromMe: false,
      dateCreated: Date.now(),
      attachments: input.attachments ?? [],
    },
  };
}

async function postWebhook(payload: unknown) {
  return POST(
    new Request("http://localhost:3000/api/imessage/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

describe("iMessage PDF onboarding", () => {
  let tempDir: string;

  beforeEach(() => {
    resetDatabase();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "medagent-pdf-test-"));
    bridgeSpies.sendText.mockResolvedValue({
      messageGuid: "sent",
      status: "sent",
    });
    bridgeSpies.markChatRead.mockResolvedValue({ status: "ok" });
    bridgeSpies.showTypingIndicator.mockResolvedValue({ status: "ok" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    __setPdfTextExtractorForTests(null);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("asks a new patient to upload a PDF immediately after activation", async () => {
    await postWebhook(inboundPayload({ text: "hey baymax!" }));

    const sentTexts = bridgeSpies.sendText.mock.calls.map((call) => call[0].text);
    expect(sentTexts).toContain(
      "hey! i'm baymax — your secure medical assistant for cross-border care on the island of ireland. everything's private and auditable on solana. why don't you send me your medical history report as a PDF and i'll get you onboarded!",
    );
    expect(getImessageUser("+15550001111")?.stage).toBe(
      "awaiting_new_user_record",
    );
  });

  it("extracts a PDF attachment, stores a patient profile, and marks onboarding complete", async () => {
    const pdfPath = path.join(tempDir, "medical-report.pdf");
    fs.writeFileSync(pdfPath, "%PDF-1.4 fake test fixture");
    __setPdfTextExtractorForTests(async () =>
      [
        "Patient Name: Niamh Kelly",
        "DOB: 1992-03-04",
        "Allergies: Penicillin - severe reaction",
        "Current medications: Warfarin 5mg daily, Salbutamol inhaler PRN",
        "Major conditions: Atrial fibrillation, Asthma",
        "Emergency contact: Maeve Kelly (Sister) +44 7700 900123",
        "Blood type: O+",
      ].join("\n"),
    );

    await postWebhook(inboundPayload({ text: "hey baymax!" }));
    await postWebhook(
      inboundPayload({
        attachments: [
          {
            path: pdfPath,
            filename: pdfPath,
            mimeType: "application/pdf",
            transferName: "medical-report.pdf",
          },
        ],
      }),
    );

    const user = getImessageUser("+15550001111");
    expect(user?.stage).toBe("onboarded");
    expect(user?.patientId).toBe("niamh-kelly-19920304");

    const summary = getPatientSummary("niamh-kelly-19920304");
    expect(summary?.demographics.name).toBe("Niamh Kelly");
    expect(summary?.allergies[0]?.substance).toContain("Penicillin");
    expect(summary?.medications.map((m) => m.name)).toContain("Warfarin");
    expect(summary?.conditions.map((c) => c.label)).toContain("Atrial fibrillation");
    expect(summary?.emergencyContact.phone).toBe("+44 7700 900123");
    expect(getPatientPolicy("niamh-kelly-19920304")?.emergencyAutoAccess).toBe(
      true,
    );
  });
});
