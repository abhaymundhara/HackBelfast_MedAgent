import { describe, expect, it } from "vitest";

import { CanonicalEvidenceItem } from "@/lib/agent/state";
import { resolveExpectedEvidenceIds } from "@/lib/rag/eval/retrievalEvalRunner";
import {
  computeMrr,
  computeNdcgLite,
  computePrecisionAtK,
  computeRecallAtK,
} from "@/lib/rag/eval/retrievalMetrics";

function item(
  id: string,
  fieldKey: string,
  noteType: string,
): CanonicalEvidenceItem {
  return {
    id,
    patientHash: "p1",
    content: id,
    authorization: {
      fieldKey,
      allowedForTiers: [1, 2, 3],
      sensitivityClass: "standard",
      requiresExplicitApproval: false,
    },
    sourceType: "structured_ips",
    noteType,
    extractionMode: "structured",
    sensitivityTags: [],
    clinicalTags: [],
    recencyBucket: "historical",
    language: "en",
    provenance: { timestamp: new Date().toISOString() },
  };
}

describe("resolveExpectedEvidenceIds", () => {
  it("keeps explicit gold evidence IDs unchanged (deduped order)", () => {
    const candidates = [item("e1", "allergies", "allergy_record")];
    const resolved = resolveExpectedEvidenceIds(
      {
        expectedEvidenceIds: ["gold-1", "gold-1", "gold-2"],
        expectedNoteTypes: ["allergy_record"],
        expectedFieldKeys: ["allergies"],
      },
      candidates,
    );

    expect(resolved).toEqual(["gold-1", "gold-2"]);
  });

  it("derives fallback IDs from expected note types", () => {
    const candidates = [
      item("c-allergy", "allergies", "allergy_record"),
      item("c-meds", "medications", "medication_record"),
    ];

    const resolved = resolveExpectedEvidenceIds(
      {
        expectedEvidenceIds: [],
        expectedNoteTypes: ["allergy_record", "medication_record"],
        expectedFieldKeys: [],
      },
      candidates,
    );

    expect(resolved).toEqual(["c-allergy", "c-meds"]);
  });

  it("prefers fieldKey-compatible candidates when note type and field key are both provided", () => {
    const candidates = [
      item("note-match-wrong-field", "conditions", "allergy_record"),
      item("note-match-right-field", "allergies", "allergy_record"),
    ];

    const resolved = resolveExpectedEvidenceIds(
      {
        expectedEvidenceIds: [],
        expectedNoteTypes: ["allergy_record"],
        expectedFieldKeys: ["allergies"],
      },
      candidates,
    );

    expect(resolved).toEqual(["note-match-right-field"]);
  });

  it("emits sentinel IDs when no matching candidate exists", () => {
    const candidates = [item("c1", "allergies", "allergy_record")];

    const byNoteType = resolveExpectedEvidenceIds(
      {
        expectedEvidenceIds: [],
        expectedNoteTypes: ["discharge_summary"],
        expectedFieldKeys: [],
      },
      candidates,
    );

    const byFieldKey = resolveExpectedEvidenceIds(
      {
        expectedEvidenceIds: [],
        expectedNoteTypes: [],
        expectedFieldKeys: ["recentDischarge"],
      },
      candidates,
    );

    expect(byNoteType).toEqual(["__missing_note:discharge_summary"]);
    expect(byFieldKey).toEqual(["__missing_field:recentDischarge"]);
  });

  it("enables non-zero retrieval metrics when note-type expectations are satisfied and explicit IDs are empty", () => {
    const candidates = [
      item("c-allergy", "allergies", "allergy_record"),
      item("c-meds", "medications", "medication_record"),
    ];

    const expectedEvidenceIds = resolveExpectedEvidenceIds(
      {
        expectedEvidenceIds: [],
        expectedNoteTypes: ["allergy_record", "medication_record"],
        expectedFieldKeys: [],
      },
      candidates,
    );

    expect(
      computeRecallAtK({
        expectedEvidenceIds,
        rankedItems: candidates,
        k: 2,
      }),
    ).toBeGreaterThan(0);
    expect(
      computePrecisionAtK({
        expectedEvidenceIds,
        rankedItems: candidates,
        k: 2,
      }),
    ).toBeGreaterThan(0);
    expect(
      computeMrr({
        expectedEvidenceIds,
        rankedItems: candidates,
      }),
    ).toBeGreaterThan(0);
    expect(
      computeNdcgLite({
        expectedEvidenceIds,
        rankedItems: candidates,
        k: 2,
      }),
    ).toBeGreaterThan(0);
  });
});
