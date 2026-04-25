import { z } from "zod";
import { AgentTrace } from "@/lib/types";
import { Annotation } from "@langchain/langgraph";

// ─────────────────────────────────────────────────────────────────────────────
// Rich Canonical Evidence Schema
// ─────────────────────────────────────────────────────────────────────────────

export const CanonicalEvidenceItemSchema = z.object({
  id: z.string(),
  patientHash: z.string(),
  content: z.string(),

  // Hard semantics for Deterministic Filtering
  authorization: z.object({
    fieldKey: z.string(),
    allowedForTiers: z.array(
      z.union([z.literal(1), z.literal(2), z.literal(3)]),
    ),
    sensitivityClass: z.enum(["standard", "sensitive", "critical_only"]),
    requiresExplicitApproval: z.boolean(),
  }),

  // Agentic Context Metadata
  sourceType: z.enum(["structured_ips", "document", "user_entered"]),
  noteType: z.string().optional(), // e.g., "discharge_summary", "lab_result"
  extractionMode: z.enum(["structured", "narrative", "derived"]),
  sensitivityTags: z.array(z.string()), // e.g., ["mental_health", "substance_abuse"]
  clinicalTags: z.array(z.string()), // e.g., ["cardiology", "allergy"]
  recencyBucket: z.enum([
    "current_admission",
    "last_30_days",
    "last_year",
    "historical",
  ]),
  language: z.string().default("en"),

  provenance: z.object({
    documentId: z.string().optional(),
    chunkIndex: z.number().optional(),
    timestamp: z.string(),
  }),

  retrieval: z
    .object({
      source: z.enum(["baseline", "rag"]),
      retryIteration: z.number().default(0),
      mode: z.enum(["balanced", "broad", "exact"]).optional(),
      query: z.string().optional(),
      queryPlanIndex: z.number().optional(),
      rank: z.number().optional(),
      score: z.number().optional(),
      bestScore: z.number().optional(),
      semanticScore: z.number().optional(),
      fusionScore: z.number().optional(),
      rerankModel: z.string().optional(),
      rerankLatencyMs: z.number().min(0).optional(),
      rerankApplied: z.boolean().optional(),
      matchedQueries: z.array(z.string()).optional(),
      sourcesSeen: z.array(z.enum(["baseline", "rag"])).optional(),
      contributingPlanIndexes: z.array(z.number().int().min(0)).optional(),
    })
    .optional(),
});

export type CanonicalEvidenceItem = z.infer<typeof CanonicalEvidenceItemSchema>;

export const RetrievalQueryPlanSchema = z.object({
  query: z.string().min(1),
  mode: z.enum(["balanced", "broad", "exact"]),
  targetFields: z.array(z.string()).optional(),
  targetNoteTypes: z.array(z.string()).optional(),
  topK: z.number().int().min(1),
});
export type RetrievalQueryPlan = z.infer<typeof RetrievalQueryPlanSchema>;

export const RetrievalExecutionRecordSchema = z.object({
  queryPlanIndex: z.number().int().min(0),
  executedQuery: z.string(),
  mode: z.enum(["balanced", "broad", "exact"]),
  targetFields: z.array(z.string()).default([]),
  targetNoteTypes: z.array(z.string()).default([]),
  topK: z.number().int().min(1),
  ragAttempted: z.boolean(),
  ragReturnedCount: z.number().int().min(0),
  countBeforeTargeting: z.number().int().min(0),
  countAfterTargeting: z.number().int().min(0),
  baselineContributedCount: z.number().int().min(0),
  ragContributedCount: z.number().int().min(0),
  lexicalReturnedCount: z.number().int().min(0).optional(),
  lexicalContributedCount: z.number().int().min(0).optional(),
  lexicalLatencyMs: z.number().min(0).optional(),
  rerankApplied: z.boolean().optional(),
  rerankInputCount: z.number().int().min(0).optional(),
  rerankLatencyMs: z.number().min(0).optional(),
  rerankModel: z.string().optional(),
  semanticTopScore: z.number().optional(),
  fusionTopScore: z.number().optional(),
  semanticReturnedCount: z.number().int().min(0).optional(),
  semanticContributedCount: z.number().int().min(0).optional(),
  semanticLatencyMs: z.number().min(0).optional(),
  fusionApplied: z.boolean().optional(),
  fusionInputCount: z.number().int().min(0).optional(),
  semanticIndexHit: z.boolean().optional(),
  semanticFailureReason: z.string().optional(),
  cacheStatus: z.enum(["fresh_hit", "stale_hit", "miss"]).optional(),
  indexStatusAtQueryTime: z
    .enum(["ready", "stale", "building", "failed", "missing"])
    .optional(),
  backgroundRefreshQueued: z.boolean().optional(),
  backgroundRefreshReason: z.string().optional(),
  cacheLookupLatencyMs: z.number().min(0).optional(),
  cacheWriteLatencyMs: z.number().min(0).optional(),
  zeroResult: z.boolean(),
});
export type RetrievalExecutionRecord = z.infer<
  typeof RetrievalExecutionRecordSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-State Schemas
