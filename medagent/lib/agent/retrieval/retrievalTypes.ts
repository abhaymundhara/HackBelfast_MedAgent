import { CanonicalEvidenceItem, RetrievalQueryPlan } from "@/lib/agent/state";

export type NormalizedMedicalQuery = {
  rawQuery: string;
  normalizedQuery: string;
  phraseTerms: string[];
  keywordTerms: string[];
  fieldHints?: string[];
};

export type LexicalSearchInput = {
  patientHash: string;
  query: NormalizedMedicalQuery;
  targetFields?: string[];
  targetNoteTypes?: string[];
  topK?: number;
  mode?: RetrievalQueryPlan["mode"];
};

export type LexicalScoreBreakdown = {
  bm25Score: number;
  bm25Normalized: number;
  matchedKeywordCount: number;
  matchedPhraseCount: number;
  fieldMatchBoost: number;
  noteTypeMatchBoost: number;
  recencyBoost: number;
  termCoverageBoost: number;
  finalScore: number;
};

export type LexicalSearchResult = {
  item: CanonicalEvidenceItem;
  source: "rag";
  mode: RetrievalQueryPlan["mode"];
  query: string;
  score: number;
  matchedQueries: string[];
  scoreBreakdown: LexicalScoreBreakdown;
};

export type RetrievalIndexStats = {
  totalIndexed: number;
  indexedByField: Record<string, number>;
  indexedByNoteType: Record<string, number>;
  patientHash: string;
};

export type SemanticRerankInput = {
  query: NormalizedMedicalQuery;
  candidates: LexicalSearchResult[];
  targetFields?: string[];
  targetNoteTypes?: string[];
  topK: number;
  rerankModel?: string;
};

export type SemanticRerankResult = {
  results: LexicalSearchResult[];
  rerankApplied: boolean;
  rerankLatencyMs: number;
  rerankModel: string;
  inputCount: number;
  semanticTopScore?: number;
  fusionTopScore?: number;
};
