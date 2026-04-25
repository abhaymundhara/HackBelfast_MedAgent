import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import {
  explainLexicalQueryPlan,
  inspectCacheFreshnessImpact,
  inspectFieldTargetingEffectiveness,
  inspectIndexFreshnessImpact,
  inspectNoteTypeTargetingEffectiveness,
  inspectQueryNormalization,
  inspectRerankContributionSignificance,
} from "@/lib/rag/eval/queryPlanDiagnostics";
import { normalizeMedicalQuery } from "@/lib/agent/retrieval/normalizeMedicalQuery";

describe("query plan diagnostics", () => {
  it("inspects normalization", () => {
    const normalized = normalizeMedicalQuery({ query: "allergy reaction risk" });
    const diag = inspectQueryNormalization(normalized);

    expect(diag.keywordTermCount).toBeGreaterThan(0);
    expect(diag.normalizedQuery.length).toBeGreaterThan(0);
  });

  it("inspects targeting effectiveness", () => {
    const plans = [
      { query: "q1", mode: "balanced", targetFields: ["allergies"], topK: 5 },
      { query: "q2", mode: "broad", targetNoteTypes: ["allergy_record"], topK: 5 },
    ] as any;
    const log = [
      { targetFields: ["allergies"], countAfterTargeting: 2, targetNoteTypes: [], queryPlanIndex: 0 },
      { targetFields: [], targetNoteTypes: ["allergy_record"], countAfterTargeting: 1, queryPlanIndex: 1 },
    ] as any;

    const fieldDiag = inspectFieldTargetingEffectiveness({ plans, executionLog: log });
    const noteDiag = inspectNoteTypeTargetingEffectiveness({ plans, executionLog: log });

    expect(fieldDiag.effectivenessRate).toBeGreaterThan(0);
    expect(noteDiag.effectivenessRate).toBeGreaterThan(0);
  });

  it("inspects index/cache/rerank impact", () => {
    const indexImpact = inspectIndexFreshnessImpact({
      indexFreshness: "stale",
      indexBuildLatencyMs: 20,
      totalLatencyMs: 100,
    });
    expect(indexImpact.indexBuildShare).toBeCloseTo(0.2);

    const cacheImpact = inspectCacheFreshnessImpact([
      { cacheStatus: "fresh_hit" },
      { cacheStatus: "stale_hit" },
      { cacheStatus: "miss" },
    ] as any);
    expect(cacheImpact.freshRate).toBeCloseTo(1 / 3);

    const rerank = inspectRerankContributionSignificance([
      { semanticTopScore: 0.3, fusionTopScore: 0.4 },
      { semanticTopScore: 0.4, fusionTopScore: 0.35 },
    ] as any);
    expect(rerank.averageUplift).not.toBe(0);
  });

  it("can explain lexical sqlite query plan", () => {
    const db = new Database(":memory:");
    try {
      db.exec(`
        CREATE TABLE lexical_chunk_metadata (chunk_id TEXT PRIMARY KEY, patient_hash TEXT);
        CREATE VIRTUAL TABLE lexical_chunk_fts USING fts5(chunk_id UNINDEXED, patient_hash UNINDEXED, content);
        INSERT INTO lexical_chunk_metadata (chunk_id, patient_hash) VALUES ('c1', 'p1');
        INSERT INTO lexical_chunk_fts (chunk_id, patient_hash, content) VALUES ('c1', 'p1', 'allergy risk');
      `);

      const plan = explainLexicalQueryPlan({
        db,
        patientHash: "p1",
        matchExpression: "allergy",
      });

      expect(plan.length).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });
});
