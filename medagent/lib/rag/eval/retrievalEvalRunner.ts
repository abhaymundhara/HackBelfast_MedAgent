import fs from "fs";
import path from "path";
import { z } from "zod";

import { runRetrievalPlanner } from "@/lib/agent/agents/retrievalPlanner";
import { AgentStateType, CanonicalEvidenceItem } from "@/lib/agent/state";
import { clearRetrievalCacheForTests } from "@/lib/rag/cache/retrievalCache";
import {
  ensureEvalDataset,
  mapPatientHashToPatientId,
} from "@/lib/rag/eval/retrievalEvalDataset";
import {
  EvalAggregateReport,
  EvalAggregateReportSchema,
  EvalPerPlanMetrics,
  EvalPerRequestMetrics,
  EvalRunConfig,
  EvalRunConfigSchema,
  PlannerConfig,
  RetrievalEvalDataset,
} from "@/lib/rag/eval/retrievalEvalTypes";
import {
  average,
  computeBackgroundRefreshRate,
  computeCacheHitRate,
  computeFieldCoverageScore,
  computeLexicalOnlyVsRerankedDelta,
  computeMrr,
  computeNdcgLite,
  computeNoteTypeCoverageScore,
  computePrecisionAtK,
  computeRecallAtK,
  computeRerankUpliftDelta,
  computeStaleCacheServeRate,
  computeZeroHitQueryCount,
} from "@/lib/rag/eval/retrievalMetrics";
import {
  compareRetrievalRegression,
  RetrievalRegressionSnapshotSchema,
  summarizeSnapshotsForRegression,
} from "@/lib/rag/observability/retrievalRegression";
import { RetrievalObservabilitySnapshotSchema } from "@/lib/rag/observability/retrievalObservability";

const MANIFEST_PATH = path.join(process.cwd(), "data", "index-manifest.json");
const DEFAULT_EVAL_ARTIFACT_DIR = path.join(
  process.cwd(),
  "data",
  "retrieval-observability",
  "eval",
);

export type EvalMachineSummary = {
  runId: string;
  generatedAt: string;
  mode: EvalRunConfig["mode"];
  requestCount: number;
  recallAtK: number;
  precisionAtK: number;
  mrr: number;
  ndcg: number;
  zeroHitQueryCount: number;
  avgLatencyMs: number;
};

const EvalMachineSummarySchema = z.object({
  runId: z.string(),
  generatedAt: z.string(),
  mode: z.enum(["lexical_only", "lexical_plus_rerank", "cached", "cold_start"]),
  requestCount: z.number().int().min(0),
  recallAtK: z.number(),
  precisionAtK: z.number(),
  mrr: z.number(),
  ndcg: z.number(),
  zeroHitQueryCount: z.number().int().min(0),
  avgLatencyMs: z.number().min(0),
});

function safeAverage(values: number[]) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return 0;
  return average(finite);
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function stableCandidateKey(candidate: CanonicalEvidenceItem) {
  return JSON.stringify({
    fieldKey: candidate.authorization.fieldKey,
    noteType: candidate.noteType ?? "",
    content: candidate.content,
    documentId: candidate.provenance.documentId ?? "",
    chunkIndex: candidate.provenance.chunkIndex ?? -1,
  });
}

function pickPreferredCandidate(input: {
  candidates: CanonicalEvidenceItem[];
  expectedFieldKeySet: Set<string>;
  rankById?: Map<string, number>;
}) {
  return [...input.candidates].sort((left, right) => {
    const leftFieldPreferred = input.expectedFieldKeySet.has(
      left.authorization.fieldKey,
    )
      ? 1
      : 0;
    const rightFieldPreferred = input.expectedFieldKeySet.has(
      right.authorization.fieldKey,
    )
      ? 1
      : 0;
    if (rightFieldPreferred !== leftFieldPreferred) {
      return rightFieldPreferred - leftFieldPreferred;
    }

    const leftScore = left.retrieval?.bestScore ?? left.retrieval?.score ?? 0;
    const rightScore =
      right.retrieval?.bestScore ?? right.retrieval?.score ?? 0;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    if (input.rankById) {
      const leftRank = input.rankById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = input.rankById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
    }

    return stableCandidateKey(left).localeCompare(stableCandidateKey(right));
  })[0];
}

