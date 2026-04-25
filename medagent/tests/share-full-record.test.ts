import { beforeEach, describe, expect, it } from "vitest";

import { createShareRecord } from "@/lib/sharing/createShare";
import { accessSharedRecord } from "@/lib/sharing/accessShare";
import {
  createAppointment,
  resetDatabase,
  savePatientDocumentMetadata,
  upsertAppointmentSlot,
  upsertPatient,
  writeEncryptedDocument,
} from "@/lib/db";
import { encryptBuffer, encryptJson, sha256Hash } from "@/lib/crypto";
import { EmergencySummary } from "@/lib/types";

const summary = EmergencySummary.parse({
  patientId: "patient-share",
  demographics: {
    name: "Patient Share",
    dob: "1990-01-01",
    sex: "other",
    languages: ["English"],
    homeCountry: "Ireland",
    homeJurisdiction: "ROI",
    email: "patient.share@example.test",
  },
  allergies: [{ substance: "Penicillin", severity: "severe" }],
  medications: [],
  conditions: [{ label: "Recurring knee injury", major: false }],
  alerts: [],
  emergencyContact: { name: "Contact", relation: "Friend", phone: "+3531" },
  documents: [{ id: "report", title: "Medical Report", patientApprovedForTier1Or2: true }],
});

function setupPatientWithAppointment() {
  resetDatabase();
  upsertPatient({
    patientId: summary.patientId,
    localIdentity: "patient:patient-share",
    encryptedSummary: encryptJson(summary),
    patientHash: sha256Hash(`${summary.patientId}:${summary.demographics.email}`),
  });
  const storagePath = writeEncryptedDocument(
    summary.patientId,
    "report",
    encryptBuffer(Buffer.from("full uploaded report", "utf8")),
  );
  savePatientDocumentMetadata({
    id: "report",
    patientId: summary.patientId,
    title: "Medical Report",
    mimeType: "application/pdf",
    storagePath,
    patientApproved: true,
  });
  upsertAppointmentSlot({
    id: "slot-share",
    doctorRegNumber: "GMC1",
    doctorName: "Dr. Share",
    doctorEmail: "share@example.test",
    specialty: "MSK",
    clinic: "Belfast MSK",
    jurisdiction: "NI",
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reasonTags: ["knee"],
  });
  const appointment = createAppointment({
    id: "appointment-share",
    patientId: summary.patientId,
    slotId: "slot-share",
    doctorRegNumber: "GMC1",
    doctorName: "Dr. Share",
    doctorEmail: "share@example.test",
    clinic: "Belfast MSK",
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    symptomSummary: "knee flare",
  });
  return appointment!;
}

function tokenFromShareUrl(shareUrl: string) {
  return new URL(`http://localhost${shareUrl}`).hash.replace("#token=", "");
}

describe("full-record shares", () => {
  beforeEach(() => {
    process.env.MEDAGENT_FORCE_LOCAL_AUDIT = "1";
  });

  it("creates a full-record share with appointment scope and document descriptors", async () => {
    const appointment = setupPatientWithAppointment();

    const share = await createShareRecord({
      patientId: summary.patientId,
      doctorName: appointment.doctorName,
      doctorEmail: appointment.doctorEmail,
      fieldsToShare: [],
      ttlHours: 24,
      shareScope: "full_record",
      appointmentId: appointment.id,
    });

    expect(share.shareUrl).toMatch(/^\/share\/.+#token=/);
    const access = await accessSharedRecord({
      shareId: share.shareId,
      accessToken: tokenFromShareUrl(share.shareUrl),
    });

    expect(access.ok).toBe(true);
    if (access.ok) {
      expect(access.data.shareScope).toBe("full_record");
      expect(access.data.appointment?.id).toBe(appointment.id);
      expect(access.data.fields.conditions?.[0]?.label).toBe("Recurring knee injury");
      expect(access.data.documents[0]).toMatchObject({
        id: "report",
        title: "Medical Report",
        mimeType: "application/pdf",
      });
    }
  });
});