// ─────────────────────────────────────────────────────────────────────────────

// 1. Immutable Request Context
export const RequestContextSchema = z.object({
  requestId: z.string(),
  patientId: z.string(),
  requesterId: z.string(),
  naturalLanguageRequest: z.string(),
  targetLocale: z.string(),
  emergencyMode: z.boolean(),
  presentedCredential: z.string().optional(),
  requesterLabel: z.string().optional(),
  issuerLabel: z.string().optional(),
  patientApprovalPresent: z.boolean().default(false),
});
export type RequestContext = z.infer<typeof RequestContextSchema>;

// 2. Policy Context (Written ONLY by DPE)
export const PolicyContextSchema = z.object({
  verified: z.boolean().default(false),
  decision: z
    .enum(["granted", "denied", "awaiting_human", "pending"])
    .default("pending"),
  tier: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .nullable()
    .default(null),
  fieldsAllowed: z.array(z.string()).default([]),
  approvalStatus: z.enum(["pending", "approved", "denied"]).optional(),
});
export type PolicyContext = z.infer<typeof PolicyContextSchema>;

// 3. Agentic Routing & Request Understanding Context
export const UnderstandingContextSchema = z.object({
  focusAreas: z.array(z.string()).default([]),
  withheldAreas: z.array(z.string()).default([]),
  ambiguityFlags: z.array(z.string()).default([]),
  suggestedStrategy: z.string().default("fallback"),
});
export type UnderstandingContext = z.infer<typeof UnderstandingContextSchema>;

// 4. Retrieval Context
export const RetrievalContextSchema = z.object({
  queryPlans: z.array(RetrievalQueryPlanSchema).default([]),
  executionLog: z.array(RetrievalExecutionRecordSchema).default([]),
  rawCandidates: z.array(CanonicalEvidenceItemSchema).default([]),
  totalBaselineCandidates: z.number().int().min(0).default(0),
  totalRagCandidates: z.number().int().min(0).default(0),
  totalSemanticCandidates: z.number().int().min(0).default(0),
  totalUniqueCandidates: z.number().int().min(0).default(0),
  patientHashUsed: z.string().optional(),
  ragUsed: z.boolean().default(false),
  semanticUsed: z.boolean().default(false),
  cacheHitCount: z.number().int().min(0).default(0),
  staleCacheServedCount: z.number().int().min(0).default(0),
  cacheMissCount: z.number().int().min(0).default(0),
  backgroundRefreshQueued: z.boolean().default(false),
  backgroundRefreshReason: z.string().optional(),
  indexStatus: z
    .enum(["ready", "stale", "building", "failed", "missing"])
    .default("missing"),
  indexFreshness: z.enum(["fresh", "stale", "missing"]).default("missing"),
  sourceFingerprint: z.string().optional(),
  optimizerApplied: z.boolean().default(false),
  optimizerProfile: z.string().default("none"),
  recommendedModeOrder: z.array(z.string()).default([]),
  recommendedTopK: z.number().int().min(0).default(0),
  retrievalProfile: z.string().default("default"),
  plannerLatencyMs: z.number().min(0).default(0),
  indexEnsureLatencyMs: z.number().min(0).default(0),
  lexicalLatencyMs: z.number().min(0).default(0),
  rerankLatencyMs: z.number().min(0).default(0),
  latencyClassification: z
    .enum(["healthy", "degraded", "budget_exceeded"])
    .default("healthy"),
  estimatedRequestCostUsd: z.number().min(0).default(0),
  costBudgetUsd: z.number().min(0).default(0.01),
  costBudgetStatus: z
    .enum(["healthy", "degraded", "budget_exceeded"])
    .default("healthy"),
  observabilitySummary: z.record(z.string(), z.unknown()).optional(),
  regressionSummary: z.record(z.string(), z.unknown()).optional(),
  retrievalMetricsSnapshotPath: z.string().optional(),
  retrievalCostDashboardPath: z.string().optional(),
  evalSnapshotPath: z.string().optional(),
  indexBuildLatencyMs: z.number().min(0).optional(),
  cacheLookupLatencyMs: z.number().min(0).default(0),
  cacheWriteLatencyMs: z.number().min(0).default(0),
  retryCount: z.number().default(0),
});
export type RetrievalContext = z.infer<typeof RetrievalContextSchema>;

