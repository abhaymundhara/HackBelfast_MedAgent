import { getMaxRetrievalRetries } from "@/lib/agent/policy/runtimeLimits";

export interface RetryDecisionInput {
  rawCandidateCount: number;
  authorizedChunkCount: number;
  acceptedEvidenceCount: number;
  retryCount: number;
  missingCategories: string[];
  queryPlanCount: number;
  zeroResultPlanCount: number;
  heavilyPrunedPlanCount: number;
  totalUniqueCandidates: number;
  totalRagCandidates: number;
  ragUsed: boolean;
  plansWithRagHits: number;
}

export interface RetryDecision {
  worthAnotherRetrievalPass: boolean;
  clarificationIsBetter: boolean;
  retrievalGapType: "none" | "recoverable" | "out_of_scope" | "policy_blocked";
}

/**
 * Deterministic retrieval-control decision layer.
 *
 * This keeps retry/clarification control flow outside the LLM so model failures
 * cannot broaden evidence acceptance behavior.
 */
export function computeRetryDecision(input: RetryDecisionInput): RetryDecision {
  const maxRetries = getMaxRetrievalRetries();
  const uniqueCandidates = Math.max(
    input.totalUniqueCandidates,
    input.rawCandidateCount,
  );
  const noCandidatesRetrieved = uniqueCandidates === 0;
  const allCandidatesFiltered =
    uniqueCandidates > 0 && input.authorizedChunkCount === 0;
  const zeroAuthorizedChunks = input.authorizedChunkCount === 0;
  const acceptedNone = input.acceptedEvidenceCount === 0;
  const retryExhausted = input.retryCount >= maxRetries;

  const missingCount = input.missingCategories.length;
  const allPlansZero =
    input.queryPlanCount > 0 &&
    input.zeroResultPlanCount >= input.queryPlanCount;
  const ragNoHits = input.ragUsed && input.totalRagCandidates === 0;
  const spreadLow = input.queryPlanCount > 1 && input.plansWithRagHits <= 1;
  const targetingLossHigh =
    input.queryPlanCount > 0 &&
    input.heavilyPrunedPlanCount >= Math.ceil(input.queryPlanCount * 0.6);

  if (
    allCandidatesFiltered ||
    (zeroAuthorizedChunks && !noCandidatesRetrieved)
  ) {
    return {
      worthAnotherRetrievalPass: false,
      clarificationIsBetter: true,
      retrievalGapType: "policy_blocked",
    };
  }

  if (noCandidatesRetrieved || allPlansZero || ragNoHits) {
    return {
      worthAnotherRetrievalPass: !retryExhausted,
      clarificationIsBetter: retryExhausted,
      retrievalGapType: retryExhausted ? "out_of_scope" : "recoverable",
    };
  }

  if (acceptedNone) {
    const shouldRetry = !retryExhausted && (targetingLossHigh || spreadLow);
    return {
      worthAnotherRetrievalPass: shouldRetry,
      clarificationIsBetter: !shouldRetry,
      retrievalGapType: shouldRetry ? "recoverable" : "out_of_scope",
    };
  }

  if (missingCount > 0) {
    const shouldRetry =
      !retryExhausted && (spreadLow || input.acceptedEvidenceCount < 2);
    return {
      worthAnotherRetrievalPass: shouldRetry,
      clarificationIsBetter: !shouldRetry && retryExhausted,
      retrievalGapType: shouldRetry
        ? "recoverable"
        : retryExhausted
          ? "out_of_scope"
          : "none",
    };
  }

  return {
    worthAnotherRetrievalPass: false,
    clarificationIsBetter: false,
    retrievalGapType: "none",
  };
}
