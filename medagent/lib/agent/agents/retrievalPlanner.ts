import crypto from "crypto";
import {
  AgentStateType,
  CanonicalEvidenceItem,
  RetrievalExecutionRecord,
  RetrievalQueryPlan,
  RetrievalQueryPlanSchema,
} from "@/lib/agent/state";
import { addTraceStep } from "@/lib/agent/traceHelpers";
import { getPatientRow } from "@/lib/db";
import { fetchSummary } from "@/lib/agent/tools/fetchSummary";
import { buildLexicalIndex } from "@/lib/agent/retrieval/buildLexicalIndex";
import { localLexicalSearch } from "@/lib/agent/retrieval/localLexicalSearch";
import { normalizeMedicalQuery } from "@/lib/agent/retrieval/normalizeMedicalQuery";
import {
  DEFAULT_RETRIEVAL_MODE_ORDER,
  DEFAULT_RETRIEVAL_PLANNER_PROFILE,
  DEFAULT_RETRIEVAL_TOP_K,
} from "@/lib/agent/retrieval/plannerDefaults";
import { rerankLexicalShortlist } from "@/lib/agent/retrieval/semanticReranker";
import { buildSemanticIndex } from "@/lib/agent/tools/retrievers/localSemanticIndex";
import { localSemanticSearch } from "@/lib/agent/tools/retrievers/localSemanticSearch";
import { fuseRetrievalResults } from "@/lib/agent/tools/retrievers/fuseRetrievalResults";
import { LexicalSearchResult } from "@/lib/agent/retrieval/retrievalTypes";
import { buildRetrievalCacheKey } from "@/lib/rag/cache/cacheKeys";
import {
  enqueueRetrievalCacheRecompute,
  getRetrievalCacheEntry,
  setRetrievalCacheEntry,
} from "@/lib/rag/cache/retrievalCache";
import {
  computeIndexFreshness,
  readIndexManifestEntry,
  touchIndexManifestSeenAt,
} from "@/lib/rag/indexing/indexManifest";
import {
  enqueueIndexRefresh,
  runIndexRefreshNow,
} from "@/lib/rag/indexing/indexingWorker";
import { computeSourceFingerprint } from "@/lib/rag/indexing/sourceFingerprint";
import {
  PlanProfile,
  recommendModeOrder,
  recommendPlanProfile,
  recommendTopK,
  summarizeTelemetryForOptimizer,
} from "@/lib/rag/eval/planOptimizer";
import {
  buildRetrievalObservabilitySnapshot,
  isRetrievalObservabilityEnabled,
  shouldSaveRetrievalMetrics,
} from "@/lib/rag/observability/retrievalObservability";
import {
  compareRetrievalRegression,
  summarizeSnapshotsForRegression,
} from "@/lib/rag/observability/retrievalRegression";
import {
  appendRetrievalMetricsSnapshot,
  generateAndSaveRetrievalCostDashboard,
  loadRecentRetrievalMetrics,
  saveRegressionReport,
} from "@/lib/rag/observability/metricsStore";
import { getMaxRetrievalRetries } from "@/lib/agent/policy/runtimeLimits";

const DEFAULT_RERANK_SHORTLIST_CAP = 20;
const DEFAULT_SEMANTIC_SHORTLIST_CAP = 20;

const NOTE_TYPES_BY_FIELD: Record<string, string[]> = {
  allergies: ["allergy", "adverse_reaction", "allergy_record"],
  medications: ["medication_safety", "medication_record"],
  conditions: [
    "chronic_condition",
    "lab_trend",
    "genetic",
    "mental_health",
    "condition_record",
  ],
  alerts: ["risk_episode", "care_plan", "medical_alert"],
  emergencyContact: ["social_history", "contact_info"],
  recentDischarge: ["procedure_history", "discharge_summary"],
  documents: ["procedure_history", "care_plan", "social_history", "upload"],
};

const BROAD_TERMS_BY_FIELD: Record<string, string[]> = {
  allergies: ["allergic", "anaphylaxis", "reaction", "intolerance"],
  medications: ["drug", "dose", "contraindication", "anticoagulant", "insulin"],
  conditions: ["history", "diagnosis", "chronic", "comorbidity", "trend"],
  alerts: ["critical", "warning", "risk", "danger", "contraindication"],
  emergencyContact: ["contact", "next of kin", "family"],
  recentDischarge: ["discharge", "hospitalization", "follow-up"],
  documents: ["clinical note", "report", "summary"],
};

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function dedupeNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeAdaptiveTopK(input: {
  baseTopK: number;
  fields: string[];
  noteTypes: string[];
  query: string;
}) {
  let topK = input.baseTopK;
  const query = input.query.toLowerCase();
  const breadthSensitiveField =
    input.fields.includes("recentDischarge") ||
    input.fields.includes("documents") ||
    input.fields.includes("emergencyContact");
  const breadthSensitiveQuery =
    /\b(discharge|follow[\s-]?up|document|history|contact|consent|care\s*plan)\b/i.test(
      query,
    );
  if (breadthSensitiveField || breadthSensitiveQuery) {
    topK += 2;
  }
  if (input.noteTypes.length >= 14) {
    topK += 1;
  }
  return Math.max(3, Math.min(topK, 10));
}

function isPlanOptimizerEnabled() {
  const raw = process.env.MEDAGENT_ENABLE_PLAN_OPTIMIZER;
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase().trim());
}

function resolveOptimizerProfileOverride():
  | "auto"
  | "precision_first"
  | "balanced"
  | "recall_first" {
  const raw = process.env.MEDAGENT_PLAN_OPTIMIZER_PROFILE;
  if (!raw) return "auto";
  const normalized = raw.toLowerCase().trim();
  if (
    normalized === "precision_first" ||
    normalized === "balanced" ||
    normalized === "recall_first"
  ) {
    return normalized;
  }
  return "auto";
}

function isRerankEnabled() {
  const raw = process.env.MEDAGENT_ENABLE_LOCAL_RERANK;
  if (!raw) return true;
  return !["0", "false", "off"].includes(raw.toLowerCase().trim());
}

function buildCacheMetadata(
  rec: Pick<
    RetrievalExecutionRecord,
    | "lexicalReturnedCount"
    | "lexicalContributedCount"
    | "lexicalLatencyMs"
    | "rerankApplied"
    | "rerankInputCount"
    | "rerankLatencyMs"
    | "rerankModel"
    | "semanticTopScore"
    | "fusionTopScore"
    | "semanticReturnedCount"
    | "semanticContributedCount"
    | "semanticLatencyMs"
    | "fusionApplied"
    | "fusionInputCount"
    | "semanticIndexHit"
    | "semanticFailureReason"
  >,
) {
  return {
    lexicalReturnedCount: rec.lexicalReturnedCount,
    lexicalContributedCount: rec.lexicalContributedCount,
    lexicalLatencyMs: rec.lexicalLatencyMs,
    rerankApplied: rec.rerankApplied,
    rerankInputCount: rec.rerankInputCount,
    rerankLatencyMs: rec.rerankLatencyMs,
    rerankModel: rec.rerankModel,
    semanticTopScore: rec.semanticTopScore,
    fusionTopScore: rec.fusionTopScore,
    semanticReturnedCount: rec.semanticReturnedCount,
    semanticContributedCount: rec.semanticContributedCount,
    semanticLatencyMs: rec.semanticLatencyMs,
    fusionApplied: rec.fusionApplied,
    fusionInputCount: rec.fusionInputCount,
    semanticIndexHit: rec.semanticIndexHit,
    semanticFailureReason: rec.semanticFailureReason,
  };
}