// 5. Evidence Context (Written by Filter & ERA)
export const EvidenceContextSchema = z.object({
  // Canonical Evidence Items surviving the DPE Filter
  authorizedChunks: z.array(CanonicalEvidenceItemSchema).default([]),

  reviewJudgement: z
    .object({
      acceptedEvidenceIds: z.array(z.string()),
      rejectedEvidenceIds: z.array(z.string()),
      rejectionReasons: z.record(z.string(), z.string()), // map ID -> Reason
      missingCategories: z.array(z.string()),
      partialAnswerViable: z.boolean(),
      confidence: z.enum(["high", "medium", "low"]),
      worthAnotherRetrievalPass: z.boolean(),
      clarificationIsBetter: z.boolean(),
      retrievalGapType: z.enum([
        "none",
        "recoverable",
        "out_of_scope",
        "policy_blocked",
      ]),
      semanticSufficiency: z.boolean(),
      zeroResultPlanCount: z.number().int().min(0).optional(),
      heavilyPrunedPlanCount: z.number().int().min(0).optional(),
      retrievalDiagnostic: z.string().optional(),
      retrievalBreadthScore: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
export type EvidenceContext = z.infer<typeof EvidenceContextSchema>;

// 6. Final Response Context (Written by Synthesizer)
export const ResponseContextSchema = z.object({
  answerStatus: z
    .enum([
      "pending",
      "complete",
      "partial",
      "clarification_needed",
      "policy_blocked",
    ])
    .default("pending"),
  clarificationQuestion: z.string().optional(),
  clinicianBrief: z.string().optional(),
  citedEvidenceIds: z.array(z.string()).optional(),
  unsupportedClaims: z.array(z.string()).optional(),
  sessionToken: z.string().optional(),
});
export type ResponseContext = z.infer<typeof ResponseContextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Top-Level StateGraph Annotation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The unified agent state for LangGraph, merging all partitioned contexts.
 * Reducers are simple object merges or direct overwrites to avoid deep-cloning bugs.
 */
export const AgentState = Annotation.Root({
  requestContext: Annotation<RequestContext>({
    reducer: (_, next) => next,
    default: () => ({
      requestId: "",
      patientId: "",
      requesterId: "",
      naturalLanguageRequest: "",
      targetLocale: "en",
      emergencyMode: false,
      patientApprovalPresent: false,
    }),
  }),

  policyContext: Annotation<PolicyContext>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({
      verified: false,
      decision: "pending",
      tier: null,
      fieldsAllowed: [],
    }),
  }),

  understandingContext: Annotation<UnderstandingContext>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({
      focusAreas: [],
      withheldAreas: [],
      ambiguityFlags: [],
      suggestedStrategy: "fallback",
    }),
  }),

  retrievalContext: Annotation<RetrievalContext>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({
      queryPlans: [],
      executionLog: [],
      rawCandidates: [],
      totalBaselineCandidates: 0,
      totalRagCandidates: 0,
      totalSemanticCandidates: 0,
      totalUniqueCandidates: 0,
      ragUsed: false,
      semanticUsed: false,
      cacheHitCount: 0,
      staleCacheServedCount: 0,
      cacheMissCount: 0,
      backgroundRefreshQueued: false,
      indexStatus: "missing",
      indexFreshness: "missing",
      optimizerApplied: false,
      optimizerProfile: "none",
      recommendedModeOrder: [],
      recommendedTopK: 0,
      retrievalProfile: "default",
      plannerLatencyMs: 0,
      indexEnsureLatencyMs: 0,
      lexicalLatencyMs: 0,
      rerankLatencyMs: 0,
      latencyClassification: "healthy",
      cacheLookupLatencyMs: 0,
      cacheWriteLatencyMs: 0,
      retryCount: 0,
      estimatedRequestCostUsd: 0,
      costBudgetUsd: 0.01,
      costBudgetStatus: "healthy" as const,
    }),
  }),

  evidenceContext: Annotation<EvidenceContext>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({
      authorizedChunks: [],
    }),
  }),

  responseContext: Annotation<ResponseContext>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({
      answerStatus: "pending",
    }),
  }),

  // Maintains execution step tracking across nodes.
  completedAgents: Annotation<string[]>({
    reducer: (prev, next) => [...new Set([...prev, ...next])],
    default: () => [],
  }),

  trace: Annotation<AgentTrace>({
    reducer: (_, next) => next,
    default: () => ({
      requestId: "",
      patientId: "",
      requesterId: "",
      requesterLabel: null,
      issuerLabel: null,
      steps: [],
    }),
  }),
});

export type AgentStateType = typeof AgentState.State;
