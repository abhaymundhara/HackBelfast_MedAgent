import Database from "better-sqlite3";

import { RetrievalExecutionRecord, RetrievalQueryPlan } from "@/lib/agent/state";
import { NormalizedMedicalQuery } from "@/lib/agent/retrieval/retrievalTypes";
import {
  evaluateExecutionLogHealth,
  evaluateSqliteQueryPlanHealth,
} from "@/lib/rag/observability/queryPlanHealth";

function safeRate(value: number, total: number) {
  if (!total) return 0;
  return value / total;
}

export function inspectQueryNormalization(normalized: NormalizedMedicalQuery) {
  return {
    rawQuery: normalized.rawQuery,
    normalizedQuery: normalized.normalizedQuery,
    phraseTermCount: normalized.phraseTerms.length,
    keywordTermCount: normalized.keywordTerms.length,
    uniqueTermCount: new Set([
      ...normalized.phraseTerms,
      ...normalized.keywordTerms,
    ]).size,
  };
}

export function inspectFieldTargetingEffectiveness(input: {
  plans: RetrievalQueryPlan[];
  executionLog: RetrievalExecutionRecord[];
}) {
  const targeted = input.plans.filter((plan) => (plan.targetFields ?? []).length > 0).length;
  const effective = input.executionLog.filter(
    (row) => (row.targetFields?.length ?? 0) > 0 && row.countAfterTargeting > 0,
  ).length;

  return {
    targetedPlanCount: targeted,
    effectivePlanCount: effective,
    effectivenessRate: safeRate(effective, targeted || 1),
  };
}

export function inspectNoteTypeTargetingEffectiveness(input: {
  plans: RetrievalQueryPlan[];
  executionLog: RetrievalExecutionRecord[];
}) {
  const targeted = input.plans.filter((plan) => (plan.targetNoteTypes ?? []).length > 0).length;
  const effective = input.executionLog.filter(
    (row) => (row.targetNoteTypes?.length ?? 0) > 0 && row.countAfterTargeting > 0,
  ).length;

  return {
    targetedPlanCount: targeted,
    effectivePlanCount: effective,
    effectivenessRate: safeRate(effective, targeted || 1),
  };
}

export function inspectIndexFreshnessImpact(input: {
  indexFreshness: "fresh" | "stale" | "missing";
  indexBuildLatencyMs?: number;
  totalLatencyMs: number;
}) {
  return {
    indexFreshness: input.indexFreshness,
    indexBuildLatencyMs: input.indexBuildLatencyMs ?? 0,
    indexBuildShare: safeRate(input.indexBuildLatencyMs ?? 0, input.totalLatencyMs || 1),
  };
}

export function inspectCacheFreshnessImpact(executionLog: RetrievalExecutionRecord[]) {
  const total = executionLog.length || 1;
  const fresh = executionLog.filter((row) => row.cacheStatus === "fresh_hit").length;
  const stale = executionLog.filter((row) => row.cacheStatus === "stale_hit").length;
  const miss = executionLog.filter((row) => row.cacheStatus === "miss").length;

  return {
    fresh,
    stale,
    miss,
    freshRate: safeRate(fresh, total),
    staleRate: safeRate(stale, total),
    missRate: safeRate(miss, total),
  };
}

export function inspectRerankContributionSignificance(
  executionLog: RetrievalExecutionRecord[],
) {
  const rows = executionLog.filter(
    (row) => typeof row.semanticTopScore === "number" && typeof row.fusionTopScore === "number",
  );

  if (!rows.length) {
    return {
      averageUplift: 0,
      positiveUpliftRate: 0,
      significantUpliftRate: 0,
    };
  }

  const deltas = rows.map(
    (row) => (row.fusionTopScore ?? 0) - (row.semanticTopScore ?? 0),
  );

  return {
    averageUplift: deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
    positiveUpliftRate: safeRate(deltas.filter((delta) => delta > 0).length, deltas.length),
    significantUpliftRate: safeRate(
      deltas.filter((delta) => delta >= 0.05).length,
      deltas.length,
    ),
  };
}

export function explainLexicalQueryPlan(input: {
  db: Database.Database;
  patientHash: string;
  matchExpression: string;
}) {
  return evaluateSqliteQueryPlanHealth(input).explainDetails;
}

export function inspectPlannerHealthFlags(executionLog: RetrievalExecutionRecord[]) {
  return evaluateExecutionLogHealth(executionLog);
}
