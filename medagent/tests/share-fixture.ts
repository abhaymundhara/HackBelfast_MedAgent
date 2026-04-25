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

export function setupFullRecordShareFixture() {
  process.env.MEDAGENT_FORCE_LOCAL_AUDIT = "1";
  resetDatabase();
  const patientId = "patient-share";
  const documentId = "report";
  const documentText = "full uploaded report";
  const summary = EmergencySummary.parse({
    patientId,
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
    documents: [{ id: documentId, title: "Medical Report", patientApprovedForTier1Or2: true }],
  });
  upsertPatient({
    patientId,
    localIdentity: "patient:patient-share",
    encryptedSummary: encryptJson(summary),
    patientHash: sha256Hash(`${patientId}:${summary.demographics.email}`),
  });
  const storagePath = writeEncryptedDocument(
    patientId,
    documentId,
    encryptBuffer(Buffer.from(documentText, "utf8")),
  );
  savePatientDocumentMetadata({
    id: documentId,
    patientId,
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
    patientId,
    slotId: "slot-share",
    doctorRegNumber: "GMC1",
    doctorName: "Dr. Share",
    doctorEmail: "share@example.test",
    clinic: "Belfast MSK",
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    symptomSummary: "knee flare",
  })!;
  return { patientId, documentId, documentText, appointment };
}