export function resolveExpectedEvidenceIds(
  example: {
    expectedEvidenceIds: string[];
    expectedNoteTypes: string[];
    expectedFieldKeys: string[];
  },
  candidates: CanonicalEvidenceItem[],
): string[] {
  if (example.expectedEvidenceIds.length > 0) {
    return dedupe(example.expectedEvidenceIds);
  }

  const expectedNoteTypes = dedupe(example.expectedNoteTypes);
  const expectedFieldKeys = dedupe(example.expectedFieldKeys);
  const expectedFieldKeySet = new Set(expectedFieldKeys);
  const rankById = new Map(
    candidates.map((candidate, index) => [candidate.id, index]),
  );
  const resolved: string[] = [];

  if (expectedNoteTypes.length > 0) {
    for (const noteType of expectedNoteTypes) {
      const noteMatches = candidates.filter(
        (candidate) => candidate.noteType === noteType,
      );

      const selected = pickPreferredCandidate({
        candidates: noteMatches,
        expectedFieldKeySet,
        rankById,
      });

      resolved.push(selected ? selected.id : `__missing_note:${noteType}`);
    }

    return dedupe(resolved);
  }

  if (expectedFieldKeys.length > 0) {
    for (const fieldKey of expectedFieldKeys) {
      const selected = pickPreferredCandidate({
        candidates: candidates.filter(
          (candidate) => candidate.authorization.fieldKey === fieldKey,
        ),
        expectedFieldKeySet: new Set([fieldKey]),
        rankById,
      });
      resolved.push(selected ? selected.id : `__missing_field:${fieldKey}`);
    }
  }

  return dedupe(resolved);
}

function buildEvalState(input: {
  requestId: string;
  patientId: string;
  naturalLanguageRequest: string;
}): AgentStateType {
  return {
    requestContext: {
      requestId: input.requestId,
      patientId: input.patientId,
      requesterId: "did:solana:demo:doctor-1",
      naturalLanguageRequest: input.naturalLanguageRequest,
      targetLocale: "en",
      emergencyMode: true,
      patientApprovalPresent: false,
    },
    policyContext: {
      verified: true,
      decision: "granted",
      tier: 1,
      fieldsAllowed: [
        "allergies",
        "medications",
        "conditions",
        "alerts",
        "emergencyContact",
        "recentDischarge",
        "documents",
      ],
    },
    understandingContext: {
      focusAreas: ["allergies", "medications", "conditions", "alerts"],
      withheldAreas: [],
      ambiguityFlags: [],
      suggestedStrategy: "fallback",
    },
    retrievalContext: {
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
      cacheLookupLatencyMs: 0,
      cacheWriteLatencyMs: 0,
      retryCount: 0,
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
      estimatedRequestCostUsd: 0,
      costBudgetUsd: 0.01,
      costBudgetStatus: "healthy" as const,
    },
    evidenceContext: {
      authorizedChunks: [],
    },
    responseContext: {
      answerStatus: "pending",
    },
    completedAgents: [],
    trace: {
      requestId: input.requestId,
      patientId: input.patientId,
      requesterId: "did:solana:demo:doctor-1",
      steps: [],
    },
  } as AgentStateType;
}

function clearForColdStart() {
  clearRetrievalCacheForTests();
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.rmSync(MANIFEST_PATH, { force: true });
  }
}

