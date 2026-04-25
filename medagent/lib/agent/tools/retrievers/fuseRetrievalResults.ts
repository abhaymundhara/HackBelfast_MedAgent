import { CanonicalEvidenceItem, RetrievalQueryPlan } from "@/lib/agent/state";

type FusionWeights = {
  lexical: number;
  semantic: number;
  field: number;
  noteType: number;
  recency: number;
};

type FuseRetrievalInput = {
  lexicalCandidates: CanonicalEvidenceItem[];
  semanticCandidates: CanonicalEvidenceItem[];
  plan: RetrievalQueryPlan;
  fusionMethod?: "rrf" | "weighted";
  fusionWeights?: Partial<FusionWeights>;
};

export type FuseRetrievalOutput = {
  fusedCandidates: CanonicalEvidenceItem[];
  fusionApplied: boolean;
  fusionInputCount: number;
  fusionTopScore?: number;
};

const DEFAULT_WEIGHTS: FusionWeights = {
  lexical: 0.55,
  semantic: 0.3,
  field: 0.08,
  noteType: 0.05,
  recency: 0.02,
};

const DEFAULT_RRF_K = 60;

const RECENCY_BONUS_BY_BUCKET: Record<
  CanonicalEvidenceItem["recencyBucket"],
  number
> = {
  current_admission: 1,
  last_30_days: 0.8,
  last_year: 0.5,
  historical: 0.2,
};

