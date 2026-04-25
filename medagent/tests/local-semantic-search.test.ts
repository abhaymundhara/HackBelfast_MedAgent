import { describe, expect, it } from "vitest";

import { CanonicalEvidenceItem } from "@/lib/agent/state";
import { buildSemanticIndex } from "@/lib/agent/tools/retrievers/localSemanticIndex";
import { localSemanticSearch } from "@/lib/agent/tools/retrievers/localSemanticSearch";

function makeItem(input: {
  id: string;
  patientHash: string;
  fieldKey: string;
  noteType: string;
  content: string;
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
      timestamp: "2026-04-01T00:00:00.000Z",
    },
  };
}

describe("local semantic search", () => {
  it("applies targetFields and targetNoteTypes while preserving metadata", () => {
    const patientHash = "p-sem";

    buildSemanticIndex([
      makeItem({
        id: "s-1",
        patientHash,
        fieldKey: "allergies",
        noteType: "allergy_record",
        content: "Severe hypersensitivity and medication allergy",
      }),
      makeItem({
        id: "s-2",
        patientHash,
        fieldKey: "medications",
        noteType: "medication_record",
        content: "Insulin treatment",
      }),
    ]);

    const result = localSemanticSearch({
      query: "hypersensitivity medication",
      patientHash,
      targetFields: ["allergies"],
      targetNoteTypes: ["allergy_record"],
      topK: 5,
      mode: "balanced",
      retryIteration: 1,
      queryPlanIndex: 2,
    });

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(
      result.candidates.every((item) => item.patientHash === patientHash),
    ).toBe(true);
    expect(
      result.candidates.every(
        (item) =>
          item.authorization.fieldKey === "allergies" &&
          item.noteType === "allergy_record",
      ),
    ).toBe(true);

    const retrieval = result.candidates[0].retrieval;
    expect(retrieval?.source).toBe("rag");
    expect(retrieval?.semanticScore).toBeTypeOf("number");
    expect(retrieval?.queryPlanIndex).toBe(2);
    expect(retrieval?.contributingPlanIndexes).toContain(2);
  });
});
