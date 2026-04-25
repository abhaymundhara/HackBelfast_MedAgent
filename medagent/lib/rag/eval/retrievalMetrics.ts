import {
  CanonicalEvidenceItem,
  RetrievalExecutionRecord,
} from "@/lib/agent/state";

function safeDivide(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function matchesTarget(item: CanonicalEvidenceItem, expectedIds: string[]) {
  return expectedIds.includes(item.id);
}

export function computeRecallAtK(input: {
  expectedEvidenceIds: string[];
  rankedItems: CanonicalEvidenceItem[];
  k: number;
}) {
  const expected = dedupe(input.expectedEvidenceIds);
  if (!expected.length) return 0;

  const top = input.rankedItems.slice(0, Math.max(1, input.k));
  const hits = top.filter((item) => matchesTarget(item, expected)).length;
  return safeDivide(hits, expected.length);
}

export function computePrecisionAtK(input: {
  expectedEvidenceIds: string[];
  rankedItems: CanonicalEvidenceItem[];
  k: number;
}) {
  const top = input.rankedItems.slice(0, Math.max(1, input.k));
  if (!top.length) return 0;
  const expected = dedupe(input.expectedEvidenceIds);
  if (!expected.length) return 0;

  const hits = top.filter((item) => matchesTarget(item, expected)).length;
  return safeDivide(hits, top.length);
}

export function computeMrr(input: {
  expectedEvidenceIds: string[];
  rankedItems: CanonicalEvidenceItem[];
}) {
  const expected = new Set(dedupe(input.expectedEvidenceIds));
  if (!expected.size) return 0;

  for (let index = 0; index < input.rankedItems.length; index += 1) {
    if (expected.has(input.rankedItems[index].id)) {
      return 1 / (index + 1);
    }
  }

  return 0;
}

export function computeNdcgLite(input: {
  expectedEvidenceIds: string[];
  rankedItems: CanonicalEvidenceItem[];
  k: number;
}) {
  const expected = new Set(dedupe(input.expectedEvidenceIds));
  const top = input.rankedItems.slice(0, Math.max(1, input.k));

  let dcg = 0;
  for (let i = 0; i < top.length; i += 1) {
    const gain = expected.has(top[i].id) ? 1 : 0;
    if (!gain) continue;
    dcg += gain / Math.log2(i + 2);
  }

  const idealHits = Math.min(expected.size, top.length);
  if (!idealHits) return 0;

  let idcg = 0;
  for (let i = 0; i < idealHits; i += 1) {
    idcg += 1 / Math.log2(i + 2);
  }

  return safeDivide(dcg, idcg);
}

export function computeFieldCoverageScore(input: {
  expectedFieldKeys: string[];
  rankedItems: CanonicalEvidenceItem[];
  k: number;
}) {
  const expected = dedupe(input.expectedFieldKeys);
  if (!expected.length) return 0;

  const expectedSet = new Set(expected);
  const seen = new Set<string>();

  for (const item of input.rankedItems.slice(0, Math.max(1, input.k))) {
    const fieldKey = item.authorization?.fieldKey;
    if (fieldKey && expectedSet.has(fieldKey)) {
      seen.add(fieldKey);
    }
  }

  return safeDivide(seen.size, expectedSet.size);
}

export function computeNoteTypeCoverageScore(input: {
  expectedNoteTypes: string[];
  rankedItems: CanonicalEvidenceItem[];
  k: number;
}) {
  const expected = dedupe(input.expectedNoteTypes);
  if (!expected.length) return 0;

  const expectedSet = new Set(expected);
  const seen = new Set<string>();

  for (const item of input.rankedItems.slice(0, Math.max(1, input.k))) {
    if (item.noteType && expectedSet.has(item.noteType)) {
      seen.add(item.noteType);
    }
  }

  return safeDivide(seen.size, expectedSet.size);
}

export function summarizeLatencyMs(values: number[]) {
  const filtered = values.filter(
    (value) => Number.isFinite(value) && value >= 0,
  );
  if (!filtered.length) {
    return { avg: 0, p50: 0, p95: 0, max: 0 };
  }

  const sorted = [...filtered].sort((a, b) => a - b);
  const pick = (quantile: number) => {
    const index = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * quantile),
    );
    return sorted[index];
  };

  return {
    avg: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p50: pick(0.5),
    p95: pick(0.95),
    max: sorted[sorted.length - 1],
  };
}

export function computeCacheHitRate(executionLog: RetrievalExecutionRecord[]) {
  if (!executionLog.length) return 0;
  const hits = executionLog.filter(
    (item) => item.cacheStatus === "fresh_hit",
  ).length;
  return safeDivide(hits, executionLog.length);
}

export function computeStaleCacheServeRate(
  executionLog: RetrievalExecutionRecord[],
) {
  if (!executionLog.length) return 0;
  const stale = executionLog.filter(
    (item) => item.cacheStatus === "stale_hit",
  ).length;
  return safeDivide(stale, executionLog.length);
}

export function computeBackgroundRefreshRate(
  executionLog: RetrievalExecutionRecord[],
) {
  if (!executionLog.length) return 0;
  const refreshed = executionLog.filter(
    (item) => item.backgroundRefreshQueued,
  ).length;
  return safeDivide(refreshed, executionLog.length);
}

export function computeRerankUpliftDelta(
  executionLog: RetrievalExecutionRecord[],
) {
  const rows = executionLog.filter(
    (item) =>
      typeof item.semanticTopScore === "number" &&
      typeof item.fusionTopScore === "number",
  );

  if (!rows.length) return 0;
  const delta = rows.reduce(
    (sum, item) =>
      sum + ((item.fusionTopScore ?? 0) - (item.semanticTopScore ?? 0)),
    0,
  );
  return delta / rows.length;
}

export function computeLexicalOnlyVsRerankedDelta(
  executionLog: RetrievalExecutionRecord[],
) {
  const reranked = executionLog.filter((row) => row.rerankApplied);
  const lexicalOnly = executionLog.filter((row) => row.rerankApplied === false);

  const rerankedScore = reranked.reduce(
    (sum, row) => sum + (row.fusionTopScore ?? 0),
    0,
  );
  const lexicalScore = lexicalOnly.reduce(
    (sum, row) => sum + (row.fusionTopScore ?? 0),
    0,
  );

  const rerankedAvg = safeDivide(rerankedScore, reranked.length);
  const lexicalAvg = safeDivide(lexicalScore, lexicalOnly.length);

  return rerankedAvg - lexicalAvg;
}

export function average(values: number[]) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

export function computeZeroHitQueryCount(values: Array<{ recallAtK: number }>) {
  return values.filter((value) => value.recallAtK <= 0).length;
}
