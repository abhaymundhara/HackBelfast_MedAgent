import crypto from "crypto";

import { decryptBuffer, decryptString, sha256Hash } from "@/lib/crypto";
import {
  getAppointment,
  getDocumentForPatient,
  getPatientRow,
  getSharedRecord,
  incrementSharedRecordAccess,
  readEncryptedDocument,
} from "@/lib/db";
import { solanaAuditStore } from "@/lib/solana/auditStore";
import { getSolscanTxUrl } from "@/lib/solana/client";
import { AuditEventSchema, EmergencySummary } from "@/lib/types";

function decryptWithShareKey(
  encryptedPayload: string,
  shareKeyHex: string,
): unknown {
  const shareKey = Buffer.from(shareKeyHex, "hex");
  const payload = Buffer.from(encryptedPayload, "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", shareKey, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

export type ShareAccessError =
  | { code: "not_found"; message: string }
  | { code: "revoked"; message: string; revokeChainRef: string | null }
  | { code: "expired"; message: string }
  | { code: "rate_limited"; message: string }
  | { code: "invalid_token"; message: string };

export type ShareAccessResult = {
  patientName: string;
  fields: Partial<EmergencySummary>;
  fieldsShared: string[];
  shareScope: string;
  appointment: {
    id: string;
    doctorName: string;
    clinic: string;
    startsAt: string;
  } | null;
  documents: Array<{
    id: string;
    title: string;
    mimeType: string;
    byteHash: string;
    downloadUrl: string;
  }>;
  sharedAt: string;
  expiresAt: string;
  doctorName: string;
  solscanUrl: string | null;
  shareChainRef: string | null;
};

export async function accessSharedRecord(input: {
  shareId: string;
  accessToken: string;
}): Promise<
  { ok: true; data: ShareAccessResult } | { ok: false; error: ShareAccessError }
> {
  const share = getSharedRecord(input.shareId);
  if (!share) {
    return { ok: false, error: { code: "not_found", message: "Share not found" } };
  }

  if (share.status === "revoked") {
    return {
      ok: false,
      error: {
        code: "revoked",
        message: "Access has been revoked by the patient",
        revokeChainRef: share.revoke_chain_ref,
      },
    };
  }

  if (new Date(share.expires_at) <= new Date()) {
    return { ok: false, error: { code: "expired", message: "Share link has expired" } };
  }

  if (share.access_count >= share.max_access_count) {
    return {
      ok: false,
      error: { code: "rate_limited", message: "Maximum view count reached" },
    };
  }

  const tokenHash = sha256Hash(input.accessToken);
  if (tokenHash !== share.access_token_hash) {
    return {
      ok: false,
      error: { code: "invalid_token", message: "Invalid access token" },
    };
  }

  const shareKeyHex = decryptString(share.encrypted_share_key);
  const decryptedFields = decryptWithShareKey(
    share.encrypted_summary,
    shareKeyHex,
  ) as Partial<EmergencySummary>;

  const patient = getPatientRow(share.patient_id);

  const event = AuditEventSchema.parse({
    event_type: "record_accessed",
    request_id: share.id,
    doctor_hash: share.doctor_hash,
    patient_hash: patient?.patient_hash ?? sha256Hash(share.patient_id),
    jurisdiction: "global",
    decision: "allow",
    token_expiry: null,
    timestamp: new Date().toISOString(),
    interaction_type: "access",
    fields_accessed: share.fields_shared,
  });

  const auditResult = await solanaAuditStore.writeAuditEvent({
    requestId: share.id,
    patientId: share.patient_id,
    event,
  });

  incrementSharedRecordAccess(share.id, auditResult.chainRef);

  const isLocal = share.share_chain_ref?.startsWith("local-solana:") ?? true;
  const solscanUrl =
    share.share_chain_ref && !isLocal
      ? getSolscanTxUrl(share.share_chain_ref)
      : null;

  const fieldsShared: string[] = JSON.parse(share.fields_shared);
  const shareScope = share.share_scope ?? "field_subset";
  const manifest = share.document_manifest_json
    ? (JSON.parse(decryptString(share.document_manifest_json)) as Array<{
        id: string;
        title: string;
        mimeType: string;
        byteHash: string;
      }>)
    : [];
  const appointment = share.appointment_id
    ? getAppointment(share.appointment_id)
    : null;

  return {
    ok: true,
    data: {
      patientName:
        (decryptedFields.demographics as { name?: string } | undefined)?.name ??
        "Unknown",
      fields: decryptedFields,
      fieldsShared,
      shareScope,
      appointment: appointment
        ? {
            id: appointment.id,
            doctorName: appointment.doctorName,
            clinic: appointment.clinic,
            startsAt: appointment.startsAt,
          }
        : null,
      documents: manifest.map((document) => ({
        ...document,
        downloadUrl: `/api/share/${share.id}/documents/${document.id}?token=${encodeURIComponent(input.accessToken)}`,
      })),
      sharedAt: share.created_at,
      expiresAt: share.expires_at,
      doctorName: share.doctor_name,
      solscanUrl,
      shareChainRef: share.share_chain_ref,
    },
  };
}

export async function accessSharedDocument(input: {
  shareId: string;
  documentId: string;
  accessToken: string;
}): Promise<
  | {
      ok: true;
      data: { bytes: Buffer; mimeType: string; title: string };
    }
  | { ok: false; error: ShareAccessError }
> {
  const share = getSharedRecord(input.shareId);
  if (!share) {
    return { ok: false, error: { code: "not_found", message: "Share not found" } };
  }
  if (share.status === "revoked") {
    return {
      ok: false,
      error: {
        code: "revoked",
        message: "Access has been revoked by the patient",
        revokeChainRef: share.revoke_chain_ref,
      },
    };
  }
  if (new Date(share.expires_at) <= new Date()) {
    return { ok: false, error: { code: "expired", message: "Share link has expired" } };
  }
  if (share.access_count >= share.max_access_count) {
    return {
      ok: false,
      error: { code: "rate_limited", message: "Maximum view count reached" },
    };
  }
  if (sha256Hash(input.accessToken) !== share.access_token_hash) {
    return {
      ok: false,
      error: { code: "invalid_token", message: "Invalid access token" },
    };
  }
  if ((share.share_scope ?? "field_subset") !== "full_record") {
    return { ok: false, error: { code: "not_found", message: "Document not shared" } };
  }

  const manifest = share.document_manifest_json
    ? (JSON.parse(decryptString(share.document_manifest_json)) as Array<{
        id: string;
      }>)
    : [];
  if (!manifest.some((document) => document.id === input.documentId)) {
    return { ok: false, error: { code: "not_found", message: "Document not shared" } };
  }
  const document = getDocumentForPatient(share.patient_id, input.documentId);
  if (!document || document.patient_approved !== 1) {
    return { ok: false, error: { code: "not_found", message: "Document not found" } };
  }
  const encryptedBytes = readEncryptedDocument(document.storage_path);
  return {
    ok: true,
    data: {
      bytes: decryptBuffer(encryptedBytes),
      mimeType: document.mime_type,
      title: document.title,
    },
  };
}
