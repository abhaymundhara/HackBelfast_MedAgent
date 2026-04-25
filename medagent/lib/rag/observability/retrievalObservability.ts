import { z } from "zod";

import { AgentStateType } from "@/lib/agent/state";
import {
  classifyRetrievalLatency,
  getRetrievalLatencyBudgets,
  RetrievalLatencySnapshot,
} from "@/lib/rag/observability/retrievalBudget";
import { estimateRetrievalRequestCost } from "@/lib/rag/observability/retrievalCost";

export const RetrievalCacheStateSummarySchema = z.object({
  freshHitCount: z.number().int().min(0),
  staleServedCount: z.number().int().min(0),
  missCount: z.number().int().min(0),
  backgroundRefreshQueued: z.boolean(),
  backgroundRefreshReason: z.string().optional(),
});

export const RetrievalIndexFreshnessSummarySchema = z.object({
  indexStatus: z.enum(["ready", "stale", "building", "failed", "missing"]),
  indexFreshness: z.enum(["fresh", "stale", "missing"]),
  sourceFingerprint: z.string().optional(),
});

export const RetrievalObservabilitySnapshotSchema = z.object({
  requestId: z.string(),
  patientHashUsed: z.string().optional(),
  timestamp: z.string(),
  retryCount: z.number().int().min(0),
  planCount: z.number().int().min(0),
  cacheStateSummary: RetrievalCacheStateSummarySchema,
  indexFreshnessSummary: RetrievalIndexFreshnessSummarySchema,
  totalPlannerLatencyMs: z.number().min(0),
  totalLexicalLatencyMs: z.number().min(0),
  totalRerankLatencyMs: z.number().min(0),
  totalCacheLookupLatencyMs: z.number().min(0),
  totalIndexEnsureLatencyMs: z.number().min(0),
  totalCandidatesBeforeDedupe: z.number().int().min(0),
  totalUniqueCandidates: z.number().int().min(0),
  totalAuthorizedCandidates: z.number().int().min(0),
  totalAcceptedEvidence: z.number().int().min(0),
  ragUsed: z.boolean(),
  rerankApplied: z.boolean(),
  retrievalDiagnostic: z.string().optional(),
  retrievalBreadthScore: z.number().min(0).max(1).optional(),
  zeroResultPlanCount: z.number().int().min(0),
  heavilyPrunedPlanCount: z.number().int().min(0),
  plansWithRagHits: z.number().int().min(0),
  answerStatus: z.string().optional(),
  semanticSufficiency: z.boolean().optional(),
  latencyClassification: z.enum(["healthy", "degraded", "budget_exceeded"]),
  latencyBreaches: z.array(z.string()),
  estimatedRequestCostUsd: z.number().min(0),
  costBudgetUsd: z.number().min(0),
  costBudgetStatus: z.enum(["healthy", "degraded", "budget_exceeded"]),
  costBreakdownUsd: z.object({
    embedUsd: z.number().min(0),
    rerankUsd: z.number().min(0),
    judgeUsd: z.number().min(0),
    chainWriteUsd: z.number().min(0),
  }),
});

export type RetrievalObservabilitySnapshot = z.infer<
  typeof RetrievalObservabilitySnapshotSchema
>;

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function isRetrievalObservabilityEnabled() {
  return parseBoolean(
    process.env.MEDAGENT_ENABLE_RETRIEVAL_OBSERVABILITY,
    true,
  );
}

export function shouldSaveRetrievalMetrics() {
  return parseBoolean(process.env.MEDAGENT_RETRIEVAL_SAVE_METRICS, true);
}

export function isExplainHealthcheckEnabled() {
  const explicit = process.env.MEDAGENT_RETRIEVAL_HEALTHCHECK_EXPLAIN;
  if (explicit !== undefined) {
    return parseBoolean(explicit, false);
  }

  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  return nodeEnv !== "production";
}

export function buildRetrievalObservabilitySnapshot(input: {
  state: AgentStateType;
  timings: RetrievalLatencySnapshot;
  totalCandidatesBeforeDedupe: number;
  totalAuthorizedCandidates: number;
  totalAcceptedEvidence: number;
  plansWithRagHits: number;
  zeroResultPlanCount: number;
  heavilyPrunedPlanCount: number;
}): RetrievalObservabilitySnapshot {
  const { state } = input;
  const retrieval = state.retrievalContext;

  const classification = classifyRetrievalLatency(
    {
      lexicalMs: input.timings.lexicalMs,
      rerankMs: input.timings.rerankMs,
      cacheLookupMs: input.timings.cacheLookupMs,
      indexEnsureMs: input.timings.indexEnsureMs,
      totalPlannerMs: input.timings.totalPlannerMs,
    },
    getRetrievalLatencyBudgets(),
  );

  const rerankApplied = retrieval.executionLog.some((row) => row.rerankApplied);
  const costEstimate = estimateRetrievalRequestCost({
    rerankApplied,
    includeJudgeCost: false,
    includeChainWriteCost: true,
  });

  return RetrievalObservabilitySnapshotSchema.parse({
    requestId: state.requestContext.requestId,
    patientHashUsed: retrieval.patientHashUsed,
    timestamp: new Date().toISOString(),
    retryCount: retrieval.retryCount,
    planCount: retrieval.executionLog.length,
    cacheStateSummary: {
      freshHitCount: retrieval.cacheHitCount,
      staleServedCount: retrieval.staleCacheServedCount,
      missCount: retrieval.cacheMissCount,
      backgroundRefreshQueued: retrieval.backgroundRefreshQueued,
      backgroundRefreshReason: retrieval.backgroundRefreshReason,
    },
    indexFreshnessSummary: {
      indexStatus: retrieval.indexStatus,
      indexFreshness: retrieval.indexFreshness,
      sourceFingerprint: retrieval.sourceFingerprint,
    },
    totalPlannerLatencyMs: input.timings.totalPlannerMs,
    totalLexicalLatencyMs: input.timings.lexicalMs,
    totalRerankLatencyMs: input.timings.rerankMs,
    totalCacheLookupLatencyMs: input.timings.cacheLookupMs,
    totalIndexEnsureLatencyMs: input.timings.indexEnsureMs,
    totalCandidatesBeforeDedupe: input.totalCandidatesBeforeDedupe,
    totalUniqueCandidates: retrieval.totalUniqueCandidates,
    totalAuthorizedCandidates: input.totalAuthorizedCandidates,
    totalAcceptedEvidence: input.totalAcceptedEvidence,
    ragUsed: retrieval.ragUsed,
    rerankApplied,
    retrievalDiagnostic:
      state.evidenceContext.reviewJudgement?.retrievalDiagnostic,
    retrievalBreadthScore:
      state.evidenceContext.reviewJudgement?.retrievalBreadthScore,
    zeroResultPlanCount: input.zeroResultPlanCount,
    heavilyPrunedPlanCount: input.heavilyPrunedPlanCount,
    plansWithRagHits: input.plansWithRagHits,
    answerStatus: state.responseContext.answerStatus,
    semanticSufficiency:
      state.evidenceContext.reviewJudgement?.semanticSufficiency,
    latencyClassification: classification.status,
    latencyBreaches: classification.breaches,
    estimatedRequestCostUsd: costEstimate.totalUsd,
    costBudgetUsd: costEstimate.budgetUsd,
    costBudgetStatus: costEstimate.status,
    costBreakdownUsd: costEstimate.breakdown,
  });
}