function scorePerPlanMetrics(input: {
  expectedEvidenceIds: string[];
  expectedFieldKeys: string[];
  expectedNoteTypes: string[];
  k: number;
  candidates: CanonicalEvidenceItem[];
  executionLog: AgentStateType["retrievalContext"]["executionLog"];
}): EvalPerPlanMetrics[] {
  return input.executionLog.map((planRecord) => {
    const planCandidates = input.candidates.filter((candidate) => {
      const indexes = candidate.retrieval?.contributingPlanIndexes ?? [];
      return indexes.includes(planRecord.queryPlanIndex);
    });

    return {
      queryPlanIndex: planRecord.queryPlanIndex,
      mode: planRecord.mode,
      topK: planRecord.topK,
      recallAtK: computeRecallAtK({
        expectedEvidenceIds: input.expectedEvidenceIds,
        rankedItems: planCandidates,
        k: input.k,
      }),
      precisionAtK: computePrecisionAtK({
        expectedEvidenceIds: input.expectedEvidenceIds,
        rankedItems: planCandidates,
        k: input.k,
      }),
      mrr: computeMrr({
        expectedEvidenceIds: input.expectedEvidenceIds,
        rankedItems: planCandidates,
      }),
      ndcgLite: computeNdcgLite({
        expectedEvidenceIds: input.expectedEvidenceIds,
        rankedItems: planCandidates,
        k: input.k,
      }),
      fieldCoverageScore: computeFieldCoverageScore({
        expectedFieldKeys: input.expectedFieldKeys,
        rankedItems: planCandidates,
        k: input.k,
      }),
      noteTypeCoverageScore: computeNoteTypeCoverageScore({
        expectedNoteTypes: input.expectedNoteTypes,
        rankedItems: planCandidates,
        k: input.k,
      }),
      latencyMs: planRecord.lexicalLatencyMs ?? 0,
      cacheStatus: planRecord.cacheStatus,
    };
  });
}

function classifyMissReason(
  executionLog: AgentStateType["retrievalContext"]["executionLog"],
  requestMetrics: { recallAtK: number; precisionAtK: number },
) {
  const lexicalMissPlans = executionLog.filter(
    (record) =>
      (record.lexicalReturnedCount ?? 0) === 0 &&
      (record.semanticReturnedCount ?? 0) === 0 &&
      record.countBeforeTargeting === 0,
  ).length;
  const filterMissPlans = executionLog.filter(
    (record) =>
      record.countBeforeTargeting > 0 && record.countAfterTargeting === 0,
  ).length;
  const rerankInsufficiencyPlans = executionLog.filter((record) => {
    if (!record.rerankApplied) return false;
    if ((record.rerankInputCount ?? 0) === 0) return false;
    if (record.countAfterTargeting === 0) return false;
    return (
      requestMetrics.recallAtK === 0 ||
      requestMetrics.precisionAtK < 0.25 ||
      (record.semanticTopScore ?? 0) < 0.2
    );
  }).length;

  let missReason:
    | "none"
    | "lexical_miss"
    | "filter_miss"
    | "rerank_insufficiency" = "none";

  if (requestMetrics.recallAtK === 0) {
    if (filterMissPlans > 0) {
      missReason = "filter_miss";
    } else if (lexicalMissPlans > 0) {
      missReason = "lexical_miss";
    } else if (rerankInsufficiencyPlans > 0) {
      missReason = "rerank_insufficiency";
    }
  } else if (
    requestMetrics.precisionAtK < 0.25 &&
    rerankInsufficiencyPlans > 0
  ) {
    missReason = "rerank_insufficiency";
  }

  return {
    missReason,
    missReasonCounts: {
      lexicalMissPlans,
      filterMissPlans,
      rerankInsufficiencyPlans,
    },
  };
}

