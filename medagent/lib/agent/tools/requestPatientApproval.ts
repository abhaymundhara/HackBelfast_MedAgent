import crypto from "crypto";

import { createApproval, getPatientSummary, updateAccessRequest } from "@/lib/db";
import { PatientApprovalResult } from "@/lib/types";

export async function requestPatientApproval(input: {
  requestId: string;
  patientId: string;
  requesterLabel: string;
  issuerLabel: string;
  requestedFields: string[];
}): Promise<PatientApprovalResult> {
  const summary = getPatientSummary(input.patientId);
  const method = summary?.demographics.email ? "email" : "push";
  const approvalToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  createApproval({
    id: crypto.randomUUID(),
    requestId: input.requestId,
    patientId: input.patientId,
    token: approvalToken,
    method,
    expiresAt,
  });

  updateAccessRequest(input.requestId, {
    status: "awaiting_approval",
    approvalMethod: method,
    approvalToken,
    fieldsAllowed: input.requestedFields,
  });

  return {
    sent: true,
    method,
    approvalToken,
  };
}
