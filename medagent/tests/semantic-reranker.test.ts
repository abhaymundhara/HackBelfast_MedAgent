import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { CanonicalEvidenceItem } from "@/lib/agent/state";
import { buildLexicalIndex } from "@/lib/agent/retrieval/buildLexicalIndex";
import { localLexicalSearch } from "@/lib/agent/retrieval/localLexicalSearch";
import { normalizeMedicalQuery } from "@/lib/agent/retrieval/normalizeMedicalQuery";
import { rerankLexicalShortlist } from "@/lib/agent/retrieval/semanticReranker";

function makeItem(input: {
  id: string;
  patientHash: string;
  fieldKey: string;
  noteType: string;
  content: string;
  timestamp?: string;
}): CanonicalEvidenceItem {
  return {
    id: input.id,
    patientHash: input.patientHash,
    content: input.content,
    authorization: {
      fieldKey: input.fieldKey,
      allowedForTiers: [1, 2, 3],
      sensitivityClass: "standard",
      requiresExplicitApproval: false,
    },
    sourceType: "document",
    noteType: input.noteType,
    extractionMode: "narrative",
    sensitivityTags: [],
    clinicalTags: ["test"],
    recencyBucket: "current_admission",
    language: "en",
    provenance: {
      timestamp: input.timestamp ?? "2026-04-01T00:00:00.000Z",
    },
  };
}

