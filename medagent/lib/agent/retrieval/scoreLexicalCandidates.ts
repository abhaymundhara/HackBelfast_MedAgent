import { CanonicalEvidenceItem } from "@/lib/agent/state";
import {
  LexicalScoreBreakdown,
  NormalizedMedicalQuery,
} from "@/lib/agent/retrieval/retrievalTypes";

type LexicalScoreInput = {
  item: CanonicalEvidenceItem;
  bm25Score: number;
  query: NormalizedMedicalQuery;
  targetFields?: string[];
  targetNoteTypes?: string[];
};

const RECENCY_BOOST_BY_BUCKET: Record<
  CanonicalEvidenceItem["recencyBucket"],
  number
> = {
  current_admission: 0.22,
  last_30_days: 0.16,
  last_year: 0.08,
  historical: 0.03,
};

function toNormalizedBm25(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }

  // SQLite FTS5 bm25 is lower-is-better and can be negative.
  const effectiveScore = -score;
  const magnitude = Math.abs(effectiveScore);
  return magnitude / (1 + magnitude);
}

function countTermMatches(content: string, terms: string[]) {
  if (!terms.length) return 0;
  const lowerContent = content.toLowerCase();
  let matches = 0;

  for (const term of terms) {
    if (term && lowerContent.includes(term.toLowerCase())) {
      matches += 1;
    }
  }

  return matches;
}

export function scoreLexicalCandidate(
  input: LexicalScoreInput,
): LexicalScoreBreakdown {
  const { item, bm25Score, query, targetFields, targetNoteTypes } = input;

  const bm25Normalized = toNormalizedBm25(bm25Score);
  const matchedKeywordCount = countTermMatches(
    item.content,
    query.keywordTerms,
  );
  const matchedPhraseCount = countTermMatches(item.content, query.phraseTerms);

  const exactFieldMatch =
    !!targetFields?.length &&
    targetFields.includes(item.authorization.fieldKey);
  const exactNoteTypeMatch =
    !!targetNoteTypes?.length &&
    !!item.noteType &&
    targetNoteTypes.includes(item.noteType);

  const fieldMatchBoost = exactFieldMatch ? 0.32 : 0;
  const noteTypeMatchBoost = exactNoteTypeMatch ? 0.24 : 0;
  const recencyBoost = RECENCY_BOOST_BY_BUCKET[item.recencyBucket] ?? 0;
  const termCoverageBoost =
    matchedKeywordCount * 0.07 + matchedPhraseCount * 0.14;

  const finalScore =
    bm25Normalized * 1.45 +
    fieldMatchBoost +
    noteTypeMatchBoost +
    recencyBoost +
    termCoverageBoost;

  return {
    bm25Score,
    bm25Normalized,
    matchedKeywordCount,
    matchedPhraseCount,
    fieldMatchBoost,
    noteTypeMatchBoost,
    recencyBoost,
    termCoverageBoost,
    finalScore,
  };
}
