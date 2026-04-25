import {
  getIssuerByRequesterId,
  getPatientPolicy,
} from "@/lib/db";
import { AgentStateType, PolicyContext } from "@/lib/agent/state";
import { PatientPolicy } from "@/lib/types";
import { addTraceStep } from "@/lib/agent/traceHelpers";

// All fields are always released — no tier-based filtering.
const ALL_FIELDS = [
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
  "recentDischarge",
  "documents",
];

export async function runDeterministicPolicyEngine(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const { requestContext, trace } = state;
  const { patientId, requesterId } = requestContext;

  const registryEntry = await getIssuerByRequesterId(requesterId);
  const resolvedPatientPolicy = await getPatientPolicy(patientId);

  if (!resolvedPatientPolicy) {
    throw new Error(`Policy not found for patient ${patientId}`);
  }

  const verified = Boolean(registryEntry?.trusted);

  // Simplified model: always grant full access and audit on Solana.
  const decision: PolicyContext["decision"] = "granted";
  const tier: PolicyContext["tier"] = 1;
  const fieldsAllowed = ALL_FIELDS;
  const justification = verified
    ? "Verified clinician. Full access granted and audited on Solana."
    : "Unverified clinician. Full access granted and audited on Solana.";

  const stepSummary = `Verification: ${verified ? "Trusted" : "Untrusted"}. Decision: granted. ${justification}`;

  const updatedTrace = addTraceStep(
    trace,
    "decideTier",
    "completed",
    stepSummary,
  );

  return {
    policyContext: {
      verified,
      decision,
      tier,
      fieldsAllowed,
      approvalStatus: "pending",
    },
    trace: updatedTrace,
    completedAgents: ["deterministicEngine"],
  };
}
