export type RetrievalCacheKeyInput = {
  patientHash: string;
  normalizedQuery: string;
  mode: "balanced" | "broad" | "exact";
  targetFields?: string[];
  targetNoteTypes?: string[];
  topK: number;
  sourceFingerprint: string;
};

function normalizeList(values: string[] | undefined) {
  return [...new Set((values ?? []).filter(Boolean))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}

export function buildRetrievalCacheKey(input: RetrievalCacheKeyInput) {
  const payload = {
    patientHash: input.patientHash,
    normalizedQuery: input.normalizedQuery,
    mode: input.mode,
    targetFields: normalizeList(input.targetFields),
    targetNoteTypes: normalizeList(input.targetNoteTypes),
    topK: input.topK,
    sourceFingerprint: input.sourceFingerprint,
  };

  return JSON.stringify(payload);
}
