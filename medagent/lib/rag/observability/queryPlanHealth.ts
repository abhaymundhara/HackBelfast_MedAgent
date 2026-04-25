import Database from "better-sqlite3";

import { RetrievalExecutionRecord } from "@/lib/agent/state";
import { isExplainHealthcheckEnabled } from "@/lib/rag/observability/retrievalObservability";

export type QueryPlanHealthReport = {
  ftsUsed: boolean;
  patientScopingPreserved: boolean;
  fallbackScanDetected: boolean;
  unexpectedQueryShape: boolean;
  flags: string[];
  explainDetails: string[];
};

function containsAny(text: string, patterns: string[]) {
  const lower = text.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern.toLowerCase()));
}

export function evaluateExecutionLogHealth(
  executionLog: RetrievalExecutionRecord[],
): QueryPlanHealthReport {
  const total = executionLog.length;
  const zeroResultRate = total
    ? executionLog.filter((row) => row.zeroResult).length / total
    : 0;

  const patientScopingPreserved = executionLog.every(
    (row) =>
      Array.isArray(row.targetFields) &&
      Array.isArray(row.targetNoteTypes) &&
      (row.indexStatusAtQueryTime !== "missing" || !row.ragAttempted),
  );
  const fallbackScanDetected = executionLog.some(
    (row) => (row.lexicalReturnedCount ?? 0) === 0 && !row.zeroResult,
  );
  const unexpectedQueryShape = zeroResultRate > 0.7;

  const flags: string[] = [];
  if (!patientScopingPreserved) flags.push("patient_scope_violation");
  if (fallbackScanDetected) flags.push("fallback_scan_detected");
  if (unexpectedQueryShape) flags.push("query_shape_unexpected");

  return {
    ftsUsed: executionLog.some((row) => (row.lexicalReturnedCount ?? 0) > 0),
    patientScopingPreserved,
    fallbackScanDetected,
    unexpectedQueryShape,
    flags,
    explainDetails: [],
  };
}

export function evaluateSqliteQueryPlanHealth(input: {
  db: Database.Database;
  patientHash: string;
  matchExpression: string;
}): QueryPlanHealthReport {
  const explainDetails: string[] = [];

  if (!isExplainHealthcheckEnabled()) {
    return {
      ftsUsed: false,
      patientScopingPreserved: true,
      fallbackScanDetected: false,
      unexpectedQueryShape: false,
      flags: ["explain_disabled"],
      explainDetails,
    };
  }

  try {
    const rows = input.db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT m.chunk_id
         FROM lexical_chunk_fts
         INNER JOIN lexical_chunk_metadata m ON m.chunk_id = lexical_chunk_fts.chunk_id
         WHERE m.patient_hash = ? AND lexical_chunk_fts MATCH ?
         LIMIT 10`,
      )
      .all(input.patientHash, input.matchExpression) as Array<{
      detail: string;
    }>;

    for (const row of rows) {
      explainDetails.push(row.detail);
    }
  } catch {
    return {
      ftsUsed: false,
      patientScopingPreserved: false,
      fallbackScanDetected: true,
      unexpectedQueryShape: true,
      flags: ["explain_failed"],
      explainDetails,
    };
  }

  const merged = explainDetails.join(" | ").toLowerCase();
  const ftsUsed = containsAny(merged, ["fts", "virtual table", "match"]);
  const patientScopingPreserved = containsAny(merged, [
    "patient_hash",
    "m.patient_hash",
  ]);
  const hasTempTree = merged.includes("temp b-tree");
  const hasTableScan =
    /\bscan\s+table\b/.test(merged) && !/\bvirtual\b/.test(merged);
  const fallbackScanDetected = hasTempTree || hasTableScan;
  const unexpectedQueryShape = !ftsUsed || !patientScopingPreserved;

  const flags: string[] = [];
  if (!ftsUsed) flags.push("fts_not_used");
  if (!patientScopingPreserved) flags.push("patient_scope_not_detected");
  if (fallbackScanDetected) flags.push("expensive_scan_detected");
  if (unexpectedQueryShape) flags.push("query_shape_unexpected");

  return {
    ftsUsed,
    patientScopingPreserved,
    fallbackScanDetected,
    unexpectedQueryShape,
    flags,
    explainDetails,
  };
}