type RetrievalPlannerRuntimeConfig = {
  enablePlanOptimizer?: boolean;
  optimizerProfileOverride?:
    | "auto"
    | "precision_first"
    | "balanced"
    | "recall_first";
  enableLocalRerank?: boolean;
};

function resolvePlanOptimizerEnabled(
  runtimeConfig?: RetrievalPlannerRuntimeConfig,
) {
  if (typeof runtimeConfig?.enablePlanOptimizer === "boolean") {
    return runtimeConfig.enablePlanOptimizer;
  }
  return isPlanOptimizerEnabled();
}

function resolveOptimizerProfile(
  runtimeConfig?: RetrievalPlannerRuntimeConfig,
): "auto" | "precision_first" | "balanced" | "recall_first" {
  if (runtimeConfig?.optimizerProfileOverride) {
    return runtimeConfig.optimizerProfileOverride;
  }
  return resolveOptimizerProfileOverride();
}

function resolveRerankEnabled(runtimeConfig?: RetrievalPlannerRuntimeConfig) {
  if (typeof runtimeConfig?.enableLocalRerank === "boolean") {
    return runtimeConfig.enableLocalRerank;
  }
  return isRerankEnabled();
}

function toRuntimeConfig(
  value: unknown,
): RetrievalPlannerRuntimeConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const hasKnownKey =
    "enablePlanOptimizer" in candidate ||
    "optimizerProfileOverride" in candidate ||
    "enableLocalRerank" in candidate;
  if (!hasKnownKey) return undefined;
  return {
    enablePlanOptimizer:
      typeof candidate.enablePlanOptimizer === "boolean"
        ? candidate.enablePlanOptimizer
        : undefined,
    optimizerProfileOverride:
      candidate.optimizerProfileOverride === "auto" ||
      candidate.optimizerProfileOverride === "precision_first" ||
      candidate.optimizerProfileOverride === "balanced" ||
      candidate.optimizerProfileOverride === "recall_first"
        ? candidate.optimizerProfileOverride
        : undefined,
    enableLocalRerank:
      typeof candidate.enableLocalRerank === "boolean"
        ? candidate.enableLocalRerank
        : undefined,
  };
}

function normalizeFocusFields(state: AgentStateType): string[] {
  const focus = state.understandingContext.focusAreas ?? [];
  const allowed = new Set(state.policyContext.fieldsAllowed ?? []);
  const queryFieldHints =
    normalizeMedicalQuery({
      query: state.requestContext.naturalLanguageRequest,
      focusAreas: focus,
    }).fieldHints ?? [];
  const normalized = dedupeStrings([
    ...queryFieldHints.filter((field) => allowed.has(field)),
    ...focus.filter((field) => allowed.has(field)),
  ]);
  return normalized.length ? normalized : [...allowed];
}

function buildQueryPlans(
  state: AgentStateType,
  retryCount: number,
  options?: {
    profile?: PlanProfile;
    modeOrder?: Array<"balanced" | "broad" | "exact">;
    recommendedTopK?: number;
  },
): RetrievalQueryPlan[] {
  const focusFields = normalizeFocusFields(state);
  const fallbackFields = focusFields.length
    ? focusFields
    : state.policyContext.fieldsAllowed.slice(0, 3);
  const noteTypes = dedupeStrings(
    fallbackFields.flatMap((field) => NOTE_TYPES_BY_FIELD[field] ?? []),
  );

  const baseQuery = [state.requestContext.naturalLanguageRequest]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (retryCount === 1) {
    const broadTerms = dedupeStrings(
      fallbackFields.flatMap((field) => BROAD_TERMS_BY_FIELD[field] ?? []),
    );

    const broadPlans = [
      RetrievalQueryPlanSchema.parse({
        query: [baseQuery, broadTerms.join(" "), "related emergency concepts"]
          .filter(Boolean)
          .join(" "),
        mode: "broad",
        targetFields: fallbackFields,
        targetNoteTypes: noteTypes,
        topK: Math.max(DEFAULT_RETRIEVAL_TOP_K, 8),
      }),
      RetrievalQueryPlanSchema.parse({
        query: [baseQuery, "clinical context and relevant history"]
          .filter(Boolean)
          .join(" "),
        mode: "broad",
        targetFields: fallbackFields,
        targetNoteTypes: noteTypes,
        topK: Math.max(DEFAULT_RETRIEVAL_TOP_K, 6),
      }),
    ];

    return broadPlans.map((plan) => {
      const topK =
        options?.recommendedTopK && options.recommendedTopK > 0
          ? Math.max(plan.topK, options.recommendedTopK)
          : plan.topK;
      return { ...plan, topK };
    });
  }

  if (retryCount >= 2) {
    const exactPlans = fallbackFields.map((field) =>
      RetrievalQueryPlanSchema.parse({
        query: `field:${field} ${baseQuery}`.trim(),
        mode: "exact",
        targetFields: [field],
        targetNoteTypes: NOTE_TYPES_BY_FIELD[field] ?? [],
        topK: 4,
      }),
    );
    const exactOrFallback = exactPlans.length
      ? exactPlans
      : [
          RetrievalQueryPlanSchema.parse({
            query: baseQuery || "exact emergency evidence",
            mode: "exact",
            topK: 4,
          }),
        ];

    return exactOrFallback.map((plan) => {
      const topK =
        options?.recommendedTopK && options.recommendedTopK > 0
          ? Math.max(3, Math.min(plan.topK, options.recommendedTopK))
          : plan.topK;
      return { ...plan, topK };
    });
  }

  const defaultPlans = [
    RetrievalQueryPlanSchema.parse({
      query: baseQuery || "emergency overview",
      mode: "balanced",
      targetFields: fallbackFields,
      targetNoteTypes: noteTypes,
      topK: computeAdaptiveTopK({
        baseTopK: DEFAULT_RETRIEVAL_TOP_K,
        fields: fallbackFields,
        noteTypes,
        query: baseQuery || "emergency overview",
      }),
    }),
    RetrievalQueryPlanSchema.parse({
      query: [baseQuery, "immediate risks and contraindications"]
        .filter(Boolean)
        .join(" "),
      mode: "balanced",
      targetFields: fallbackFields,
      targetNoteTypes: noteTypes,
      topK: computeAdaptiveTopK({
        baseTopK: DEFAULT_RETRIEVAL_TOP_K,
        fields: fallbackFields,
        noteTypes,
        query: [baseQuery, "immediate risks and contraindications"]
          .filter(Boolean)
          .join(" "),
      }),
    }),
    RetrievalQueryPlanSchema.parse({
      query: [baseQuery, "latest care plan and disposition"]
        .filter(Boolean)
        .join(" "),
      mode: "balanced",
      targetFields: fallbackFields,
      targetNoteTypes: noteTypes,
      topK: computeAdaptiveTopK({
        baseTopK: DEFAULT_RETRIEVAL_TOP_K,
        fields: fallbackFields,
        noteTypes,
        query: [baseQuery, "latest care plan and disposition"]
          .filter(Boolean)
          .join(" "),
      }),
    }),
  ];

  const recommendedTopK =
    options?.recommendedTopK && options.recommendedTopK > 0
      ? options.recommendedTopK
      : null;

  let nextPlans = defaultPlans.map((plan) => ({
    ...plan,
    topK: recommendedTopK ? Math.max(3, recommendedTopK) : plan.topK,
  }));

  if (options?.profile === "recall_first") {
    nextPlans = [
      nextPlans[0],
      RetrievalQueryPlanSchema.parse({
        query: [baseQuery, "broad clinical context and related findings"]
          .filter(Boolean)
          .join(" "),
        mode: "broad",
        targetFields: fallbackFields,
        targetNoteTypes: noteTypes,
        topK: recommendedTopK ? Math.max(recommendedTopK, 7) : 7,
      }),
      ...nextPlans.slice(1),
    ];
  } else if (options?.profile === "precision_first") {
    nextPlans = [
      nextPlans[0],
      RetrievalQueryPlanSchema.parse({
        query: `field:${fallbackFields[0] ?? "allergies"} ${baseQuery}`.trim(),
        mode: "exact",
        targetFields: fallbackFields.slice(0, 1),
        targetNoteTypes:
          NOTE_TYPES_BY_FIELD[fallbackFields[0] ?? "allergies"] ?? [],
        topK: recommendedTopK ? Math.max(3, Math.min(recommendedTopK, 4)) : 4,
      }),
      ...nextPlans.slice(1),
    ];
  }

  if (options?.modeOrder?.length) {
    const modeOrder = options.modeOrder;
    nextPlans.sort(
      (left, right) =>
        modeOrder.indexOf(left.mode) - modeOrder.indexOf(right.mode),
    );
  }

  return nextPlans;
}

