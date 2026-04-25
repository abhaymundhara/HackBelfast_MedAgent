import { PatientPolicy, ReleasedField, TierDecision } from "@/lib/types";

const TIER_1_FIELDS: ReleasedField[] = [
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
  "recentDischarge",
  "documents",
];

const TIER_2_FIELDS: ReleasedField[] = [
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
  "documents",
];

const TIER_3_FIELDS: ReleasedField[] = [
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
];

export async function decideTier(input: {
  verified: boolean;
  patientPolicy: PatientPolicy;
  patientApprovalPresent: boolean;
  emergencyMode: boolean;
}): Promise<TierDecision> {
  if (
    input.verified &&
    input.patientPolicy.emergencyAutoAccess &&
    !input.emergencyMode
  ) {
    return {
      decision: "granted",
      tier: 1,
      ttlSeconds: 30 * 60,
      fieldsAllowed: TIER_1_FIELDS,
      justification:
        "Verified clinician from trusted registry. Patient enabled emergency auto-access. Tier 1 granted.",
    };
  }

  if (
    !input.verified &&
    input.patientPolicy.allowPatientApprovalRequests &&
    input.patientApprovalPresent
  ) {
    return {
      decision: "granted",
      tier: 2,
      ttlSeconds: 15 * 60,
      fieldsAllowed: TIER_2_FIELDS,
      justification:
        "Requester is not strongly verified, but patient approval was received. Tier 2 granted for a narrower summary subset.",
    };
  }

  if (
    !input.verified &&
    input.patientPolicy.allowPatientApprovalRequests &&
    !input.patientApprovalPresent &&
    !input.emergencyMode
  ) {
    return {
      decision: "awaiting_human",
      tier: 2,
      ttlSeconds: 15 * 60,
      fieldsAllowed: TIER_2_FIELDS,
      justification:
        "Requester is not strongly verified. Patient approval is required before Tier 2 access can be granted.",
    };
  }

  if (input.emergencyMode && input.patientPolicy.breakGlassAllowed) {
    return {
      decision: "granted",
      tier: 3,
      ttlSeconds: 20 * 60,
      fieldsAllowed: TIER_3_FIELDS,
      justification:
        "Emergency break-glass mode was triggered while patient response was unavailable. Policy allows Tier 3 critical-only access.",
    };
  }

  return {
    decision: "denied",
    tier: null,
    ttlSeconds: 0,
    fieldsAllowed: [],
    justification:
      "No trusted verification path, no approved patient-authorized path, and no permitted break-glass path were available. Access denied.",
  };
}
