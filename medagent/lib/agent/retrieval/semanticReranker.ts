import {
  LexicalSearchResult,
  SemanticRerankInput,
  SemanticRerankResult,
} from "@/lib/agent/retrieval/retrievalTypes";
import { CanonicalEvidenceItem } from "@/lib/agent/state";

type RerankOptions = {
  enabled?: boolean;
  simulateFailure?: boolean;
};

const DEFAULT_RERANK_MODEL = "local-semantic-v1";

const SYNONYM_GROUPS = [
  ["allergy", "allergic", "hypersensitivity", "reaction", "anaphylaxis"],
  ["medication", "medications", "drug", "drugs", "medicine", "dose"],
  ["condition", "diagnosis", "comorbidity", "history"],
  ["risk", "danger", "warning", "contraindication"],
  ["discharge", "disposition", "followup", "follow-up"],
  ["care", "plan", "protocol"],
] as const;

const RECENCY_PRIOR_BY_BUCKET: Record<
  CanonicalEvidenceItem["recencyBucket"],
  number
> = {
  current_admission: 1,
  last_30_days: 0.8,
  last_year: 0.5,
  historical: 0.25,
};

const SYNONYM_LOOKUP = buildSynonymLookup();

function buildSynonymLookup() {
  const lookup = new Map<string, Set<string>>();

  for (const group of SYNONYM_GROUPS) {
    for (const token of group) {
      const normalized = normalizeToken(token);
      const peers = new Set(group.map(normalizeToken).filter(Boolean));
      lookup.set(normalized, peers);
    }
  }

  return lookup;
}

function normalizeToken(token: string) {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9%+\-/_.]/g, "")
    .trim();
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 1);
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function expandTokens(tokens: string[]) {
  const expanded = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);
    const peers = SYNONYM_LOOKUP.get(token);
    if (!peers) continue;
    for (const peer of peers) {
      expanded.add(peer);
    }
  }

  return expanded;
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function coverage(queryTokens: Set<string>, contentTokens: Set<string>) {
  if (!queryTokens.size) return 0;

  let hits = 0;
  for (const token of queryTokens) {
    if (contentTokens.has(token)) {
      hits += 1;
    }
  }

  return hits / queryTokens.size;
}

function computeSemanticScore(queryTerms: string[], content: string) {
  const normalizedQueryTokens = dedupe(queryTerms.map(normalizeToken));
  const queryExpanded = expandTokens(normalizedQueryTokens);

  const contentTokens = tokenize(content);
  const contentExpanded = expandTokens(contentTokens);

  const overlap = jaccard(queryExpanded, contentExpanded);
  const tokenCoverage = coverage(queryExpanded, contentExpanded);

  return overlap * 0.7 + tokenCoverage * 0.3;
}

function computePriorScore(
  result: LexicalSearchResult,
  targetFields?: string[],
  targetNoteTypes?: string[],
) {
  const item = result.item;

  const fieldScore =
    targetFields?.length && targetFields.includes(item.authorization.fieldKey)
      ? 1
      : 0;

  const noteTypeScore =
    targetNoteTypes?.length &&
    !!item.noteType &&
    targetNoteTypes.includes(item.noteType)
      ? 1
      : 0;

  const recencyScore = RECENCY_PRIOR_BY_BUCKET[item.recencyBucket] ?? 0;

  return fieldScore * 0.4 + noteTypeScore * 0.3 + recencyScore * 0.3;
}