function parseLegacyMode(text: string): RetrievalQueryPlan["mode"] {
  const lower = text.toLowerCase();
  if (lower.includes("exact")) return "exact";
  if (lower.includes("broad")) return "broad";
  return "balanced";
}

function normalizeExistingPlans(
  plans: Array<RetrievalQueryPlan | string> | undefined,
): RetrievalQueryPlan[] {
  if (!plans?.length) return [];

  return plans
    .map((plan) => {
      if (typeof plan === "string") {
        const query = plan.trim() || "legacy retrieval query";
        return RetrievalQueryPlanSchema.parse({
          query,
          mode: parseLegacyMode(plan),
          topK: DEFAULT_RETRIEVAL_TOP_K,
        });
      }

      const parsed = RetrievalQueryPlanSchema.safeParse(plan);
      if (parsed.success) {
        return parsed.data;
      }

      if (plan && typeof plan.query === "string") {
        return RetrievalQueryPlanSchema.parse({
          query: plan.query,
          mode: plan.mode ?? parseLegacyMode(plan.query),
          targetFields: plan.targetFields ?? [],
          targetNoteTypes: plan.targetNoteTypes ?? [],
          topK: plan.topK ?? DEFAULT_RETRIEVAL_TOP_K,
        });
      }

      return null;
    })
    .filter(Boolean) as RetrievalQueryPlan[];
}

