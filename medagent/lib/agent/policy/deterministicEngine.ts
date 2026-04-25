import crypto from "crypto";
import {
  createApproval,
  deleteApprovalById,
  getIssuerByRequesterId,
  getPatientPolicy,
  getPatientSummary,
  updateApprovalStatus,
  updateAccessRequest,
} from "@/lib/db";
import { AgentStateType, PolicyContext } from "@/lib/agent/state";
import { PatientPolicy } from "@/lib/types";
import { addTraceStep } from "@/lib/agent/traceHelpers";

// Static tier fields allowed strings
const TIER_1_FIELDS = [
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
  "recentDischarge",
  "documents",
];
const TIER_2_FIELDS = [
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
  "documents",
];
const TIER_3_FIELDS = [
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
];

export async function runDeterministicPolicyEngine(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const { requestContext, trace } = state;
  const {
    requestId,
    patientId,
    requesterId,
    emergencyMode,
    patientApprovalPresent,
  } = requestContext;

  // 1) Deterministic inputs from local policy + registry.
  const registryEntry = await getIssuerByRequesterId(requesterId);
  const resolvedPatientPolicy = await getPatientPolicy(patientId);

  if (!resolvedPatientPolicy) {
    throw new Error(`Policy not found for patient ${patientId}`);
  }
  const patientPolicy = resolvedPatientPolicy as PatientPolicy;

  // 2) Trust/verification status is registry-driven.
  const verified = Boolean(registryEntry?.trusted);
  const canAutoAccess = verified && patientPolicy.emergencyAutoAccess;
  const canRequestApproval =
    !verified && patientPolicy.allowPatientApprovalRequests;
  const canBreakGlass = emergencyMode && patientPolicy.breakGlassAllowed;

  // 2b) Cross-system check: if the issuer is flagged as requiring patient approval
  // for cross-system access (e.g. NHS NI accessing records across health systems),
  // downgrade to Tier 2 unless emergency break-glass is active.
  const requiresCrossSystemApproval = Boolean(registryEntry?.requires_cross_system_approval);
  const isCrossJurisdiction = requiresCrossSystemApproval;

  // 3) Safety-first routing order (auditable):
  //    A. Trusted + auto-access -> Tier 1
  //    B. Patient-approved untrusted request -> Tier 2
  //    C. Awaiting patient approval path -> Tier 2 awaiting_human
  //    D. Emergency break-glass -> Tier 3
  //    E. Otherwise deny (fail closed)
  let decision: PolicyContext["decision"] = "denied";
  let tier: PolicyContext["tier"] = null;
  let fieldsAllowed: string[] = [];
  let justification = "Access denied.";

  // A) Highest-confidence path: verified requester + patient policy auto-access.
  // Cross-jurisdiction requests from verified issuers downgrade to Tier 2 unless emergencyMode.
  if (canAutoAccess && isCrossJurisdiction && !emergencyMode) {
    // A-cross) Verified but cross-jurisdiction: requires patient approval.
    if (patientApprovalPresent) {
      decision = "granted";
      tier = 2;
      fieldsAllowed = TIER_2_FIELDS;
      justification =
        "Verified clinician from trusted cross-jurisdiction issuer. Patient approval received for Tier 2 release.";
    } else {
      decision = "awaiting_human";
      tier = 2;
      fieldsAllowed = TIER_2_FIELDS;
      justification =
        "Verified clinician from trusted registry, but cross-jurisdiction access requires patient consent.";
    }
  } else if (canAutoAccess) {
    decision = "granted";
    tier = 1;
    fieldsAllowed = TIER_1_FIELDS;
    justification =
      "Verified clinician from trusted registry. Patient emergency auto-access policy permits Tier 1.";
  }
  // B) Tier 2 approval-resume path for untrusted requester.
  else if (canRequestApproval && patientApprovalPresent) {
    decision = "granted";
    tier = 2;
    fieldsAllowed = TIER_2_FIELDS;
    justification =
      "Requester not strongly verified. Patient approval received for Tier 2 release.";
  }
  // C) Request requires patient approval and not currently in break-glass mode.
  else if (canRequestApproval && !patientApprovalPresent && !emergencyMode) {
    decision = "awaiting_human";
    tier = 2;
    fieldsAllowed = TIER_2_FIELDS;
    justification =
      "Requester not strongly verified. Awaiting patient approval for Tier 2.";
  }
  // D) Break-glass only when emergency mode is asserted and policy explicitly permits.
  else if (canBreakGlass) {
    decision = "granted";
    tier = 3;
    fieldsAllowed = TIER_3_FIELDS;
    justification = "Emergency break-glass mode triggered. Tier 3 granted.";
  } else {
    // E) Explicit deny reasons for auditability.
    if (emergencyMode && !patientPolicy.breakGlassAllowed) {
      justification =
        "Emergency mode requested but break-glass is disabled by patient policy.";
    } else if (!verified && !patientPolicy.allowPatientApprovalRequests) {
      justification =
        "Requester not strongly verified and patient approval requests are disabled by policy.";
    } else if (verified && !patientPolicy.emergencyAutoAccess) {
      justification =
        "Verified requester, but patient emergency auto-access is disabled and no higher-priority path is available.";
    }
  }

  const stepSummary = `Verification: ${verified ? "Trusted" : "Untrusted"}. Decision: ${decision}. Justification: ${justification}`;

  // 4. Handle awaiting_human Approval Token dispatch (from old requestPatientApproval)
  let approvalStatus: PolicyContext["approvalStatus"] = "pending";
  if (decision === "awaiting_human") {
    const summary = await getPatientSummary(patientId);
    const method = summary?.demographics?.email ? "email" : "push";
    const approvalToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const approvalId = crypto.randomUUID();

    try {
      await createApproval({
        id: approvalId,
        requestId,
        patientId,
        token: approvalToken,
        method,
        expiresAt,
      });

      await updateAccessRequest(requestId, {
        status: "awaiting_approval",
        approvalMethod: method,
        approvalToken,
        fieldsAllowed,
      });

      approvalStatus = "pending";
    } catch (error) {
      try {
        deleteApprovalById(approvalId);
      } catch {
        // best effort cleanup for partially-created approval rows
      }
      try {
        await updateApprovalStatus(approvalToken, "expired");
      } catch {
        // best effort cleanup
      }
      throw error;
    }
  }

  const updatedTrace = addTraceStep(
    trace,
    "decideTier",
    decision === "awaiting_human" ? "awaiting_human" : "completed",
    stepSummary,
  );

  return {
    policyContext: {
      verified,
      decision,
      tier,
      fieldsAllowed,
      approvalStatus,
    },
    trace: updatedTrace,
    completedAgents: ["deterministicEngine"],
  };
}
