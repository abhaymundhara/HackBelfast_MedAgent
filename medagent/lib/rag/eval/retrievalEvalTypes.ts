import { z } from "zod";

export const GoldEvidenceTargetSchema = z.object({
  evidenceId: z.string(),
  fieldKey: z.string().optional(),
  noteType: z.string().optional(),
  gain: z.number().min(0).max(1).optional(),
});
export type GoldEvidenceTarget = z.infer<typeof GoldEvidenceTargetSchema>;

export const GoldRetrievalExampleSchema = z.object({
  id: z.string(),
  naturalLanguageRequest: z.string().min(1),
  patientHash: z.string().min(1),
  expectedFieldKeys: z.array(z.string()).default([]),
  expectedNoteTypes: z.array(z.string()).default([]),
  expectedEvidenceIds: z.array(z.string()).default([]),
  expectedTargets: z.array(GoldEvidenceTargetSchema).default([]),
  minAcceptableTopKRecall: z.number().min(0).max(1).optional(),
  metadataTags: z.array(z.string()).optional(),
});
export type GoldRetrievalExample = z.infer<typeof GoldRetrievalExampleSchema>;

export const EvalModeSchema = z.enum([
  "lexical_only",
  "lexical_plus_rerank",
  "cached",
  "cold_start",
]);
export type EvalMode = z.infer<typeof EvalModeSchema>;

export const PlannerConfigSchema = z.object({
  enablePlanOptimizer: z.boolean().default(false),
  optimizerProfile: z
    .enum(["auto", "precision_first", "balanced", "recall_first"])
    .default("auto"),
  forceDisableRerank: z.boolean().default(false),
});
export type PlannerConfig = z.infer<typeof PlannerConfigSchema>;

export const EvalRunConfigSchema = z.object({
  runId: z.string(),
  mode: EvalModeSchema,
  topK: z.number().int().min(1).max(50).default(5),
  includePerPlanMetrics: z.boolean().default(true),
  plannerConfig: PlannerConfigSchema.default({
    enablePlanOptimizer: false,
    optimizerProfile: "auto",
    forceDisableRerank: false,
  }),
  baselinePlannerConfig: PlannerConfigSchema.optional(),
  candidatePlannerConfig: PlannerConfigSchema.optional(),
});
export type EvalRunConfig = z.infer<typeof EvalRunConfigSchema>;

export const EvalPerPlanMetricsSchema = z.object({
  queryPlanIndex: z.number().int().min(0),
  mode: z.enum(["balanced", "broad", "exact"]),
  topK: z.number().int().min(1),
  recallAtK: z.number().min(0).max(1),
  precisionAtK: z.number().min(0).max(1),
  mrr: z.number().min(0).max(1),
  ndcgLite: z.number().min(0).max(1),
  fieldCoverageScore: z.number().min(0).max(1),
  noteTypeCoverageScore: z.number().min(0).max(1),
  latencyMs: z.number().min(0),
  cacheStatus: z.enum(["fresh_hit", "stale_hit", "miss"]).optional(),
});
export type EvalPerPlanMetrics = z.infer<typeof EvalPerPlanMetricsSchema>;

export const EvalPerRequestMetricsSchema = z.object({
  exampleId: z.string(),
  mode: EvalModeSchema,
  plannerConfig: PlannerConfigSchema,
  recallAtK: z.number().min(0).max(1),
  precisionAtK: z.number().min(0).max(1),
  mrr: z.number().min(0).max(1),
  ndcgLite: z.number().min(0).max(1),
  fieldCoverageScore: z.number().min(0).max(1),
  noteTypeCoverageScore: z.number().min(0).max(1),
  totalLatencyMs: z.number().min(0),
  cacheHitRate: z.number().min(0).max(1),
  staleCacheServeRate: z.number().min(0).max(1),
  backgroundRefreshRate: z.number().min(0).max(1),
  rerankUpliftDelta: z.number(),
  lexicalOnlyVsRerankedDelta: z.number(),
  zeroHit: z.boolean().default(false),
  missReason: z
    .enum(["none", "lexical_miss", "filter_miss", "rerank_insufficiency"])
    .default("none"),
  missReasonCounts: z
    .object({
      lexicalMissPlans: z.number().int().min(0),
      filterMissPlans: z.number().int().min(0),
      rerankInsufficiencyPlans: z.number().int().min(0),
    })
    .optional(),
  perPlan: z.array(EvalPerPlanMetricsSchema),
  metadataTags: z.array(z.string()).optional(),
});
export type EvalPerRequestMetrics = z.infer<typeof EvalPerRequestMetricsSchema>;

const BoundedMetricSchema = z.number().min(0).max(1);
const SignedBoundedMetricSchema = z.number().min(-1).max(1);

export const EvalAggregateReportSchema = z.object({
  runId: z.string(),
  mode: EvalModeSchema,
  requestCount: z.number().int().min(0),
  recallAtK: z.number().min(0).max(1),
  precisionAtK: z.number().min(0).max(1),
  mrr: z.number().min(0).max(1),
  ndcgLite: z.number().min(0).max(1),
  fieldCoverageScore: z.number().min(0).max(1),
  noteTypeCoverageScore: z.number().min(0).max(1),
  avgLatencyMs: z.number().min(0),
  cacheHitRate: z.number().min(0).max(1),
  staleCacheServeRate: z.number().min(0).max(1),
  backgroundRefreshRate: z.number().min(0).max(1),
  rerankUpliftDelta: z.number(),
  lexicalOnlyVsRerankedDelta: z.number(),
  requests: z.array(EvalPerRequestMetricsSchema),
  diagnostics: z
    .object({
      zeroHitExampleIds: z.array(z.string()),
      lexicalMissExampleIds: z.array(z.string()),
      filterMissExampleIds: z.array(z.string()),
      rerankInsufficiencyExampleIds: z.array(z.string()),
      improvedExampleIds: z.array(z.string()).optional(),
      regressedExampleIds: z.array(z.string()).optional(),
    })
    .optional(),
  plannerComparison: z
    .object({
      baseline: z.object({
        plannerConfig: PlannerConfigSchema,
        recallAtK: BoundedMetricSchema,
        precisionAtK: BoundedMetricSchema,
        mrr: BoundedMetricSchema,
        avgLatencyMs: z.number().min(0),
      }),
      candidate: z.object({
        plannerConfig: PlannerConfigSchema,
        recallAtK: BoundedMetricSchema,
        precisionAtK: BoundedMetricSchema,
        mrr: BoundedMetricSchema,
        avgLatencyMs: z.number().min(0),
      }),
      delta: z.object({
        recallAtK: SignedBoundedMetricSchema,
        precisionAtK: SignedBoundedMetricSchema,
        mrr: SignedBoundedMetricSchema,
        avgLatencyMs: z.number(),
      }),
    })
    .optional(),
});
export type EvalAggregateReport = z.infer<typeof EvalAggregateReportSchema>;

export const RetrievalEvalDatasetSchema = z.object({
  name: z.string(),
  version: z.string().default("1"),
  metadata: z
    .object({
      syntheticData: z.boolean().optional(),
      evidenceValidationMode: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  examples: z.array(GoldRetrievalExampleSchema),
});
export type RetrievalEvalDataset = z.infer<typeof RetrievalEvalDatasetSchema>;
