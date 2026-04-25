import { CanonicalEvidenceItem } from "@/lib/agent/state";
import {
  embedQueryText,
  LocalEmbeddingError,
} from "@/lib/agent/tools/retrievers/embedCanonicalEvidence";
import {
  getSemanticEvidenceById,
  getSemanticIndexStats,
  searchSemanticIndex,
} from "@/lib/agent/tools/retrievers/localSemanticIndex";
import { normalizeMedicalQuery } from "@/lib/agent/retrieval/normalizeMedicalQuery";

type LocalSemanticSearchInput = {
  query: string;
  patientHash: string;
  targetFields?: string[];
  targetNoteTypes?: string[];
  topK: number;
  mode: "balanced" | "broad" | "exact";
  retryIteration: number;
  queryPlanIndex: number;
};

export type LocalSemanticSearchOutput = {
  candidates: CanonicalEvidenceItem[];
  latencyMs: number;
  semanticIndexHit: boolean;
};

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function collectMatchedQueries(
  item: CanonicalEvidenceItem,
  query: ReturnType<typeof normalizeMedicalQuery>,
) {
  const contentLower = item.content.toLowerCase();
  const phraseMatches = query.phraseTerms.filter((term) =>
    contentLower.includes(term.toLowerCase()),
  );
  const keywordMatches = query.keywordTerms.filter((term) =>
    contentLower.includes(term.toLowerCase()),
  );

  return dedupe([...phraseMatches, ...keywordMatches]);
}

export function localSemanticSearch(
  input: LocalSemanticSearchInput,
): LocalSemanticSearchOutput {
  const start = performance.now();
  const normalized = normalizeMedicalQuery({ query: input.query });

  try {
    const embeddedQuery = embedQueryText(normalized.normalizedQuery);
    const semanticHits = searchSemanticIndex(embeddedQuery.embedding, {
      patientHash: input.patientHash,
      targetFields: input.targetFields,
      targetNoteTypes: input.targetNoteTypes,
      topK: input.topK,
    });

    const candidates: CanonicalEvidenceItem[] = [];
    for (const hit of semanticHits) {
      const item = getSemanticEvidenceById(hit.evidenceId);
      if (!item || item.patientHash !== input.patientHash) {
        continue;
      }

      const matchedQueries = collectMatchedQueries(item, normalized);
      const contributingPlanIndexes = dedupe([
        ...(item.retrieval?.contributingPlanIndexes ?? []).map(String),
        String(input.queryPlanIndex),
      ])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value));

      candidates.push({
        ...item,
        retrieval: {
          ...(item.retrieval ?? {}),
          source: "rag",
          mode: input.mode,
          retryIteration: input.retryIteration,
          queryPlanIndex: input.queryPlanIndex,
          query: normalized.rawQuery,
          rank: hit.rank,
          semanticScore: hit.semanticScore,
          score: hit.semanticScore,
          bestScore: hit.semanticScore,
          matchedQueries,
          sourcesSeen: dedupe([
            ...(item.retrieval?.sourcesSeen ?? []),
            "rag",
          ]) as Array<"baseline" | "rag">,
          contributingPlanIndexes,
        },
      });
    }

    const latencyMs = performance.now() - start;

    return {
      candidates,
      latencyMs,
      semanticIndexHit: getSemanticIndexStats(input.patientHash)
        .patientScopedCount
        ? true
        : false,
    };
  } catch (error) {
    const latencyMs = performance.now() - start;
    if (error instanceof LocalEmbeddingError) {
      throw error;
    }

    throw Object.assign(new Error("semantic_search_failed"), {
      cause: error,
      latencyMs,
    });
  }
}
