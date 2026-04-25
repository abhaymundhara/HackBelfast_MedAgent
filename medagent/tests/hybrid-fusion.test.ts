import { describe, expect, it } from "vitest";

import {
  CanonicalEvidenceItem,
  RetrievalQueryPlanSchema,
} from "@/lib/agent/state";
import { fuseRetrievalResults } from "@/lib/agent/tools/retrievers/fuseRetrievalResults";

function makeCandidate(input: {
  id: string;
  fieldKey: string;
  noteType: string;
  content: string;
  score?: number;
  semanticScore?: number;
  queryPlanIndex?: number;
  matchedQueries?: string[];
  timestamp?: string;
}): CanonicalEvidenceItem {
  return {
    id: input.id,
    patientHash: "fusion-patient",
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
    retrieval: {
      source: "rag",
      retryIteration: 0,
      mode: "balanced",
      query: "test",
      queryPlanIndex: input.queryPlanIndex ?? 0,
      score: input.score,
      semanticScore: input.semanticScore,
      matchedQueries: input.matchedQueries ?? [],
      sourcesSeen: ["rag"],
      contributingPlanIndexes: [input.queryPlanIndex ?? 0],
    },
  };
}

describe("hybrid fusion", () => {
  it("is deterministic and preserves provenance metadata", () => {
    const plan = RetrievalQueryPlanSchema.parse({
      query: "allergy risk",
      mode: "balanced",
      targetFields: ["allergies"],
      targetNoteTypes: ["allergy_record"],
      topK: 5,
    });

    const lexical = [
      makeCandidate({
        id: "same-id",
        fieldKey: "allergies",
        noteType: "allergy_record",
        content: "Severe allergy reaction",
        score: 0.8,
        queryPlanIndex: 0,
        matchedQueries: ["allergy"],
      }),
      makeCandidate({
        id: "lexical-only",
        fieldKey: "medications",
        noteType: "medication_record",
        content: "Medication note",
        score: 0.7,
        queryPlanIndex: 0,
        matchedQueries: ["risk"],
      }),
    ];

    const semantic = [
      makeCandidate({
        id: "same-id",
        fieldKey: "allergies",
        noteType: "allergy_record",
        content: "Severe allergy reaction",
        semanticScore: 0.9,
        queryPlanIndex: 1,
        matchedQueries: ["reaction"],
      }),
    ];

    const first = fuseRetrievalResults({
      lexicalCandidates: lexical,
      semanticCandidates: semantic,
      plan,
    });
    const second = fuseRetrievalResults({
      lexicalCandidates: lexical,
      semanticCandidates: semantic,
      plan,
    });

    expect(first.fusedCandidates.map((item) => item.id)).toEqual(
      second.fusedCandidates.map((item) => item.id),
    );

    const merged = first.fusedCandidates.find((item) => item.id === "same-id");
    expect(merged?.retrieval?.matchedQueries).toEqual(
      expect.arrayContaining(["allergy", "reaction"]),
    );
    expect(merged?.retrieval?.contributingPlanIndexes).toEqual(
      expect.arrayContaining([0, 1]),
    );
    expect(merged?.retrieval?.fusionScore).toBeTypeOf("number");
    expect(merged?.authorization.fieldKey).toBe("allergies");
  });

  it("prefers newer timestamps on fusion score ties", () => {
    const plan = RetrievalQueryPlanSchema.parse({
      query: "risk",
      mode: "balanced",
      topK: 5,
    });

    const older = makeCandidate({
      id: "older",
      fieldKey: "alerts",
      noteType: "medical_alert",
      content: "same content",
      score: 0.5,
      semanticScore: 0.5,
      timestamp: "2025-01-01T00:00:00.000Z",
    });
    const newer = makeCandidate({
      id: "newer",
      fieldKey: "alerts",
      noteType: "medical_alert",
      content: "same content",
      score: 0.5,
      semanticScore: 0.5,
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const fused = fuseRetrievalResults({
      lexicalCandidates: [older, newer],
      semanticCandidates: [],
      plan,
    });

    expect(fused.fusedCandidates[0]?.id).toBe("newer");
  });

  it("uses RRF as default with weighted fusion available as override", () => {
    const plan = RetrievalQueryPlanSchema.parse({
      query: "contraindication risk",
      mode: "balanced",
      topK: 5,
    });

    const lexical = [
      makeCandidate({
        id: "lexical-heavy",
        fieldKey: "alerts",
        noteType: "medical_alert",
        content: "contraindication risk summary",
        score: 1,
        queryPlanIndex: 0,
      }),
      makeCandidate({
        id: "semantic-heavy",
        fieldKey: "alerts",
        noteType: "medical_alert",
        content: "contraindication risk summary semantic variant",
        score: 0.2,
        queryPlanIndex: 0,
      }),
    ];

    const semantic = [
      makeCandidate({
        id: "semantic-heavy",
        fieldKey: "alerts",
        noteType: "medical_alert",
        content: "contraindication risk summary semantic variant",
        semanticScore: 0.95,
        queryPlanIndex: 1,
      }),
      makeCandidate({
        id: "lexical-heavy",
        fieldKey: "alerts",
        noteType: "medical_alert",
        content: "contraindication risk summary",
        semanticScore: 0.1,
        queryPlanIndex: 1,
      }),
    ];

    const rrfDefault = fuseRetrievalResults({
      lexicalCandidates: lexical,
      semanticCandidates: semantic,
      plan,
    });

    const weighted = fuseRetrievalResults({
      lexicalCandidates: lexical,
      semanticCandidates: semantic,
      plan,
      fusionMethod: "weighted",
    });

    expect(rrfDefault.fusedCandidates[0]?.id).toBe("semantic-heavy");
    expect(weighted.fusedCandidates[0]?.id).toBe("lexical-heavy");
  });
});