function mergePlans(
  existing: RetrievalQueryPlan[],
  next: RetrievalQueryPlan[],
): RetrievalQueryPlan[] {
  const merged = [...existing, ...next];
  const seen = new Set<string>();

  return merged.filter((plan) => {
    const key = JSON.stringify({
      query: plan.query,
      mode: plan.mode,
      topK: plan.topK,
      targetFields: plan.targetFields ?? [],
      targetNoteTypes: plan.targetNoteTypes ?? [],
    });

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyPlanTargeting(
  items: CanonicalEvidenceItem[],
  plan: RetrievalQueryPlan,
): CanonicalEvidenceItem[] {
  return items.filter((item) => {
    if (
      plan.targetFields?.length &&
      !plan.targetFields.includes(item.authorization.fieldKey)
    ) {
      return false;
    }
    if (
      plan.targetNoteTypes?.length &&
      (!item.noteType || !plan.targetNoteTypes.includes(item.noteType))
    ) {
      return false;
    }
    return true;
  });
}

function makeDedupKey(item: CanonicalEvidenceItem) {
  return JSON.stringify({
    content: item.content,
    fieldKey: item.authorization.fieldKey,
    noteType: item.noteType ?? null,
    provenance: {
      documentId: item.provenance.documentId ?? null,
      chunkIndex: item.provenance.chunkIndex ?? null,
      timestamp: item.provenance.timestamp,
    },
  });
}

function getSourcesSeen(item: CanonicalEvidenceItem) {
  return dedupeStrings([
    ...(item.retrieval?.sourcesSeen ?? []),
    item.retrieval?.source ?? "",
  ]) as Array<"baseline" | "rag">;
}

function getContributingPlanIndexes(item: CanonicalEvidenceItem) {
  return dedupeNumbers(
    [
      ...(item.retrieval?.contributingPlanIndexes ?? []),
      item.retrieval?.queryPlanIndex ?? -1,
    ].filter((index) => index >= 0),
  );
}

function getBestScore(item: CanonicalEvidenceItem) {
  return item.retrieval?.bestScore ?? item.retrieval?.score ?? 0;
}

function preferCandidate(
  existing: CanonicalEvidenceItem,
  next: CanonicalEvidenceItem,
) {
  const existingScore = getBestScore(existing);
  const nextScore = getBestScore(next);

  const best = nextScore > existingScore ? next : existing;
  const other = best === next ? existing : next;

  const matchedQueries = dedupeStrings([
    ...(best.retrieval?.matchedQueries ?? []),
    ...(other.retrieval?.matchedQueries ?? []),
    best.retrieval?.query ?? "",
    other.retrieval?.query ?? "",
  ]);

  const sourcesSeen = dedupeStrings([
    ...getSourcesSeen(best),
    ...getSourcesSeen(other),
  ]) as Array<"baseline" | "rag">;

  const contributingPlanIndexes = dedupeNumbers([
    ...getContributingPlanIndexes(best),
    ...getContributingPlanIndexes(other),
  ]);

  const bestScore = Math.max(existingScore, nextScore);

  const mergedRetrieval = {
    ...(best.retrieval ?? other.retrieval),
    source: (best.retrieval?.source ??
      other.retrieval?.source ??
      "baseline") as "baseline" | "rag",
    retryIteration: Math.max(
      best.retrieval?.retryIteration ?? 0,
      other.retrieval?.retryIteration ?? 0,
    ),
    score: best.retrieval?.score ?? other.retrieval?.score ?? bestScore,
    bestScore,
    matchedQueries,
    sourcesSeen,
    contributingPlanIndexes,
  };

  return {
    ...best,
    retrieval: mergedRetrieval,
  };
}

function dedupeCandidates(items: CanonicalEvidenceItem[]) {
  const byKey = new Map<string, CanonicalEvidenceItem>();

  for (const item of items) {
    const key = makeDedupKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    byKey.set(key, preferCandidate(existing, item));
  }

  return [...byKey.values()];
}

function rankCandidates(items: CanonicalEvidenceItem[]) {
  return [...items].sort((left, right) => {
    const leftScore = getBestScore(left);
    const rightScore = getBestScore(right);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const leftSources = getSourcesSeen(left);
    const rightSources = getSourcesSeen(right);
    const leftHasRag = leftSources.includes("rag") ? 1 : 0;
    const rightHasRag = rightSources.includes("rag") ? 1 : 0;
    if (rightHasRag !== leftHasRag) {
      return rightHasRag - leftHasRag;
    }

    const leftMatchCount = left.retrieval?.matchedQueries?.length ?? 0;
    const rightMatchCount = right.retrieval?.matchedQueries?.length ?? 0;
    if (rightMatchCount !== leftMatchCount) {
      return rightMatchCount - leftMatchCount;
    }

    const leftKey = JSON.stringify({
      fieldKey: left.authorization.fieldKey,
      noteType: left.noteType ?? "",
      content: left.content,
      documentId: left.provenance.documentId ?? "",
      chunkIndex: left.provenance.chunkIndex ?? -1,
    });
    const rightKey = JSON.stringify({
      fieldKey: right.authorization.fieldKey,
      noteType: right.noteType ?? "",
      content: right.content,
      documentId: right.provenance.documentId ?? "",
      chunkIndex: right.provenance.chunkIndex ?? -1,
    });
    return leftKey.localeCompare(rightKey);
  });
}

function enforceFieldCoverageInTopK(input: {
  items: CanonicalEvidenceItem[];
  priorityFields: string[];
  k: number;
}) {
  if (!input.priorityFields.length || input.items.length <= input.k) {
    return input.items;
  }

  const ranked = [...input.items];
  const top = ranked.slice(0, input.k);
  const present = new Set(top.map((item) => item.authorization.fieldKey));
  let cursor = input.k;

  for (const field of input.priorityFields) {
    if (present.has(field)) continue;
    const replacementIndex = ranked.findIndex(
      (item, idx) => idx >= cursor && item.authorization.fieldKey === field,
    );
    if (replacementIndex < 0) continue;

    const outIndex = ranked
      .slice(0, input.k)
      .findIndex(
        (item) => !input.priorityFields.includes(item.authorization.fieldKey),
      );
    const evictIndex = outIndex >= 0 ? outIndex : input.k - 1;

    const [promoted] = ranked.splice(replacementIndex, 1);
    ranked.splice(evictIndex, 0, promoted);
    present.add(field);
    cursor = Math.max(cursor, evictIndex + 1);
  }

  return ranked;
}

function inferPriorityNoteTypes(query: string) {
  const q = query.toLowerCase();
  const notes: string[] = [];
  if (/\b(discharge|follow[\s-]?up|hospitali[sz]ation)\b/i.test(q)) {
    notes.push(
      "discharge_summary",
      "procedure_history",
      "care_plan",
      "condition_record",
    );
  }
  if (/\b(document|documents|report|history|procedur)\b/i.test(q)) {
    notes.push("upload", "procedure_history", "condition_record");
  }
  if (/\b(contact|consent|family|next of kin)\b/i.test(q)) {
    notes.push("contact_info", "social_history");
  }
  if (/\b(lab|trend)\b/i.test(q)) {
    notes.push("lab_trend");
  }
  if (/\b(allerg|anaphylaxis|reaction)\b/i.test(q)) {
    notes.push("allergy_record");
  }
  if (/\b(medication|drug|prescrib|contraindication)\b/i.test(q)) {
    notes.push("medication_record");
  }
  if (/\b(condition|diagnos|chronic)\b/i.test(q)) {
    notes.push("condition_record");
  }
  if (/\b(alert|risk|risks|red flag|warning)\b/i.test(q)) {
    notes.push("medical_alert");
  }
  return dedupeStrings(notes);
}

function enforceNoteTypeCoverageInTopK(input: {
  items: CanonicalEvidenceItem[];
  priorityNoteTypes: string[];
  k: number;
}) {
  const priority = input.priorityNoteTypes.slice(0, input.k);
  if (!priority.length || input.items.length <= input.k) {
    return input.items;
  }

  const ranked = [...input.items];
  const top = ranked.slice(0, input.k);
  const present = new Set(top.map((item) => item.noteType).filter(Boolean));
  let cursor = input.k;

  for (const noteType of priority) {
    if (present.has(noteType)) continue;
    const replacementIndex = ranked.findIndex(
      (item, idx) => idx >= cursor && item.noteType === noteType,
    );
    if (replacementIndex < 0) continue;

    const outIndex = ranked.slice(0, input.k).findIndex((item) => {
      const itemNote = item.noteType ?? "";
      return !priority.includes(itemNote);
    });
    const evictIndex = outIndex >= 0 ? outIndex : input.k - 1;

    const [promoted] = ranked.splice(replacementIndex, 1);
    ranked.splice(evictIndex, 0, promoted);
    present.add(noteType);
    cursor = Math.max(cursor, evictIndex + 1);
  }

  return ranked;
}

type PlanComputation = {
  executionRecord: RetrievalExecutionRecord;
  ragCandidates: CanonicalEvidenceItem[];
  cacheKey: string;
  cacheLookupLatencyMs: number;
  cacheWriteLatencyMs: number;
  cacheStatus: "fresh_hit" | "stale_hit" | "miss";
  backgroundRefreshQueued: boolean;
  backgroundRefreshReason?: string;
};

export async function runRetrievalPlanner(
  state: AgentStateType,
  runtimeOrConfig?: unknown,
): Promise<Partial<AgentStateType>> {
  const plannerStart = performance.now();
  const { requestContext, retrievalContext, trace } = state;
  const runtimeConfig = toRuntimeConfig(runtimeOrConfig);
  const rerankEnabled = resolveRerankEnabled(runtimeConfig);
  const rerankShortlistCap = parsePositiveInteger(
    process.env.MEDAGENT_RERANK_SHORTLIST_CAP,
    DEFAULT_RERANK_SHORTLIST_CAP,
  );
  const semanticShortlistCap = parsePositiveInteger(
    process.env.MEDAGENT_SEMANTIC_SHORTLIST_CAP,
    DEFAULT_SEMANTIC_SHORTLIST_CAP,
  );
  const rerankModel =
    process.env.MEDAGENT_LOCAL_RERANK_MODEL ?? "local-semantic-v1";
  const forceRerankFailure =
    process.env.MEDAGENT_FORCE_LOCAL_RERANK_FAILURE === "1";

  if (state.policyContext.decision !== "granted") {
    return { completedAgents: ["retrievalPlanner"] };
  }

  const currentRetry = retrievalContext.retryCount || 0;
  const nextRetry = Math.min(currentRetry + 1, getMaxRetrievalRetries());
  if (currentRetry === 1) {
    await waitMs(250);
  } else if (currentRetry >= 2) {
    await waitMs(750);
  }
  const queryFieldPriority =
    normalizeMedicalQuery({
      query: requestContext.naturalLanguageRequest,
      focusAreas: state.understandingContext.focusAreas,
    }).fieldHints ?? [];
  const queryNoteTypePriority = inferPriorityNoteTypes(
    requestContext.naturalLanguageRequest,
  );
  let optimizerApplied = false;
  let optimizerProfile = DEFAULT_RETRIEVAL_PLANNER_PROFILE;
  let retrievalProfile = "balanced";
  let recommendedModeOrder: Array<"balanced" | "broad" | "exact"> = [
    ...DEFAULT_RETRIEVAL_MODE_ORDER,
  ];
  let recommendedTopK = DEFAULT_RETRIEVAL_TOP_K;

  try {
    if (resolvePlanOptimizerEnabled(runtimeConfig)) {
      const override = resolveOptimizerProfile(runtimeConfig);
      const noteTypeHintCount = normalizeFocusFields(state).flatMap(
        (field) => NOTE_TYPES_BY_FIELD[field] ?? [],
      ).length;
      const telemetrySummary = summarizeTelemetryForOptimizer(
        retrievalContext.executionLog ?? [],
        state.policyContext.fieldsAllowed.length,
        noteTypeHintCount,
      );
      const profile =
        override === "auto" ? recommendPlanProfile(telemetrySummary) : override;
      const modeOrder = [...recommendModeOrder(profile)];
      const topK = recommendTopK(profile, telemetrySummary);

      optimizerApplied = true;
      optimizerProfile = profile;
      recommendedModeOrder = modeOrder;
      recommendedTopK = topK;
      retrievalProfile =
        profile === "recall_first"
          ? "recall_stressed"
          : profile === "precision_first"
            ? "precision_stressed"
            : "balanced";
    }
  } catch (err) {
    console.warn("retrieval planner optimizer failed", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    optimizerApplied = false;
    optimizerProfile = DEFAULT_RETRIEVAL_PLANNER_PROFILE;
    recommendedModeOrder = [...DEFAULT_RETRIEVAL_MODE_ORDER];
    recommendedTopK = DEFAULT_RETRIEVAL_TOP_K;
    retrievalProfile = "balanced";
  }

  const nextPlans = buildQueryPlans(state, currentRetry, {
    profile: optimizerProfile as PlanProfile,
    modeOrder: [...recommendedModeOrder],
    recommendedTopK,
  });
  const existingPlans = normalizeExistingPlans(
    retrievalContext.queryPlans as Array<RetrievalQueryPlan | string>,
  );
  const queryPlans =
    currentRetry === 0 ? nextPlans : mergePlans(existingPlans, nextPlans);
  const queryPlanOffset = Math.max(0, queryPlans.length - nextPlans.length);

  const fetched = await fetchSummary({ patientId: requestContext.patientId });
  const baselineCandidates = fetched.rawCandidates.map((item) => ({
    ...item,
    retrieval: {
      source: "baseline" as const,
      retryIteration: currentRetry,
      mode: "balanced" as const,
      query: "structured_baseline_fetch",
      queryPlanIndex: -1,
      rank: 0,
      score: 0.15,
      bestScore: 0.15,
      matchedQueries: ["structured_baseline_fetch"],
      sourcesSeen: ["baseline" as const],
      contributingPlanIndexes: [],
    },
  }));

  const patientHashUsed =
    baselineCandidates[0]?.patientHash ??
    getPatientRow(requestContext.patientId)?.patient_hash;
  const ragUsed = Boolean(patientHashUsed);
  const sourceFingerprint = patientHashUsed
    ? computeSourceFingerprint(fetched.rawCandidates)
    : undefined;

  let indexStatus: "ready" | "stale" | "building" | "failed" | "missing" =
    "missing";
  let indexFreshness: "fresh" | "stale" | "missing" = "missing";
  let indexBuildLatencyMs = 0;
  let indexEnsureLatencyMs = 0;
  let backgroundRefreshQueued = false;
  let backgroundRefreshReason: string | undefined;

  const indexEnsureStart = performance.now();
  if (patientHashUsed && sourceFingerprint) {
    touchIndexManifestSeenAt(patientHashUsed);
    let manifestEntry = readIndexManifestEntry(patientHashUsed);
    const freshnessBefore = computeIndexFreshness({
      entry: manifestEntry,
      sourceFingerprint,
    });

    indexStatus = freshnessBefore.indexStatus;
    indexFreshness = freshnessBefore.indexFreshness;

    const hasUsableIndex =
      !!manifestEntry &&
      manifestEntry.chunkCount > 0 &&
      freshnessBefore.indexStatus !== "missing";

    if (!hasUsableIndex) {
      const built = await runIndexRefreshNow(patientHashUsed, {
        sourceFingerprint,
        reason: "first_use",
        force: true,
      });
      manifestEntry = built.entry;
      indexBuildLatencyMs = built.latencyMs;
      const freshnessAfterBuild = computeIndexFreshness({
        entry: manifestEntry,
        sourceFingerprint,
      });
      indexStatus = freshnessAfterBuild.indexStatus;
      indexFreshness = freshnessAfterBuild.indexFreshness;
    } else if (freshnessBefore.indexFreshness === "stale") {
      const reason =
        manifestEntry?.sourceFingerprint !== sourceFingerprint
          ? "source_fingerprint_changed"
          : "index_stale";
      backgroundRefreshQueued = enqueueIndexRefresh(
        patientHashUsed,
        sourceFingerprint,
        reason,
      );
      if (backgroundRefreshQueued) {
        backgroundRefreshReason = reason;
      }
      indexStatus = manifestEntry?.indexStatus ?? "stale";
      indexFreshness = "stale";
    }

    // Always keep a deterministic in-memory index for current process safety.
    buildLexicalIndex(fetched.rawCandidates, {
      patientHash: patientHashUsed,
      mode: "rebuild",
    });

    try {
      buildSemanticIndex(fetched.rawCandidates, {
        patientHash: patientHashUsed,
      });
    } catch (e) {
      console.error("semantic index build failed", {
        patientHashUsed,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      // semantic index fallback is handled per-plan
    }
  }
  indexEnsureLatencyMs = performance.now() - indexEnsureStart;

  const computePlanMiss = async (input: {
    plan: RetrievalQueryPlan;
    queryPlanIndex: number;
    normalizedQuery: ReturnType<typeof normalizeMedicalQuery>;
    cacheKey: string;
    indexStatusAtQueryTime:
      | "ready"
      | "stale"
      | "building"
      | "failed"
      | "missing";
    cacheLookupLatencyMs: number;
  }): Promise<PlanComputation> => {
    const plan = input.plan;
    const queryPlanIndex = input.queryPlanIndex;
    const normalizedQuery = input.normalizedQuery;

    const lexicalStart = performance.now();
    const lexicalTopN = Math.max(plan.topK, rerankShortlistCap);
    const lexicalResults = patientHashUsed
      ? localLexicalSearch({
          patientHash: patientHashUsed,
          query: normalizedQuery,
          targetFields: plan.targetFields,
          targetNoteTypes: plan.targetNoteTypes,
          topK: lexicalTopN,
          mode: plan.mode,
        })
      : [];
    const lexicalLatencyMs = performance.now() - lexicalStart;

    const lexicalCandidates = lexicalResults.map((result) => result.item);

    let semanticCandidates: CanonicalEvidenceItem[] = [];
    let semanticLatencyMs = 0;
    let semanticIndexHit = false;
    let semanticFailureReason: string | undefined;

    if (patientHashUsed) {
      try {
        const semanticOutcome = localSemanticSearch({
          query: plan.query,
          patientHash: patientHashUsed,
          targetFields: plan.targetFields,
          targetNoteTypes: plan.targetNoteTypes,
          topK: Math.max(plan.topK, semanticShortlistCap),
          mode: plan.mode,
          retryIteration: currentRetry,
          queryPlanIndex,
        });

        semanticCandidates = semanticOutcome.candidates;
        semanticLatencyMs = semanticOutcome.latencyMs;
        semanticIndexHit = semanticOutcome.semanticIndexHit;
      } catch (error) {
        semanticFailureReason =
          error instanceof Error ? error.message : "semantic_search_failed";
      }
    }

    const fusedOutcome = fuseRetrievalResults({
      lexicalCandidates,
      semanticCandidates,
      plan,
    });

    const rerankInput: LexicalSearchResult[] = fusedOutcome.fusedCandidates
      .slice(0, Math.max(plan.topK, rerankShortlistCap))
      .map((item) => ({
        item,
        source: "rag",
        mode: item.retrieval?.mode ?? "balanced",
        query: item.retrieval?.query ?? plan.query,
        score:
          item.retrieval?.fusionScore ??
          item.retrieval?.score ??
          item.retrieval?.semanticScore ??
          0,
        matchedQueries: item.retrieval?.matchedQueries ?? [plan.query],
        scoreBreakdown: {
          bm25Score: item.retrieval?.score ?? 0,
          bm25Normalized: item.retrieval?.score ?? 0,
          matchedKeywordCount: 0,
          matchedPhraseCount: 0,
          fieldMatchBoost: 0,
          noteTypeMatchBoost: 0,
          recencyBoost: 0,
          termCoverageBoost: 0,
          finalScore: item.retrieval?.fusionScore ?? item.retrieval?.score ?? 0,
        },
      }));

    const rerankOutcome = rerankLexicalShortlist(
      {
        query: normalizedQuery,
        candidates: rerankInput,
        targetFields: plan.targetFields,
        targetNoteTypes: plan.targetNoteTypes,
        topK: plan.topK,
        rerankModel,
      },
      {
        enabled: rerankEnabled,
        simulateFailure: forceRerankFailure,
      },
    );

    const ragResults = rerankOutcome.results;
    const ragAttempted = Boolean(patientHashUsed);
    const ragReturnedCount = ragResults.length;

    const ragCandidatesBeforeTargeting: CanonicalEvidenceItem[] =
      ragResults.map((result, rank) => ({
        ...result.item,
        id: result.item.id || crypto.randomUUID(),
        retrieval: {
          source: "rag" as const,
          retryIteration: currentRetry,
          mode: plan.mode,
          query: plan.query,
          queryPlanIndex,
          rank: rank + 1,
          score: result.score,
          bestScore: result.score,
          matchedQueries: result.matchedQueries.length
            ? result.matchedQueries
            : [plan.query],
          sourcesSeen: ["rag" as const],
          contributingPlanIndexes: [queryPlanIndex],
        },
      }));

    const ragCandidatesAfterTargeting = applyPlanTargeting(
      ragCandidatesBeforeTargeting,
      plan,
    );

    const countBeforeTargeting = ragCandidatesBeforeTargeting.length;
    const countAfterTargeting = ragCandidatesAfterTargeting.length;
    const lexicalReturnedCount = lexicalResults.length;
    const lexicalIds = new Set(lexicalCandidates.map((item) => item.id));
    const semanticIds = new Set(semanticCandidates.map((item) => item.id));
    const lexicalContributedCount = ragCandidatesAfterTargeting.filter((item) =>
      lexicalIds.has(item.id),
    ).length;
    const semanticContributedCount = ragCandidatesAfterTargeting.filter(
      (item) => semanticIds.has(item.id),
    ).length;

    const cacheWriteStart = performance.now();
    setRetrievalCacheEntry({
      key: input.cacheKey,
      patientHash: patientHashUsed ?? "",
      sourceFingerprint: sourceFingerprint ?? "unknown",
      candidates: ragCandidatesAfterTargeting,
      metadata: buildCacheMetadata({
        lexicalReturnedCount,
        lexicalContributedCount,
        lexicalLatencyMs,
        rerankApplied: rerankOutcome.rerankApplied,
        rerankInputCount: rerankOutcome.inputCount,
        rerankLatencyMs: rerankOutcome.rerankLatencyMs,
        rerankModel: rerankOutcome.rerankModel,
        semanticTopScore: rerankOutcome.semanticTopScore,
        fusionTopScore: rerankOutcome.fusionTopScore,
        semanticReturnedCount: semanticCandidates.length,
        semanticContributedCount,
        semanticLatencyMs,
        fusionApplied: fusedOutcome.fusionApplied,
        fusionInputCount: fusedOutcome.fusionInputCount,
        semanticIndexHit,
        semanticFailureReason,
      }),
    });
    const cacheWriteLatencyMs = performance.now() - cacheWriteStart;

    const executionRecord: RetrievalExecutionRecord = {
      queryPlanIndex,
      executedQuery: plan.query,
      mode: plan.mode,
      targetFields: plan.targetFields ?? [],
      targetNoteTypes: plan.targetNoteTypes ?? [],
      topK: plan.topK,
      ragAttempted,
      ragReturnedCount,
      countBeforeTargeting,
      countAfterTargeting,
      baselineContributedCount: 0,
      ragContributedCount: ragCandidatesAfterTargeting.length,
      lexicalReturnedCount,
      lexicalContributedCount,
      lexicalLatencyMs,
      rerankApplied: rerankOutcome.rerankApplied,
      rerankInputCount: rerankOutcome.inputCount,
      rerankLatencyMs: rerankOutcome.rerankLatencyMs,
      rerankModel: rerankOutcome.rerankModel,
      semanticTopScore: rerankOutcome.semanticTopScore,
      fusionTopScore: rerankOutcome.fusionTopScore,
      semanticReturnedCount: semanticCandidates.length,
      semanticContributedCount,
      semanticLatencyMs,
      fusionApplied: fusedOutcome.fusionApplied,
      fusionInputCount: fusedOutcome.fusionInputCount,
      semanticIndexHit,
      semanticFailureReason,
      cacheStatus: "miss",
      indexStatusAtQueryTime: input.indexStatusAtQueryTime,
      backgroundRefreshQueued: false,
      backgroundRefreshReason: undefined,
      cacheLookupLatencyMs: input.cacheLookupLatencyMs,
      cacheWriteLatencyMs,
      zeroResult: countAfterTargeting === 0,
    };

    return {
      executionRecord,
      ragCandidates: ragCandidatesAfterTargeting,
      cacheKey: input.cacheKey,
      cacheLookupLatencyMs: input.cacheLookupLatencyMs,
      cacheWriteLatencyMs,
      cacheStatus: "miss",
      backgroundRefreshQueued: false,
    };
  };

  const perPlanOutcomes = await Promise.all(
    nextPlans.map(async (plan, relativePlanIndex) => {
      const queryPlanIndex = queryPlanOffset + relativePlanIndex;
      const normalizedQuery = normalizeMedicalQuery({
        query: plan.query,
        focusAreas: state.understandingContext.focusAreas,
      });

      const cacheKey = buildRetrievalCacheKey({
        patientHash: patientHashUsed ?? "",
        normalizedQuery: normalizedQuery.normalizedQuery,
        mode: plan.mode,
        targetFields: plan.targetFields,
        targetNoteTypes: plan.targetNoteTypes,
        topK: plan.topK,
        sourceFingerprint: sourceFingerprint ?? "unknown",
      });

      const cacheLookupStart = performance.now();
      const cacheLookup = getRetrievalCacheEntry(cacheKey, {
        patientHash: patientHashUsed,
        sourceFingerprint,
      });
      const cacheLookupLatencyMs = performance.now() - cacheLookupStart;

      if (cacheLookup.entry && cacheLookup.status !== "expired") {
        const cachedCandidates = applyPlanTargeting(
          cacheLookup.entry.candidates.filter(
            (item) => item.patientHash === patientHashUsed,
          ),
          plan,
        );

        let planBackgroundRefreshQueued = false;
        let planBackgroundRefreshReason: string | undefined;

        if (cacheLookup.status === "stale_servable") {
          planBackgroundRefreshQueued = enqueueRetrievalCacheRecompute(
            cacheKey,
            async () => {
              try {
                const recomputed = await computePlanMiss({
                  plan,
                  queryPlanIndex,
                  normalizedQuery,
                  cacheKey,
                  indexStatusAtQueryTime: indexStatus,
                  cacheLookupLatencyMs: 0,
                });
                setRetrievalCacheEntry({
                  key: cacheKey,
                  patientHash: patientHashUsed ?? "",
                  sourceFingerprint: sourceFingerprint ?? "unknown",
                  candidates: recomputed.ragCandidates,
                  metadata: buildCacheMetadata(recomputed.executionRecord),
                });
              } catch (error) {
                console.warn(
                  "retrieval planner background cache refresh failed",
                  {
                    cacheKey,
                    queryPlanIndex,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                );
              }
            },
          );

          if (planBackgroundRefreshQueued) {
            planBackgroundRefreshReason = "cache_stale";
          }
        }

        const metadata = cacheLookup.entry.metadata;
        const executionRecord: RetrievalExecutionRecord = {
          queryPlanIndex,
          executedQuery: plan.query,
          mode: plan.mode,
          targetFields: plan.targetFields ?? [],
          targetNoteTypes: plan.targetNoteTypes ?? [],
          topK: plan.topK,
          ragAttempted: Boolean(patientHashUsed),
          ragReturnedCount: cachedCandidates.length,
          countBeforeTargeting: cachedCandidates.length,
          countAfterTargeting: cachedCandidates.length,
          baselineContributedCount: 0,
          ragContributedCount: cachedCandidates.length,
          lexicalReturnedCount: metadata?.lexicalReturnedCount,
          lexicalContributedCount: metadata?.lexicalContributedCount,
          lexicalLatencyMs: metadata?.lexicalLatencyMs,
          rerankApplied: metadata?.rerankApplied,
          rerankInputCount: metadata?.rerankInputCount,
          rerankLatencyMs: metadata?.rerankLatencyMs,
          rerankModel: metadata?.rerankModel,
          semanticTopScore: metadata?.semanticTopScore,
          fusionTopScore: metadata?.fusionTopScore,
          semanticReturnedCount: metadata?.semanticReturnedCount,
          semanticContributedCount: metadata?.semanticContributedCount,
          semanticLatencyMs: metadata?.semanticLatencyMs,
          fusionApplied: metadata?.fusionApplied,
          fusionInputCount: metadata?.fusionInputCount,
          semanticIndexHit: metadata?.semanticIndexHit,
          semanticFailureReason: metadata?.semanticFailureReason,
          cacheStatus:
            cacheLookup.status === "fresh" ? "fresh_hit" : "stale_hit",
          indexStatusAtQueryTime: indexStatus,
          backgroundRefreshQueued: planBackgroundRefreshQueued,
          backgroundRefreshReason: planBackgroundRefreshReason,
          cacheLookupLatencyMs,
          cacheWriteLatencyMs: 0,
          zeroResult: cachedCandidates.length === 0,
        };

        return {
          executionRecord,
          ragCandidates: cachedCandidates,
          cacheKey,
          cacheLookupLatencyMs,
          cacheWriteLatencyMs: 0,
          cacheStatus:
            cacheLookup.status === "fresh" ? "fresh_hit" : "stale_hit",
          backgroundRefreshQueued: planBackgroundRefreshQueued,
          backgroundRefreshReason: planBackgroundRefreshReason,
        } satisfies PlanComputation;
      }

      return computePlanMiss({
        plan,
        queryPlanIndex,
        normalizedQuery,
        cacheKey,
        indexStatusAtQueryTime: indexStatus,
        cacheLookupLatencyMs,
      });
    }),
  );

  const ragCandidates = perPlanOutcomes.flatMap(
    (outcome) => outcome.ragCandidates,
  );
  const executionLogForRun = perPlanOutcomes.map(
    (outcome) => outcome.executionRecord,
  );

  const totalSemanticCandidates = executionLogForRun.reduce(
    (sum, entry) => sum + (entry.semanticReturnedCount ?? 0),
    0,
  );
  const semanticUsed =
    totalSemanticCandidates > 0 ||
    executionLogForRun.some((entry) => entry.semanticIndexHit);

  const rawCandidates = enforceNoteTypeCoverageInTopK({
    items: enforceFieldCoverageInTopK({
      items: rankCandidates(
        dedupeCandidates([...baselineCandidates, ...ragCandidates]),
      ),
      priorityFields: queryFieldPriority,
      k: DEFAULT_RETRIEVAL_TOP_K,
    }),
    priorityNoteTypes: queryNoteTypePriority,
    k: DEFAULT_RETRIEVAL_TOP_K,
  });

  const baselineOnlyCount = rawCandidates.filter((candidate) => {
    const sources = getSourcesSeen(candidate);
    return sources.includes("baseline") && !sources.includes("rag");
  }).length;
  const ragOnlyCount = rawCandidates.filter((candidate) => {
    const sources = getSourcesSeen(candidate);
    return sources.includes("rag") && !sources.includes("baseline");
  }).length;
  const mixedSourceCount = rawCandidates.filter((candidate) => {
    const sources = getSourcesSeen(candidate);
    return sources.includes("rag") && sources.includes("baseline");
  }).length;

  const zeroResultPlans = executionLogForRun.filter(
    (entry) => entry.zeroResult,
  ).length;

  const cacheHitCount = perPlanOutcomes.filter(
    (outcome) => outcome.cacheStatus === "fresh_hit",
  ).length;
  const staleCacheServedCount = perPlanOutcomes.filter(
    (outcome) => outcome.cacheStatus === "stale_hit",
  ).length;
  const cacheMissCount = perPlanOutcomes.filter(
    (outcome) => outcome.cacheStatus === "miss",
  ).length;
  const cacheLookupLatencyMs = perPlanOutcomes.reduce(
    (sum, outcome) => sum + outcome.cacheLookupLatencyMs,
    0,
  );
  const cacheWriteLatencyMs = perPlanOutcomes.reduce(
    (sum, outcome) => sum + outcome.cacheWriteLatencyMs,
    0,
  );
  const lexicalLatencyMs = executionLogForRun.reduce(
    (sum, entry) => sum + (entry.lexicalLatencyMs ?? 0),
    0,
  );
  const rerankLatencyMs = executionLogForRun.reduce(
    (sum, entry) => sum + (entry.rerankLatencyMs ?? 0),
    0,
  );
  const plannerLatencyMs = performance.now() - plannerStart;
  const totalCandidatesBeforeDedupe =
    baselineCandidates.length + ragCandidates.length;
  const heavilyPrunedPlanCount = executionLogForRun.filter(
    (entry) =>
      entry.countBeforeTargeting > 0 &&
      entry.countAfterTargeting <= Math.floor(entry.countBeforeTargeting * 0.4),
  ).length;
  const plansWithRagHits = executionLogForRun.filter(
    (entry) => entry.ragReturnedCount > 0 || entry.ragContributedCount > 0,
  ).length;

  const hasPlanRefreshQueued = perPlanOutcomes.some(
    (outcome) => outcome.backgroundRefreshQueued,
  );
  const firstPlanRefreshReason = perPlanOutcomes.find(
    (outcome) => outcome.backgroundRefreshReason,
  )?.backgroundRefreshReason;

  const overallBackgroundRefreshQueued =
    backgroundRefreshQueued || hasPlanRefreshQueued;
  const overallBackgroundRefreshReason =
    backgroundRefreshReason ?? firstPlanRefreshReason;

  let latencyClassification: "healthy" | "degraded" | "budget_exceeded" =
    "healthy";
  let estimatedRequestCostUsd = 0;
  let costBudgetUsd = 0.01;
  let costBudgetStatus: "healthy" | "degraded" | "budget_exceeded" = "healthy";
  let observabilitySummary: Record<string, unknown> | undefined;
  let regressionSummary: Record<string, unknown> | undefined;
  let retrievalMetricsSnapshotPath: string | undefined;
  let retrievalCostDashboardPath: string | undefined;

  if (isRetrievalObservabilityEnabled()) {
    const snapshot = buildRetrievalObservabilitySnapshot({
      state: {
        ...state,
        retrievalContext: {
          ...state.retrievalContext,
          ...retrievalContext,
          queryPlans,
          executionLog: [
            ...(retrievalContext.executionLog ?? []),
            ...executionLogForRun,
          ],
          rawCandidates,
          totalBaselineCandidates: baselineCandidates.length,
          totalRagCandidates: ragCandidates.length,
          totalSemanticCandidates,
          totalUniqueCandidates: rawCandidates.length,
          patientHashUsed,
          ragUsed,
          semanticUsed,
          cacheHitCount,
          staleCacheServedCount,
          cacheMissCount,
          backgroundRefreshQueued: overallBackgroundRefreshQueued,
          backgroundRefreshReason: overallBackgroundRefreshReason,
          indexStatus,
          indexFreshness,
          sourceFingerprint,
          optimizerApplied,
          optimizerProfile,
          recommendedModeOrder,
          recommendedTopK,
          retrievalProfile,
          plannerLatencyMs,
          indexEnsureLatencyMs,
          lexicalLatencyMs,
          rerankLatencyMs,
          indexBuildLatencyMs,
          cacheLookupLatencyMs,
          cacheWriteLatencyMs,
          retryCount: nextRetry,
        },
      } as AgentStateType,
      timings: {
        lexicalMs: lexicalLatencyMs,
        rerankMs: rerankLatencyMs,
        cacheLookupMs: cacheLookupLatencyMs,
        indexEnsureMs: indexEnsureLatencyMs,
        totalPlannerMs: plannerLatencyMs,
      },
      totalCandidatesBeforeDedupe,
      totalAuthorizedCandidates: rawCandidates.length,
      totalAcceptedEvidence:
        state.evidenceContext.reviewJudgement?.acceptedEvidenceIds.length ?? 0,
      plansWithRagHits,
      zeroResultPlanCount: zeroResultPlans,
      heavilyPrunedPlanCount,
    });

    latencyClassification = snapshot.latencyClassification;
    estimatedRequestCostUsd = snapshot.estimatedRequestCostUsd;
    costBudgetUsd = snapshot.costBudgetUsd;
    costBudgetStatus = snapshot.costBudgetStatus;
    observabilitySummary = snapshot as unknown as Record<string, unknown>;

    if (shouldSaveRetrievalMetrics()) {
      try {
        retrievalMetricsSnapshotPath = appendRetrievalMetricsSnapshot(snapshot);

        const costDashboard = generateAndSaveRetrievalCostDashboard();
        retrievalCostDashboardPath = costDashboard.outputPath;
        if (costDashboard.dashboard.status !== "healthy") {
          console.warn("retrieval cost dashboard alert", {
            status: costDashboard.dashboard.status,
            warnings: costDashboard.dashboard.warnings,
            outputPath: costDashboard.outputPath,
          });
        }
      } catch (error) {
        retrievalMetricsSnapshotPath = undefined;
        retrievalCostDashboardPath = undefined;
        console.error("failed to append retrieval metrics snapshot", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const baselinePath = process.env.MEDAGENT_RETRIEVAL_REGRESSION_BASELINE;
    if (baselinePath) {
      try {
        const baselineSnapshots = loadRecentRetrievalMetrics({
          inputPath: baselinePath,
          limit: 200,
        });
        if (baselineSnapshots.length) {
          const baseline = summarizeSnapshotsForRegression(baselineSnapshots);
          const current = summarizeSnapshotsForRegression([snapshot]);
          const compared = compareRetrievalRegression({ baseline, current });
          regressionSummary = compared as unknown as Record<string, unknown>;
          saveRegressionReport({ report: compared });
        }
      } catch (error) {
        regressionSummary = undefined;
        console.error("retrieval regression baseline processing failed", {
          baselinePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const stepSummary = `Executed ${nextPlans.length} retrieval plans (retry ${currentRetry}). Baseline candidates ${baselineCandidates.length}, RAG candidates ${ragCandidates.length}, unique after dedupe ${rawCandidates.length}, zero-result plans ${zeroResultPlans}. Source mix: baseline-only ${baselineOnlyCount}, rag-only ${ragOnlyCount}, merged ${mixedSourceCount}. Cache hits ${cacheHitCount}, stale-served ${staleCacheServedCount}, misses ${cacheMissCount}.`;

  const updatedTrace = addTraceStep(
    trace,
    "ragRetrieve",
    "completed",
    stepSummary,
  );

  return {
    retrievalContext: {
      ...retrievalContext,
      queryPlans,
      executionLog: [
        ...(retrievalContext.executionLog ?? []),
        ...executionLogForRun,
      ],
      rawCandidates,
      totalBaselineCandidates: baselineCandidates.length,
      totalRagCandidates: ragCandidates.length,
      totalSemanticCandidates,
      totalUniqueCandidates: rawCandidates.length,
      patientHashUsed,
      ragUsed,
      semanticUsed,
      cacheHitCount,
      staleCacheServedCount,
      cacheMissCount,
      backgroundRefreshQueued: overallBackgroundRefreshQueued,
      backgroundRefreshReason: overallBackgroundRefreshReason,
      indexStatus,
      indexFreshness,
      sourceFingerprint,
      optimizerApplied,
      optimizerProfile,
      recommendedModeOrder,
      recommendedTopK,
      retrievalProfile,
      plannerLatencyMs,
      indexEnsureLatencyMs,
      lexicalLatencyMs,
      rerankLatencyMs,
      latencyClassification,
      estimatedRequestCostUsd,
      costBudgetUsd,
      costBudgetStatus,
      observabilitySummary,
      regressionSummary,
      retrievalMetricsSnapshotPath,
      retrievalCostDashboardPath,
      indexBuildLatencyMs,
      cacheLookupLatencyMs,
      cacheWriteLatencyMs,
      retryCount: nextRetry,
    },
    trace: updatedTrace,
    completedAgents: ["retrievalPlanner"],
  };
}
