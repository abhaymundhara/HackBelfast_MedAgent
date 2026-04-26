import { randomUUID } from "crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/solana/auditStore", () => ({
  solanaAuditStore: {
    writeAuditEvent: vi.fn().mockResolvedValue({
      chainRef: "local-solana:audit-failed",
      chainSequence: null,
      chainTimestamp: new Date().toISOString(),
      status: "failed",
      error: "Anchor audit write failed: Type not found: params",
    }),
  },
}));

const appointmentShareEmailSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sharing/shareEmail", () => ({
  sendAppointmentShareLinkEmail: appointmentShareEmailSpy,
}));

import { POST } from "@/app/api/imessage/webhook/route";
import {
  resetDatabase,
  savePatientDocumentMetadata,
  touchImessageUser,
  updateImessageUser,
  upsertAppointmentSlot,
  upsertPatient,
  writeEncryptedDocument,
} from "@/lib/db";
import { encryptBuffer, encryptJson, sha256Hash } from "@/lib/crypto";
import { EmergencySummary } from "@/lib/types";

const handle = "+15550002222";
const patientId = "appointment-patient";

function inboundPayload(text: string) {
  return {
    type: "new-message",
    data: {
      guid: `imsg-${randomUUID()}`,
      text,
      handle: { address: handle },
      chats: [{ guid: `iMessage;-;${handle}` }],
      isFromMe: false,
      dateCreated: Date.now(),
      attachments: [],
    },
  };
}

async function postWebhook(text: string) {
  return POST(
    new Request("http://localhost:3000/api/imessage/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inboundPayload(text)),
    }),
  );
}

function setupOnboardedPatient() {
  resetDatabase();
  delete process.env.MEDAGENT_FORCE_LOCAL_AUDIT;
  const summary = EmergencySummary.parse({
    patientId,
    demographics: {
      name: "Appointment Patient",
      dob: "1990-01-01",
      sex: "other",
      languages: ["English"],
      homeCountry: "Ireland",
      homeJurisdiction: "ROI",
      email: "appointment.patient@example.test",
    },
    allergies: [],
    medications: [],
    conditions: [{ label: "Recurring knee injury", major: false }],
    alerts: [],
    emergencyContact: { name: "Contact", relation: "Friend", phone: "+3531" },
    documents: [{ id: "report", title: "Medical Report", patientApprovedForTier1Or2: true }],
  });
  upsertPatient({
    patientId,
    localIdentity: `imessage:${handle}`,
    encryptedSummary: encryptJson(summary),
    patientHash: sha256Hash(`${patientId}:${summary.demographics.email}`),
  });
  const storagePath = writeEncryptedDocument(
    patientId,
    "report",
    encryptBuffer(Buffer.from("uploaded report", "utf8")),
  );
  savePatientDocumentMetadata({
    id: "report",
    patientId,
    title: "Medical Report",
    mimeType: "application/pdf",
    storagePath,
    patientApproved: true,
  });
  touchImessageUser(handle);
  updateImessageUser(handle, {
    stage: "onboarded",
    fullName: "Appointment Patient",
    dob: "1990-01-01",
    patientId,
  });
  upsertAppointmentSlot({
    id: "appointment-slot",
    doctorRegNumber: "GMC1",
    doctorName: "Dr. Appointment",
    doctorEmail: "appointment@example.test",
    specialty: "MSK",
    clinic: "Belfast MSK",
    jurisdiction: "NI",
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reasonTags: ["knee"],
  });
}

describe("iMessage appointment flow", () => {
  beforeEach(() => {
    setupOnboardedPatient();
    appointmentShareEmailSpy.mockResolvedValue({
      sent: true,
      to: "gulsameer1000@gmail.com",
    });
    bridgeSpies.sendText.mockResolvedValue({ messageGuid: "sent", status: "sent" });
    bridgeSpies.markChatRead.mockResolvedValue({ status: "ok" });
    bridgeSpies.showTypingIndicator.mockResolvedValue({ status: "ok" });
  });

  it("books a slot and shares the full record only after explicit consent", async () => {
    await postWebhook("My knee injury is spiking in Belfast, book a doctor");
    await postWebhook("1");
    await postWebhook("YES");

    const texts = bridgeSpies.sendText.mock.calls.map((call) => call[0].text).join("\n\n");
    expect(texts).toContain("I found these Belfast appointment slots");
    expect(texts).toContain("you're booked in!");
    expect(texts).toContain("your medical data hasn't been shared yet");
    expect(texts).toContain("done! i've shared your medical record");
    expect(texts).toContain("/share/");
    expect(texts).toContain("#token=");
    expect(texts).not.toContain("dial.to");
    expect(texts).not.toContain("blink:");
    expect(appointmentShareEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorName: "Dr. Appointment",
        patientId,
        shareUrl: expect.stringMatching(
          /^http:\/\/localhost:3000\/share\/.+#token=.+/,
        ),
      }),
    );
  });
});
