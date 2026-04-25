import { sha256Hash } from "@/lib/crypto";
import { getPatientRow, getSharedRecord, updateSharedRecordStatus } from "@/lib/db";
import { solanaAuditStore } from "@/lib/solana/auditStore";
import { AuditEventSchema } from "@/lib/types";

export async function revokeShareRecord(input: {
  shareId: string;
  patientId: string;
}): Promise<{ chainRef: string }> {
  const share = getSharedRecord(input.shareId);
  if (!share) {
    throw new Error("Share not found");
  }

  if (share.patient_id !== input.patientId) {
    throw new Error("Unauthorized: share does not belong to this patient");
  }

  if (share.status === "revoked") {
    return { chainRef: share.revoke_chain_ref ?? "" };
  }

  const patient = getPatientRow(input.patientId);

  const event = AuditEventSchema.parse({
    event_type: "share_revoked",
    request_id: share.id,
    doctor_hash: share.doctor_hash,
    patient_hash: patient?.patient_hash ?? sha256Hash(input.patientId),
    jurisdiction: "global",
    decision: "deny",
    token_expiry: null,
    timestamp: new Date().toISOString(),
    interaction_type: "revoke",
  });

  const auditResult = await solanaAuditStore.writeAuditEvent({
    requestId: share.id,
    patientId: input.patientId,
    event,
  });

  updateSharedRecordStatus(share.id, "revoked", auditResult.chainRef);

  return { chainRef: auditResult.chainRef };
}