function lexicalOnlyResult(
  input: SemanticRerankInput,
  rerankModel: string,
  rerankLatencyMs: number,
  rerankApplied: boolean,
): SemanticRerankResult {
  const lexicalOrdered = [...input.candidates]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const timestampCompare = right.item.provenance.timestamp.localeCompare(
        left.item.provenance.timestamp,
      );
      if (timestampCompare !== 0) {
        return timestampCompare;
      }

      return left.item.id.localeCompare(right.item.id);
    })
    .slice(0, input.topK)
    .map((entry) => ({
      ...entry,
      item: {
        ...entry.item,
        retrieval: {
          ...(entry.item.retrieval ?? {}),
          source: entry.item.retrieval?.source ?? "rag",
          retryIteration: entry.item.retrieval?.retryIteration ?? 0,
          rerankApplied,
          rerankModel,
          rerankLatencyMs,
          fusionScore: entry.score,
        },
      },
    }));

  return {
    results: lexicalOrdered,
    rerankApplied,
    rerankLatencyMs,
    rerankModel,
    inputCount: input.candidates.length,
    fusionTopScore: lexicalOrdered[0]?.score,
  };
}

export function rerankLexicalShortlist(
  input: SemanticRerankInput,
  options?: RerankOptions,
): SemanticRerankResult {
  const rerankModel = input.rerankModel ?? DEFAULT_RERANK_MODEL;
  const start = performance.now();

  if (options?.enabled === false || !input.candidates.length) {
    const rerankLatencyMs = performance.now() - start;
    return lexicalOnlyResult(input, rerankModel, rerankLatencyMs, false);
  }

  try {
    if (options?.simulateFailure) {
      throw new Error("simulated_local_rerank_failure");
    }

    const queryTerms = [
      ...input.query.keywordTerms,
      ...input.query.phraseTerms.flatMap((phrase) => phrase.split(/\s+/)),
    ];

    const scored = input.candidates.map((candidate) => {
      const semanticScore = computeSemanticScore(
        queryTerms,
        candidate.item.content,
      );
      const priorScore = computePriorScore(
        candidate,
        input.targetFields,
        input.targetNoteTypes,
      );

      // Deterministic, explicit fusion policy.
      const fusionScore =
        candidate.score * 0.55 + semanticScore * 0.35 + priorScore * 0.1;

      return {
        ...candidate,
        score: fusionScore,
        item: {
          ...candidate.item,
          retrieval: {
            ...(candidate.item.retrieval ?? {}),
            source: candidate.item.retrieval?.source ?? "rag",
            retryIteration: candidate.item.retrieval?.retryIteration ?? 0,
            semanticScore,
            fusionScore,
            rerankModel,
            rerankApplied: true,
          },
        },
        _lexicalScore: candidate.score,
        _semanticScore: semanticScore,
        _fusionScore: fusionScore,
      };
    });

    scored.sort((left, right) => {
      if (right._fusionScore !== left._fusionScore) {
        return right._fusionScore - left._fusionScore;
      }
      if (right._semanticScore !== left._semanticScore) {
        return right._semanticScore - left._semanticScore;
      }
      const lexicalTieBreak = right._lexicalScore - left._lexicalScore;
      if (lexicalTieBreak !== 0) {
        return lexicalTieBreak;
      }

      const timestampCompare = right.item.provenance.timestamp.localeCompare(
        left.item.provenance.timestamp,
      );
      if (timestampCompare !== 0) {
        return timestampCompare;
      }

      return left.item.id.localeCompare(right.item.id);
    });

    const rerankLatencyMs = performance.now() - start;
    const results = scored.slice(0, input.topK).map((entry) => ({
      ...entry,
      item: {
        ...entry.item,
        retrieval: {
          ...(entry.item.retrieval ?? {}),
          source: entry.item.retrieval?.source ?? "rag",
          retryIteration: entry.item.retrieval?.retryIteration ?? 0,
          rerankLatencyMs,
          score: entry._fusionScore,
          bestScore: entry._fusionScore,
        },
      },
    }));

    return {
      results,
      rerankApplied: true,
      rerankLatencyMs,
      rerankModel,
      inputCount: input.candidates.length,
      semanticTopScore: results[0]?.item.retrieval?.semanticScore,
      fusionTopScore: results[0]?.item.retrieval?.fusionScore,
    };
  } catch {
    const rerankLatencyMs = performance.now() - start;
    return lexicalOnlyResult(input, rerankModel, rerankLatencyMs, false);
  }
}