describe("local semantic reranker", () => {
  it("falls back to lexical-only when reranker fails", () => {
    const query = normalizeMedicalQuery({ query: "drug allergy" });
    const lexical = [
      {
        item: makeItem({
          id: "x-1",
          patientHash: "p1",
          fieldKey: "allergies",
          noteType: "allergy_record",
          content: "drug allergy",
        }),
        source: "rag" as const,
        mode: "balanced" as const,
        query: "drug allergy",
        score: 3,
        matchedQueries: ["drug", "allergy"],
        scoreBreakdown: {
          bm25Score: -1,
          bm25Normalized: 0.5,
          matchedKeywordCount: 2,
          matchedPhraseCount: 0,
          fieldMatchBoost: 0.25,
          noteTypeMatchBoost: 0,
          recencyBoost: 0.35,
          termCoverageBoost: 0,
          finalScore: 3,
        },
      },
    ];

    const result = rerankLexicalShortlist(
      {
        query,
        candidates: lexical,
        topK: 1,
      },
      { simulateFailure: true },
    );

    expect(result.rerankApplied).toBe(false);
    expect(result.results[0].item.id).toBe("x-1");
  });

  it("has deterministic stable ordering for score ties", () => {
    const query = normalizeMedicalQuery({ query: "clinical summary" });

    const lexical = [
      {
        item: makeItem({
          id: "b",
          patientHash: "p1",
          fieldKey: "documents",
          noteType: "upload",
          content: "clinical summary",
          timestamp: "2026-04-01T00:00:00.000Z",
        }),
        source: "rag" as const,
        mode: "balanced" as const,
        query: "clinical summary",
        score: 2,
        matchedQueries: ["clinical"],
        scoreBreakdown: {
          bm25Score: -1,
          bm25Normalized: 0.5,
          matchedKeywordCount: 1,
          matchedPhraseCount: 0,
          fieldMatchBoost: 0,
          noteTypeMatchBoost: 0,
          recencyBoost: 0.35,
          termCoverageBoost: 0,
          finalScore: 2,
        },
      },
      {
        item: makeItem({
          id: "a",
          patientHash: "p1",
          fieldKey: "documents",
          noteType: "upload",
          content: "clinical summary",
          timestamp: "2026-04-01T00:00:00.000Z",
        }),
        source: "rag" as const,
        mode: "balanced" as const,
        query: "clinical summary",
        score: 2,
        matchedQueries: ["clinical"],
        scoreBreakdown: {
          bm25Score: -1,
          bm25Normalized: 0.5,
          matchedKeywordCount: 1,
          matchedPhraseCount: 0,
          fieldMatchBoost: 0,
          noteTypeMatchBoost: 0,
          recencyBoost: 0.35,
          termCoverageBoost: 0,
          finalScore: 2,
        },
      },
    ];

    const first = rerankLexicalShortlist({
      query,
      candidates: lexical,
      topK: 2,
    });
    const second = rerankLexicalShortlist({
      query,
      candidates: lexical,
      topK: 2,
    });

    expect(first.results.map((item) => item.item.id)).toEqual(["a", "b"]);
    expect(first.results.map((item) => item.item.id)).toEqual(
      second.results.map((item) => item.item.id),
    );
  });

  it("improves synonym-style matches over lexical-only ordering", () => {
    const query = normalizeMedicalQuery({ query: "drug hypersensitivity" });

    const lexical = [
      {
        item: makeItem({
          id: "lexical-first",
          patientHash: "p1",
          fieldKey: "medications",
          noteType: "medication_record",
          content: "Drug refill and dosing instructions.",
        }),
        source: "rag" as const,
        mode: "balanced" as const,
        query: "drug hypersensitivity",
        score: 2.2,
        matchedQueries: ["drug"],
        scoreBreakdown: {
          bm25Score: -0.8,
          bm25Normalized: 0.55,
          matchedKeywordCount: 1,
          matchedPhraseCount: 0,
          fieldMatchBoost: 0,
          noteTypeMatchBoost: 0,
          recencyBoost: 0.35,
          termCoverageBoost: 0,
          finalScore: 2.2,
        },
      },
      {
        item: makeItem({
          id: "semantic-winner",
          patientHash: "p1",
          fieldKey: "allergies",
          noteType: "allergy_record",
          content: "Severe medication allergy with prior anaphylaxis.",
        }),
        source: "rag" as const,
        mode: "balanced" as const,
        query: "drug hypersensitivity",
        score: 2.15,
        matchedQueries: ["drug"],
        scoreBreakdown: {
          bm25Score: -0.7,
          bm25Normalized: 0.58,
          matchedKeywordCount: 1,
          matchedPhraseCount: 0,
          fieldMatchBoost: 0,
          noteTypeMatchBoost: 0,
          recencyBoost: 0.35,
          termCoverageBoost: 0,
          finalScore: 2.15,
        },
      },
    ];

    const reranked = rerankLexicalShortlist({
      query,
      candidates: lexical,
      topK: 2,
      targetFields: ["allergies"],
      targetNoteTypes: ["allergy_record"],
    });
    expect(reranked.rerankApplied).toBe(true);
    expect(reranked.results[0].item.id).toBe("semantic-winner");
  });

  it("preserves patient isolation and target constraints before final selection", () => {
    const db = new Database(":memory:");
    const patientA = "patient-A";
    const patientB = "patient-B";

    buildLexicalIndex(
      [
        makeItem({
          id: "a-allergy",
          patientHash: patientA,
          fieldKey: "allergies",
          noteType: "allergy_record",
          content: "Latex hypersensitivity with severe allergy",
        }),
        makeItem({
          id: "a-med",
          patientHash: patientA,
          fieldKey: "medications",
          noteType: "medication_record",
          content: "Insulin dosing and medication plan",
        }),
      ],
      { db, mode: "rebuild", patientHash: patientA },
    );

    buildLexicalIndex(
      [
        makeItem({
          id: "b-allergy",
          patientHash: patientB,
          fieldKey: "allergies",
          noteType: "allergy_record",
          content: "Different patient allergy",
        }),
      ],
      { db, mode: "rebuild", patientHash: patientB },
    );

    const lexical = localLexicalSearch(
      {
        patientHash: patientA,
        query: normalizeMedicalQuery({ query: "hypersensitivity medication" }),
        targetFields: ["allergies"],
        targetNoteTypes: ["allergy_record"],
        topK: 20,
      },
      { db },
    );

    const reranked = rerankLexicalShortlist(
      {
        query: normalizeMedicalQuery({ query: "hypersensitivity medication" }),
        candidates: lexical,
        targetFields: ["allergies"],
        targetNoteTypes: ["allergy_record"],
        topK: 5,
      },
      { enabled: true },
    );

    expect(
      reranked.results.every((item) => item.item.patientHash === patientA),
    ).toBe(true);
    expect(
      reranked.results.every(
        (item) =>
          item.item.authorization.fieldKey === "allergies" &&
          item.item.noteType === "allergy_record",
      ),
    ).toBe(true);

    const original = lexical[0].item.authorization;
    const fused = reranked.results[0].item.authorization;
    expect(fused).toEqual(original);
  });
});
