import { AgentStateType, CanonicalEvidenceItem } from "@/lib/agent/state";
import { addTraceStep } from "@/lib/agent/traceHelpers";

/**
 * Deterministic Evidence Filter
 *
 * Hard firewall separating the retrieval layers from the reasoning/synthesis layers.
 * It prevents any unauthorized chunk from passing into the Evidence Reviewer's context.
 */
export async function runEvidenceFilter(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const { policyContext, retrievalContext, trace } = state;
  const rawCandidates = retrievalContext.rawCandidates ?? [];

  // If the policy engine did not grant access, absolute deny-all.
  if (policyContext.decision !== "granted" || policyContext.tier === null) {
    return {
      evidenceContext: {
        ...state.evidenceContext,
        authorizedChunks: [],
      },
      trace: addTraceStep(
        trace,
        "validateAuthorizedEvidence",
        "completed",
        "Access not granted. Pruned all chunks deterministically.",
      ),
      completedAgents: [...(state.completedAgents ?? []), "evidenceFilter"],
    };
  }

  const currentTier = policyContext.tier;
  const fieldsAllowed = new Set(policyContext.fieldsAllowed);

  const authorizedChunks: CanonicalEvidenceItem[] = [];
  let prunedCount = 0;

  for (const chunk of rawCandidates) {
    const auth = chunk.authorization;

    // 1. Is the current assigned tier explicitly allowed for this chunk?
    if (!auth.allowedForTiers.includes(currentTier as 1 | 2 | 3)) {
      prunedCount++;
      continue;
    }

    // 2. Is this field allowed by the deterministic Policy Engine output?
    if (!fieldsAllowed.has(auth.fieldKey)) {
      prunedCount++;
      continue;
    }

    // Passed all rigorous programmatic checks
    authorizedChunks.push(chunk);
  }

  const stepSummary = `Evidence Filter processed ${rawCandidates.length} chunks. Pruned ${prunedCount}. Allowed ${authorizedChunks.length} for Tier ${currentTier}.`;

  const updatedTrace = addTraceStep(
    trace,
    "validateAuthorizedEvidence",
    "completed",
    stepSummary,
  );

  return {
    evidenceContext: {
      ...state.evidenceContext,
      authorizedChunks,
    },
    trace: updatedTrace,
    completedAgents: [...(state.completedAgents ?? []), "evidenceFilter"],
  };
}