function normalizeScore(score: number | undefined) {
  if (!Number.isFinite(score)) {
    return 0;
  }
  const absolute = Math.abs(score as number);
  return absolute <= 1 ? absolute : absolute / (1 + absolute);
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function dedupeNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

function makeIdentityKey(item: CanonicalEvidenceItem) {
  if (item.id) return item.id;

  return JSON.stringify({
    content: item.content,
    fieldKey: item.authorization.fieldKey,
    documentId: item.provenance.documentId ?? null,
    chunkIndex: item.provenance.chunkIndex ?? null,
    timestamp: item.provenance.timestamp,
  });
}

function parseFusionMethod(
  explicit: FuseRetrievalInput["fusionMethod"],
): "rrf" | "weighted" {
  if (explicit) return explicit;

  const configured = process.env.MEDAGENT_FUSION_METHOD?.trim().toLowerCase();
  if (configured === "weighted") return "weighted";
  return "rrf";
}

function buildRankMap(
  candidates: CanonicalEvidenceItem[],
  scoreSelector: (candidate: CanonicalEvidenceItem) => number,
) {
  const map = new Map<string, number>();

  const ranked = [...candidates].sort((left, right) => {
    const leftScore = scoreSelector(left);
    const rightScore = scoreSelector(right);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const leftTime = Date.parse(left.provenance.timestamp);
    const rightTime = Date.parse(right.provenance.timestamp);
    if (
      !Number.isNaN(leftTime) &&
      !Number.isNaN(rightTime) &&
      leftTime !== rightTime
    ) {
      return rightTime - leftTime;
    }

    return makeIdentityKey(left).localeCompare(makeIdentityKey(right));
  });

  for (const [index, candidate] of ranked.entries()) {
    const key = makeIdentityKey(candidate);
    if (!map.has(key)) {
      map.set(key, index + 1);
    }
  }
  return map;
}

function mergeCandidate(
  left: CanonicalEvidenceItem,
  right: CanonicalEvidenceItem,
): CanonicalEvidenceItem {
  const leftScore = left.retrieval?.score;
  const rightScore = right.retrieval?.score;
  const mergedScore =
    leftScore === undefined && rightScore === undefined
      ? undefined
      : Math.max(leftScore ?? -Infinity, rightScore ?? -Infinity);

  const mergedRetrieval = {
    ...(left.retrieval ?? right.retrieval),
    source: (left.retrieval?.source ?? right.retrieval?.source ?? "rag") as
      | "baseline"
      | "rag",
    retryIteration: Math.max(
      left.retrieval?.retryIteration ?? 0,
      right.retrieval?.retryIteration ?? 0,
    ),
    mode: left.retrieval?.mode ?? right.retrieval?.mode,
    query: left.retrieval?.query ?? right.retrieval?.query,
    queryPlanIndex:
      left.retrieval?.queryPlanIndex ?? right.retrieval?.queryPlanIndex,
    score: mergedScore,
    bestScore: Math.max(
      left.retrieval?.bestScore ?? left.retrieval?.score ?? 0,
      right.retrieval?.bestScore ?? right.retrieval?.score ?? 0,
    ),
    semanticScore: Math.max(
      left.retrieval?.semanticScore ?? 0,
      right.retrieval?.semanticScore ?? 0,
    ),
    matchedQueries: dedupe([
      ...(left.retrieval?.matchedQueries ?? []),
      ...(right.retrieval?.matchedQueries ?? []),
      left.retrieval?.query ?? "",
      right.retrieval?.query ?? "",
    ]),
    sourcesSeen: dedupe([
      ...(left.retrieval?.sourcesSeen ?? []),
      ...(right.retrieval?.sourcesSeen ?? []),
      left.retrieval?.source ?? "",
      right.retrieval?.source ?? "",
    ]) as Array<"baseline" | "rag">,
    contributingPlanIndexes: dedupeNumbers([
      ...(left.retrieval?.contributingPlanIndexes ?? []),
      ...(right.retrieval?.contributingPlanIndexes ?? []),
      left.retrieval?.queryPlanIndex ?? -1,
      right.retrieval?.queryPlanIndex ?? -1,
    ]).filter((index) => index >= 0),
  };

  const leftBest = left.retrieval?.bestScore ?? left.retrieval?.score ?? 0;
  const rightBest = right.retrieval?.bestScore ?? right.retrieval?.score ?? 0;
  const best = rightBest > leftBest ? right : left;

  return {
    ...best,
    retrieval: mergedRetrieval,
  };
}

export function fuseRetrievalResults(
  input: FuseRetrievalInput,
): FuseRetrievalOutput {
  const fusionMethod = parseFusionMethod(input.fusionMethod);
  const weights = {
    ...DEFAULT_WEIGHTS,
    ...(input.fusionWeights ?? {}),
  };

  const lexicalRanks = buildRankMap(input.lexicalCandidates, (candidate) =>
    normalizeScore(candidate.retrieval?.score),
  );
  const semanticRanks = buildRankMap(input.semanticCandidates, (candidate) =>
    normalizeScore(candidate.retrieval?.semanticScore),
  );

  const byIdentity = new Map<string, CanonicalEvidenceItem>();

  for (const candidate of [
    ...input.lexicalCandidates,
    ...input.semanticCandidates,
  ]) {
    const key = makeIdentityKey(candidate);
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, candidate);
      continue;
    }
    byIdentity.set(key, mergeCandidate(existing, candidate));
  }

  const fusedCandidates = [...byIdentity.values()].map((item) => {
    const identityKey = makeIdentityKey(item);
    const lexicalScore = normalizeScore(item.retrieval?.score);
    const semanticScore = normalizeScore(item.retrieval?.semanticScore);
    const fieldBonus =
      input.plan.targetFields?.length &&
      input.plan.targetFields.includes(item.authorization.fieldKey)
        ? 1
        : 0;
    const noteTypeBonus =
      input.plan.targetNoteTypes?.length &&
      !!item.noteType &&
      input.plan.targetNoteTypes.includes(item.noteType)
        ? 1
        : 0;
    const recencyBonus = RECENCY_BONUS_BY_BUCKET[item.recencyBucket] ?? 0;

    const weightedScore =
      lexicalScore * weights.lexical +
      semanticScore * weights.semantic +
      fieldBonus * weights.field +
      noteTypeBonus * weights.noteType +
      recencyBonus * weights.recency;

    const lexicalRank = lexicalRanks.get(identityKey);
    const semanticRank = semanticRanks.get(identityKey);
    const rrfScore =
      (lexicalRank ? 1 / (DEFAULT_RRF_K + lexicalRank) : 0) +
      (semanticRank ? 1 / (DEFAULT_RRF_K + semanticRank) : 0) +
      fieldBonus * 0.0009 +
      noteTypeBonus * 0.0006 +
      recencyBonus * 0.0004;

    const fusionScore = fusionMethod === "weighted" ? weightedScore : rrfScore;

    return {
      ...item,
      retrieval: {
        ...(item.retrieval ?? {}),
        source: item.retrieval?.source ?? "rag",
        retryIteration: item.retrieval?.retryIteration ?? 0,
        fusionScore,
        bestScore: Math.max(item.retrieval?.bestScore ?? 0, fusionScore),
      },
      __lexicalScore: lexicalScore,
      __semanticScore: semanticScore,
      __fusionScore: fusionScore,
      __identityKey: identityKey,
    };
  });

  fusedCandidates.sort((left, right) => {
    if (right.__fusionScore !== left.__fusionScore) {
      return right.__fusionScore - left.__fusionScore;
    }
    if (right.__semanticScore !== left.__semanticScore) {
      return right.__semanticScore - left.__semanticScore;
    }
    if (right.__lexicalScore !== left.__lexicalScore) {
      return right.__lexicalScore - left.__lexicalScore;
    }

    const leftTime = Date.parse(left.provenance.timestamp);
    const rightTime = Date.parse(right.provenance.timestamp);
    if (
      !Number.isNaN(leftTime) &&
      !Number.isNaN(rightTime) &&
      leftTime !== rightTime
    ) {
      return rightTime - leftTime;
    }

    return left.__identityKey.localeCompare(right.__identityKey);
  });

  const stripped = fusedCandidates.map(
    ({
      __fusionScore: _,
      __lexicalScore: __,
      __semanticScore: ___,
      __identityKey: ____,
      ...item
    }) => ({
      ...item,
      retrieval: {
        ...(item.retrieval ?? {}),
        score: item.retrieval?.fusionScore ?? item.retrieval?.score,
        bestScore: item.retrieval?.fusionScore ?? item.retrieval?.bestScore,
      },
    }),
  );

  return {
    fusedCandidates: stripped,
    fusionApplied: true,
    fusionInputCount: byIdentity.size,
    fusionTopScore: stripped[0]?.retrieval?.fusionScore,
  };
}
