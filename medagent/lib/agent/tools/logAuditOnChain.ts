import { sha256Hash } from "@/lib/crypto";
import { getPatientRow } from "@/lib/db";
import { solanaAuditStore } from "@/lib/solana/auditStore";
import {
  AuditEvent,
  AuditEventSchema,
  AuditEventType,
  AuditWriteResult,
} from "@/lib/types";

function mapDecision(decision: "granted" | "denied" | "awaiting_human") {
  if (decision === "granted") {
    return "allow";
  }
  if (decision === "awaiting_human") {
    return null;
  }
  return "deny";
}

export function buildAuditEvent(input: {
  eventType: AuditEventType;
  requestId: string;
  patientId: string;
  requesterId: string;
  decision: "granted" | "denied" | "awaiting_human";
  tokenExpiry: string | null;
  jurisdiction: string;
  interactionType?: string;
  summaryHash?: string;
  fieldsAccessed?: string;
  durationSeconds?: number;
}) {
  const patient = getPatientRow(input.patientId);
  if (!patient) {
    throw new Error("Patient record not found");
  }

  return AuditEventSchema.parse({
    event_type: input.eventType,
    request_id: input.requestId,
    doctor_hash: sha256Hash(input.requesterId),
    patient_hash: patient.patient_hash,
    jurisdiction: input.jurisdiction,
    decision:
      input.eventType === "access_requested"
        ? null
        : mapDecision(input.decision),
    token_expiry: input.tokenExpiry,
    timestamp: new Date().toISOString(),
    interaction_type: input.interactionType,
    summary_hash: input.summaryHash,
    fields_accessed: input.fieldsAccessed,
    duration_seconds: input.durationSeconds,
  } satisfies AuditEvent);
}

export async function logAuditOnChain(input: {
  requestId: string;
  patientId: string;
  event: AuditEvent;
}): Promise<AuditWriteResult> {
  // Anchor gives us typed instruction args plus a PDA-backed append log instead of opaque audit blobs.
  return solanaAuditStore.writeAuditEvent(input);
}
