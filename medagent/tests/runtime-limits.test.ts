import { afterEach, describe, expect, it } from "vitest";

import { computeRetryDecision } from "@/lib/agent/policy/retryDecision";
import {
  getMaxRetrievalRetries,
  getWorkflowTimeoutMs,
} from "@/lib/agent/policy/runtimeLimits";

const ORIGINAL_MAX_RETRIES = process.env.MEDAGENT_MAX_RETRIEVAL_RETRIES;
const ORIGINAL_TIMEOUT = process.env.MEDAGENT_REQUEST_TIMEOUT_MS;

function resetEnv() {
  if (ORIGINAL_MAX_RETRIES === undefined) {
    delete process.env.MEDAGENT_MAX_RETRIEVAL_RETRIES;
  } else {
    process.env.MEDAGENT_MAX_RETRIEVAL_RETRIES = ORIGINAL_MAX_RETRIES;
  }

  if (ORIGINAL_TIMEOUT === undefined) {
    delete process.env.MEDAGENT_REQUEST_TIMEOUT_MS;
  } else {
    process.env.MEDAGENT_REQUEST_TIMEOUT_MS = ORIGINAL_TIMEOUT;
  }
}

afterEach(() => {
  resetEnv();
});

describe("runtime limits policy", () => {
  it("uses default retrieval retry cap when unset", () => {
    delete process.env.MEDAGENT_MAX_RETRIEVAL_RETRIES;
    expect(getMaxRetrievalRetries()).toBe(2);
  });

  it("applies configured retrieval retry cap for deterministic retry decisions", () => {
    process.env.MEDAGENT_MAX_RETRIEVAL_RETRIES = "3";

    const decision = computeRetryDecision({
      rawCandidateCount: 0,
      authorizedChunkCount: 0,
      acceptedEvidenceCount: 0,
      retryCount: 2,
      missingCategories: [],
      queryPlanCount: 1,
      zeroResultPlanCount: 1,
      heavilyPrunedPlanCount: 0,
      totalUniqueCandidates: 0,
      totalRagCandidates: 0,
      ragUsed: true,
      plansWithRagHits: 0,
    });

    expect(decision.worthAnotherRetrievalPass).toBe(true);
    expect(decision.retrievalGapType).toBe("recoverable");
  });

  it("uses test-safe default timeout and supports explicit override", () => {
    delete process.env.MEDAGENT_REQUEST_TIMEOUT_MS;
    expect(getWorkflowTimeoutMs()).toBe(30_000);

    process.env.MEDAGENT_REQUEST_TIMEOUT_MS = "9500";
    expect(getWorkflowTimeoutMs()).toBe(9500);
  });
});