async function runSingleConfig(input: {
  dataset: RetrievalEvalDataset;
  runConfig: EvalRunConfig;
  plannerConfig: PlannerConfig;
}): Promise<EvalAggregateReport> {
  if (input.runConfig.mode === "cold_start") {
    clearForColdStart();
  } else if (input.runConfig.mode !== "cached") {
    clearRetrievalCacheForTests();
  }

    const requestMetrics: EvalPerRequestMetrics[] = [];

    for (const example of input.dataset.examples) {
      if (example.patientHash === "unknown") {
        continue;
      }

      const patientId = mapPatientHashToPatientId(example.patientHash);
      if (!patientId) {
        continue;
      }

      const requestState = buildEvalState({
        requestId: `${input.runConfig.runId}:${example.id}`,
        patientId,
        naturalLanguageRequest: example.naturalLanguageRequest,
      });

      if (input.runConfig.mode === "cold_start") {
        clearForColdStart();
      }

      const plannerRuntimeConfig = {
        enablePlanOptimizer: input.plannerConfig.enablePlanOptimizer,
        optimizerProfileOverride: input.plannerConfig.optimizerProfile,
        enableLocalRerank:
          input.runConfig.mode === "lexical_only"
            ? false
            : !input.plannerConfig.forceDisableRerank,
      } as const;

      const start = performance.now();
      const firstRun = await runRetrievalPlanner(
        requestState,
        plannerRuntimeConfig,
      );
      const firstLatencyMs = performance.now() - start;

      let cachedLatencyMs: number | null = null;
      let result = firstRun;
      if (input.runConfig.mode === "cached") {
        const cachedStart = performance.now();
        result = await runRetrievalPlanner(requestState, plannerRuntimeConfig);
        cachedLatencyMs = performance.now() - cachedStart;
      }

      const retrieval = result.retrievalContext;
      if (!retrieval) continue;

      const candidates = retrieval.rawCandidates;
      const executionLog = retrieval.executionLog;
      const expectedEvidenceIds = resolveExpectedEvidenceIds(
        example,
        candidates,
      );

      const recallAtK = computeRecallAtK({
        expectedEvidenceIds,
        rankedItems: candidates,
        k: input.runConfig.topK,
      });
      const precisionAtK = computePrecisionAtK({
        expectedEvidenceIds,
        rankedItems: candidates,
        k: input.runConfig.topK,
      });
      const mrr = computeMrr({
        expectedEvidenceIds,
        rankedItems: candidates,
      });
      const ndcgLite = computeNdcgLite({
        expectedEvidenceIds,
        rankedItems: candidates,
        k: input.runConfig.topK,
      });
      const fieldCoverageScore = computeFieldCoverageScore({
        expectedFieldKeys: example.expectedFieldKeys,
        rankedItems: candidates,
        k: input.runConfig.topK,
      });
      const noteTypeCoverageScore = computeNoteTypeCoverageScore({
        expectedNoteTypes: example.expectedNoteTypes,
        rankedItems: candidates,
        k: input.runConfig.topK,
      });
      const missClassification = classifyMissReason(executionLog, {
        recallAtK,
        precisionAtK,
      });
      const zeroHit = recallAtK === 0;

      requestMetrics.push({
        exampleId: example.id,
        mode: input.runConfig.mode,
        plannerConfig: input.plannerConfig,
        recallAtK,
        precisionAtK,
        mrr,
        ndcgLite,
        fieldCoverageScore,
        noteTypeCoverageScore,
        totalLatencyMs:
          input.runConfig.mode === "cached"
            ? (cachedLatencyMs ?? retrieval.plannerLatencyMs) ||
              retrieval.cacheLookupLatencyMs + retrieval.cacheWriteLatencyMs
            : firstLatencyMs,
        cacheHitRate: computeCacheHitRate(executionLog),
        staleCacheServeRate: computeStaleCacheServeRate(executionLog),
        backgroundRefreshRate: computeBackgroundRefreshRate(executionLog),
        rerankUpliftDelta: computeRerankUpliftDelta(executionLog),
        lexicalOnlyVsRerankedDelta:
          computeLexicalOnlyVsRerankedDelta(executionLog),
        zeroHit,
        missReason: missClassification.missReason,
        missReasonCounts: missClassification.missReasonCounts,
        perPlan: input.runConfig.includePerPlanMetrics
          ? scorePerPlanMetrics({
              expectedEvidenceIds,
              expectedFieldKeys: example.expectedFieldKeys,
              expectedNoteTypes: example.expectedNoteTypes,
              k: input.runConfig.topK,
              candidates,
              executionLog,
            })
          : [],
        metadataTags: example.metadataTags,
      });
    }

    const report = EvalAggregateReportSchema.parse({
      runId: input.runConfig.runId,
      mode: input.runConfig.mode,
      requestCount: requestMetrics.length,
      recallAtK: safeAverage(requestMetrics.map((item) => item.recallAtK)),
      precisionAtK: safeAverage(
        requestMetrics.map((item) => item.precisionAtK),
      ),
      mrr: safeAverage(requestMetrics.map((item) => item.mrr)),
      ndcgLite: safeAverage(requestMetrics.map((item) => item.ndcgLite)),
      fieldCoverageScore: safeAverage(
        requestMetrics.map((item) => item.fieldCoverageScore),
      ),
      noteTypeCoverageScore: safeAverage(
        requestMetrics.map((item) => item.noteTypeCoverageScore),
      ),
      avgLatencyMs: safeAverage(
        requestMetrics.map((item) => item.totalLatencyMs),
      ),
      cacheHitRate: safeAverage(
        requestMetrics.map((item) => item.cacheHitRate),
      ),
      staleCacheServeRate: safeAverage(
        requestMetrics.map((item) => item.staleCacheServeRate),
      ),
      backgroundRefreshRate: safeAverage(
        requestMetrics.map((item) => item.backgroundRefreshRate),
      ),
      rerankUpliftDelta: safeAverage(
        requestMetrics.map((item) => item.rerankUpliftDelta),
      ),
      lexicalOnlyVsRerankedDelta: safeAverage(
        requestMetrics.map((item) => item.lexicalOnlyVsRerankedDelta),
      ),
      requests: requestMetrics,
      diagnostics: {
        zeroHitExampleIds: dedupe(
          requestMetrics
            .filter((item) => item.zeroHit)
            .map((item) => item.exampleId),
        ),
        lexicalMissExampleIds: dedupe(
          requestMetrics
            .filter((item) => item.missReason === "lexical_miss")
            .map((item) => item.exampleId),
        ),
        filterMissExampleIds: dedupe(
          requestMetrics
            .filter((item) => item.missReason === "filter_miss")
            .map((item) => item.exampleId),
        ),
        rerankInsufficiencyExampleIds: dedupe(
          requestMetrics
            .filter((item) => item.missReason === "rerank_insufficiency")
            .map((item) => item.exampleId),
        ),
      },
    });

    return report;
}

