import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateExecutionLogHealth,
  evaluateSqliteQueryPlanHealth,
} from "@/lib/rag/observability/queryPlanHealth";

describe("query plan health", () => {
  const originalExplain = process.env.MEDAGENT_RETRIEVAL_HEALTHCHECK_EXPLAIN;

  afterEach(() => {
    if (originalExplain === undefined) {
      delete process.env.MEDAGENT_RETRIEVAL_HEALTHCHECK_EXPLAIN;
    } else {
      process.env.MEDAGENT_RETRIEVAL_HEALTHCHECK_EXPLAIN = originalExplain;
    }
  });

  it("detects execution-log flags", () => {
    const report = evaluateExecutionLogHealth([
      {
        queryPlanIndex: 0,
        executedQuery: "q",
        mode: "balanced",
        targetFields: ["allergies"],
        targetNoteTypes: [],
        topK: 5,
        ragAttempted: true,
        indexStatusAtQueryTime: "ready",
        ragReturnedCount: 0,
        countBeforeTargeting: 5,
        countAfterTargeting: 5,
        baselineContributedCount: 0,
        ragContributedCount: 0,
        lexicalReturnedCount: 0,
        zeroResult: false,
      },
    ] as any);

    expect(report.fallbackScanDetected).toBe(true);
    expect(report.flags.includes("fallback_scan_detected")).toBe(true);
  });

  it("inspects sqlite explain details", () => {
    process.env.MEDAGENT_RETRIEVAL_HEALTHCHECK_EXPLAIN = "true";
    const db = new Database(":memory:");
    try {
      db.exec(`
        CREATE TABLE lexical_chunk_metadata (chunk_id TEXT PRIMARY KEY, patient_hash TEXT);
        CREATE VIRTUAL TABLE lexical_chunk_fts USING fts5(chunk_id UNINDEXED, patient_hash UNINDEXED, content);
        INSERT INTO lexical_chunk_metadata (chunk_id, patient_hash) VALUES ('c1', 'p1');
        INSERT INTO lexical_chunk_fts (chunk_id, patient_hash, content) VALUES ('c1', 'p1', 'allergy risk');
      `);

      const report = evaluateSqliteQueryPlanHealth({
        db,
        patientHash: "p1",
        matchExpression: "allergy",
      });

      expect(report.explainDetails.length).toBeGreaterThan(0);
      expect(typeof report.ftsUsed).toBe("boolean");
    } finally {
      db.close();
    }
  });

  it("fails open when explain is disabled", () => {
    process.env.MEDAGENT_RETRIEVAL_HEALTHCHECK_EXPLAIN = "false";
    const db = new Database(":memory:");
    try {
      const report = evaluateSqliteQueryPlanHealth({
        db,
        patientHash: "p1",
        matchExpression: "allergy",
      });

      expect(report.flags.includes("explain_disabled")).toBe(true);
    } finally {
      db.close();
    }
  });
});
