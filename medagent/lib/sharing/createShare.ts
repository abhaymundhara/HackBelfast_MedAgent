import crypto from "crypto";

import { decryptJson, encryptString, sha256Hash } from "@/lib/crypto";
import {
  attachShareToAppointment,
  createAccessRequest,
  createSharedRecord,
  getPatientRow,
  listPatientDocuments,
  listSharedRecords,
  readEncryptedDocument,
  updateSharedRecordShortToken,
  updateSharedRecordShareAudit,
} from "@/lib/db";
import { solanaAuditStore } from "@/lib/solana/auditStore";
import { AuditEventSchema, EmergencySummary, ReleasedField } from "@/lib/types";

const MAX_ACTIVE_SHARES = 10;
const FULL_RECORD_FIELDS: ReleasedField[] = [
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
  "recentDischarge",
  "documents",
];

function filterSummaryFields(
  summary: EmergencySummary,
  fields: ReleasedField[],
): Partial<EmergencySummary> {
  const filtered: Record<string, unknown> = {
    patientId: summary.patientId,
    demographics: { name: summary.demographics.name },
  };
  for (const field of fields) {
    if (field in summary) {
      filtered[field] = summary[field as keyof EmergencySummary];
    }
  }
  return filtered as Partial<EmergencySummary>;
}

function encryptWithShareKey(
  data: unknown,
  shareKey: Buffer,
): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", shareKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export async function createShareRecord(input: {
  patientId: string;
  doctorName: string;
  doctorEmail: string;
  fieldsToShare: ReleasedField[];
  ttlHours: number;
  shareScope?: "field_subset" | "full_record";
  appointmentId?: string | null;
}) {
  const patient = getPatientRow(input.patientId);
  if (!patient) {
    throw new Error("Patient not found");
  }

  const activeShares = listSharedRecords(input.patientId).filter(
    (s) => s.status === "active" && new Date(s.expires_at) > new Date(),
  );
  if (activeShares.length >= MAX_ACTIVE_SHARES) {
    throw new Error("Maximum active shares reached");
  }

  const summary = decryptJson<EmergencySummary>(patient.encrypted_summary);
  const shareScope = input.shareScope ?? "field_subset";
  const fieldsShared =
    shareScope === "full_record" ? FULL_RECORD_FIELDS : input.fieldsToShare;
  const filtered =
    shareScope === "full_record"
      ? summary
      : filterSummaryFields(summary, input.fieldsToShare);
  const documentDescriptors =
    shareScope === "full_record"
      ? listPatientDocuments(input.patientId)
          .filter((document) => document.patient_approved === 1)
          .map((document) => {
            const encryptedBytes = readEncryptedDocument(document.storage_path);
            return {
              id: document.id,
              title: document.title,
              mimeType: document.mime_type,
              byteHash: sha256Hash(encryptedBytes),
            };
          })
      : [];

  const shareId = crypto.randomUUID();
  const shareKey = crypto.randomBytes(32);
  const accessToken = crypto.randomBytes(32).toString("hex");
  const revokeToken = crypto.randomBytes(32).toString("hex");

  const encryptedPayload = encryptWithShareKey(filtered, shareKey);
  const encryptedShareKey = encryptString(shareKey.toString("hex"));
  const documentManifestJson =
    documentDescriptors.length > 0
      ? encryptString(JSON.stringify(documentDescriptors))
      : null;

  const documentHash = sha256Hash(encryptedPayload);
  const accessTokenHash = sha256Hash(accessToken);
  const revokeTokenHash = sha256Hash(revokeToken);
  const summaryHash = sha256Hash(accessToken + documentHash);
  const doctorHash = sha256Hash(input.doctorEmail);

  const expiresAt = new Date(
    Date.now() + input.ttlHours * 60 * 60 * 1000,
  ).toISOString();

  const event = AuditEventSchema.parse({
    event_type: "record_shared",
    request_id: shareId,
    doctor_hash: doctorHash,
    patient_hash: patient.patient_hash,
    jurisdiction: summary.demographics.homeJurisdiction ?? "global",
    decision: "allow",
    token_expiry: expiresAt,
    timestamp: new Date().toISOString(),
    interaction_type: "share",
    summary_hash: summaryHash,
    fields_accessed:
      shareScope === "full_record" ? "full_record" : fieldsShared.join(","),
    duration_seconds: input.ttlHours * 3600,
  });

  createAccessRequest({
    id: shareId,
    patientId: input.patientId,
    requesterId: input.doctorEmail,
    requesterLabel: input.doctorName,
    issuerLabel: "MedAgent share",
    naturalLanguageRequest:
      shareScope === "full_record"
        ? "Appointment-backed full medical record share"
        : "Patient-created field-scoped record share",
    emergencyMode: false,
  });

  const shortCode = crypto.randomBytes(4).toString("base64url");

  createSharedRecord({
    id: shareId,
    patientId: input.patientId,
    doctorName: input.doctorName,
    doctorEmail: input.doctorEmail,
    doctorHash,
    encryptedSummary: encryptedPayload,
    encryptedShareKey,
    fieldsShared,
    accessTokenHash,
    documentHash,
    shareScope,
    appointmentId: input.appointmentId ?? null,
    documentManifestJson,
    sharePayloadVersion: "2",
    expiresAt,
    shortCode,
    revokeTokenHash,
  });

  updateSharedRecordShortToken(shareId, accessToken);

  if (input.appointmentId) {
    attachShareToAppointment(input.appointmentId, shareId);
  }

  let chainRef: string | null = null;
  try {
    const auditResult = await solanaAuditStore.writeAuditEvent({
      requestId: shareId,
      patientId: input.patientId,
      event,
    });
    chainRef = auditResult.chainRef;
    updateSharedRecordShareAudit(
      shareId,
      auditResult.chainRef,
      auditResult.chainSequence,
    );
    if (auditResult.status !== "submitted") {
      console.warn("Share audit did not submit to Solana", {
        shareId,
        patientId: input.patientId,
        status: auditResult.status,
        error: auditResult.error,
      });
    }
  } catch (error) {
    console.warn("Share created before audit write completed", {
      shareId,
      patientId: input.patientId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const shareUrl = `/share/${shareId}#token=${accessToken}`;
  const shortUrl = `/s/${shortCode}`;

  return {
    shareId,
    shareUrl,
    shortUrl,
    chainRef,
    expiresAt,
    patientName: summary.demographics.name,
    fieldsShared,
    revokeToken,
  };
}
