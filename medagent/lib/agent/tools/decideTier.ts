import { PatientPolicy, ReleasedField, TierDecision } from "@/lib/types";

const ALL_FIELDS: ReleasedField[] = [
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
  "recentDischarge",
  "documents",
];

export async function decideTier(input: {
  verified: boolean;
  patientPolicy: PatientPolicy;
  patientApprovalPresent: boolean;
  emergencyMode: boolean;
}): Promise<TierDecision> {
  // Simplified: always grant full access. Audit on Solana.
  return {
    decision: "granted",
    tier: 1,
    ttlSeconds: 30 * 60,
    fieldsAllowed: ALL_FIELDS,
    justification: input.verified
      ? "Verified clinician. Full access granted and audited on Solana."
      : "Unverified clinician. Full access granted and audited on Solana.",
  };
}
