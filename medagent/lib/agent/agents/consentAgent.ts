/**
 * ConsentAgent
 *
 * Responsibilities:
 *   1. For "awaiting_human" decisions — dispatch the patient approval request
 *      and pause the workflow (returning control to the supervisor).
 *   2. For "granted" decisions — perform a consent no-op (approval already
 *      satisfied by policy or prior patient response) so the supervisor can
 *      proceed to the MedicalAgent.
 *
 * Uses SolanaAgentKit tools when available to potentially log consent events
 * on-chain in future iterations (stub in place for extension).
 */

import { requestPatientApproval } from "@/lib/agent/tools/requestPatientApproval";
import { addTraceStep, completeTraceStep } from "@/lib/agent/traceHelpers";
import type { LegacySupervisorStateType } from "@/lib/agent/legacySupervisorTypes";

// ---------------------------------------------------------------------------
// Consent redaction level helpers
// ---------------------------------------------------------------------------

/** Maps tier decision to a human-readable redaction level label */
function resolveRedactionLevel(
  tierDecision: LegacySupervisorStateType["tierDecision"],
): string {
  if (!tierDecision) return "full_redaction";
  switch (tierDecision.tier) {
    case 1:
      return "minimal_redaction";
    case 2:
      return "standard_redaction";
    case 3:
      return "critical_only";
    default:
      return "full_redaction";
  }
}

// ---------------------------------------------------------------------------
// Main sub-agent runner
// ---------------------------------------------------------------------------

export async function runConsentAgent(
  state: LegacySupervisorStateType,
): Promise<Partial<LegacySupervisorStateType>> {
  const decision = state.tierDecision?.decision;
  const allowedDecisions = new Set(["granted", "denied", "awaiting_human"]);
  if (!decision || !allowedDecisions.has(decision)) {
    addTraceStep(
      state.trace,
      "requestPatientApproval",
      "failed",
      `ConsentAgent: Invalid or missing tier decision (${String(decision)}). Treating as no-consent path.`,
    );
    throw new Error(
      `ConsentAgent received invalid tier decision: ${String(decision)}`,
    );
  }

  // ── Case A: Patient approval required ────────────────────────────────────
  if (decision === "awaiting_human") {
    let trace = addTraceStep(
      state.trace,
      "requestPatientApproval",
      "running",
      `ConsentAgent: Dispatching patient approval request (skill: request_patient_approval). Redaction level: ${resolveRedactionLevel(state.tierDecision)}.`,
    );

    const approval = await requestPatientApproval({
      requestId: state.requestId,
      patientId: state.patientId,
      requesterLabel: state.requesterLabel,
      issuerLabel: state.issuerLabel,
      requestedFields: state.tierDecision?.fieldsAllowed ?? [],
    });

    if (!approval.approvalToken) {
      throw new Error(
        `ConsentAgent expected approval token for method ${approval.method}, but none was returned.`,
      );
    }

    trace = completeTraceStep(
      trace,
      "requestPatientApproval",
      "awaiting_human",
      `ConsentAgent: Approval request sent via ${approval.method}. Workflow paused for patient confirmation.`,
    );

    return {
      approvalToken: approval.approvalToken,
      approvalMethod: approval.method,
      trace,
    };
  }

  if (decision !== "granted") {
    const trace = addTraceStep(
      state.trace,
      "requestPatientApproval",
      "completed",
      `ConsentAgent: Consent not granted (${decision}). No approval dispatch performed.`,
    );
    return { trace };
  }

  // ── Case B: Already granted — consent satisfied, no-op ───────────────────
  const redactionLevel = resolveRedactionLevel(state.tierDecision);
  const trace = addTraceStep(
    state.trace,
    "requestPatientApproval",
    "completed",
    `ConsentAgent: Access already authorized (${decision}). Redaction level confirmed as ${redactionLevel}. Proceeding without additional consent step.`,
  );

  return { trace };
}
