import { CanonicalEvidenceItem } from "../agent/state";

/**
 * Core RAG data contracts.
 *
 * CodeDB-inspired design goals:
 * - tightly typed payloads
 * - low allocation overhead
 * - structures optimized for posting-list indexing
 */

export type PatientNoteType =
  | "allergy"
  | "adverse_reaction"
  | "lab_trend"
  | "risk_episode"
  | "chronic_condition"
  | "medication_safety"
  | "procedure_history"
  | "mental_health"
  | "genetic"
  | "care_plan"
  | "social_history";

export interface RetrievalResult {
  chunk: CanonicalEvidenceItem;
  score: number;
  relevanceExplanation: string;
}

export interface IndexStats {
  chunkCount: number;
  patientCount: number;
  trigramCount: number;
  vocabularySize: number;
  postingEntries: number;
  positionalEntries: number;
  avgTokensPerChunk: number;
  lastBuildMs: number;
}