export function toEvalMachineSummary(
  report: EvalAggregateReport,
): EvalMachineSummary {
  return {
    runId: report.runId,
    generatedAt: new Date().toISOString(),
    mode: report.mode,
    requestCount: report.requestCount,
    recallAtK: report.recallAtK,
    precisionAtK: report.precisionAtK,
    mrr: report.mrr,
    ndcg: report.ndcgLite,
    zeroHitQueryCount: computeZeroHitQueryCount(report.requests),
    avgLatencyMs: report.avgLatencyMs,
  };
}

export function saveEvalMachineSummary(input: {
  summary: EvalMachineSummary;
  outputPath?: string;
}) {
  const outputPath =
    input.outputPath ??
    path.join(DEFAULT_EVAL_ARTIFACT_DIR, `eval-summary-${Date.now()}.json`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(input.summary, null, 2));
  return outputPath;
}

export function loadEvalMachineSummary(
  filePath: string,
): EvalMachineSummary | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const result = EvalMachineSummarySchema.safeParse(parsed);
    if (!result.success) {
      console.warn("Invalid eval summary schema", {
        filePath,
        issues: result.error.issues.map((issue) => issue.message),
      });
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export function compareEvalSummaryAgainstBaseline(input: {
  baseline: EvalMachineSummary;
  current: EvalMachineSummary;
}) {
  const baseline = RetrievalRegressionSnapshotSchema.parse({
    recallAtK: input.baseline.recallAtK,
    mrr: input.baseline.mrr,
    ndcg: input.baseline.ndcg,
    zeroHitQueryCount: input.baseline.zeroHitQueryCount,
    requestCount: input.baseline.requestCount,
    avgLatencyMs: input.baseline.avgLatencyMs,
  });

  const current = RetrievalRegressionSnapshotSchema.parse({
    recallAtK: input.current.recallAtK,
    mrr: input.current.mrr,
    ndcg: input.current.ndcg,
    zeroHitQueryCount: input.current.zeroHitQueryCount,
    requestCount: input.current.requestCount,
    avgLatencyMs: input.current.avgLatencyMs,
  });

  const summary = compareRetrievalRegression({
    baseline: {
      ...baseline,
      p50LatencyMs: baseline.avgLatencyMs,
      p95LatencyMs: baseline.avgLatencyMs,
      zeroResultRate:
        baseline.requestCount && baseline.zeroHitQueryCount !== undefined
          ? baseline.zeroHitQueryCount / baseline.requestCount
          : 0,
      degradationRate: 0,
    },
    current: {
      ...current,
      p50LatencyMs: current.avgLatencyMs,
      p95LatencyMs: current.avgLatencyMs,
      zeroResultRate:
        current.requestCount && current.zeroHitQueryCount !== undefined
          ? current.zeroHitQueryCount / current.requestCount
          : 0,
      degradationRate: 0,
    },
  });

  return summary;
}

export async function runRetrievalEval(input: {
  dataset?: RetrievalEvalDataset;
  config: EvalRunConfig;
}): Promise<EvalAggregateReport> {
  const config = EvalRunConfigSchema.parse(input.config);
  const dataset = input.dataset ?? ensureEvalDataset();

  if (config.baselinePlannerConfig && config.candidatePlannerConfig) {
    const baseline = await runSingleConfig({
      dataset,
      runConfig: config,
      plannerConfig: config.baselinePlannerConfig,
    });
    const candidate = await runSingleConfig({
      dataset,
      runConfig: config,
      plannerConfig: config.candidatePlannerConfig,
    });

    const baselineById = new Map(
      baseline.requests.map((request) => [request.exampleId, request]),
    );
    const improvedExampleIds: string[] = [];
    const regressedExampleIds: string[] = [];
    for (const request of candidate.requests) {
      const previous = baselineById.get(request.exampleId);
      if (!previous) continue;
      const delta =
        (request.recallAtK - previous.recallAtK) * 0.5 +
        (request.precisionAtK - previous.precisionAtK) * 0.3 +
        (request.mrr - previous.mrr) * 0.2;
      if (delta > 0.01) improvedExampleIds.push(request.exampleId);
      else if (delta < -0.01) regressedExampleIds.push(request.exampleId);
    }

    return EvalAggregateReportSchema.parse({
      ...candidate,
      diagnostics: {
        ...(candidate.diagnostics ?? {
          zeroHitExampleIds: [],
          lexicalMissExampleIds: [],
          filterMissExampleIds: [],
          rerankInsufficiencyExampleIds: [],
        }),
        improvedExampleIds: dedupe(improvedExampleIds),
        regressedExampleIds: dedupe(regressedExampleIds),
      },
      plannerComparison: {
        baseline: {
          plannerConfig: config.baselinePlannerConfig,
          recallAtK: baseline.recallAtK,
          precisionAtK: baseline.precisionAtK,
          mrr: baseline.mrr,
          avgLatencyMs: baseline.avgLatencyMs,
        },
        candidate: {
          plannerConfig: config.candidatePlannerConfig,
          recallAtK: candidate.recallAtK,
          precisionAtK: candidate.precisionAtK,
          mrr: candidate.mrr,
          avgLatencyMs: candidate.avgLatencyMs,
        },
        delta: {
          recallAtK: candidate.recallAtK - baseline.recallAtK,
          precisionAtK: candidate.precisionAtK - baseline.precisionAtK,
          mrr: candidate.mrr - baseline.mrr,
          avgLatencyMs: candidate.avgLatencyMs - baseline.avgLatencyMs,
        },
      },
    });
  }

  return runSingleConfig({
    dataset,
    runConfig: config,
    plannerConfig: config.plannerConfig,
  });
}

export function summarizeMetricsSnapshotsForRegressionFromPath(
  inputPath: string,
) {
  if (!fs.existsSync(inputPath)) return null;
  const raw = fs.readFileSync(inputPath, "utf8").split("\n").filter(Boolean);
  const snapshots = raw.flatMap((line) => {
    try {
      const parsed = JSON.parse(line);
      const result = RetrievalObservabilitySnapshotSchema.safeParse(parsed);
      if (!result.success) {
        console.warn("Skipping invalid metrics snapshot line", {
          line,
          issues: result.error.issues.map((issue) => issue.message),
        });
        return [];
      }
      return [result.data];
    } catch {
      console.warn("Skipping malformed metrics snapshot line", { line });
      return [];
    }
  });
  return summarizeSnapshotsForRegression(snapshots);
}
