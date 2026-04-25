import { describe, expect, it } from "vitest";

import { CanonicalEvidenceItem } from "@/lib/agent/state";
import { embedQueryText } from "@/lib/agent/tools/retrievers/embedCanonicalEvidence";
import {
  buildSemanticIndex,
  getSemanticIndexStats,
  searchSemanticIndex,
  upsertSemanticIndex,
} from "@/lib/agent/tools/retrievers/localSemanticIndex";

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
    recencyBucket: "last_30_days",
    language: "en",
    provenance: {
      timestamp: input.timestamp ?? "2026-04-01T00:00:00.000Z",
    },
  };
}

describe("local semantic index", () => {
  it("enforces semantic patient isolation", () => {
    const patientA = "p-a";
    const patientB = "p-b";

    buildSemanticIndex([
      makeItem({
        id: "a-1",
        patientHash: patientA,
        fieldKey: "allergies",
        noteType: "allergy_record",
        content: "Severe medication allergy",
      }),
      makeItem({
        id: "b-1",
        patientHash: patientB,
        fieldKey: "allergies",
        noteType: "allergy_record",
        content: "Different patient allergy",
      }),
    ]);

    const queryEmbedding = embedQueryText("medication allergy").embedding;
    const results = searchSemanticIndex(queryEmbedding, {
      patientHash: patientA,
      topK: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.evidenceId.startsWith("a-"))).toBe(
      true,
    );
  });

  it("is deterministic and skips unchanged upserts", () => {
    const patientHash = "p-det";
    const items = [
      makeItem({
        id: "d-1",
        patientHash,
        fieldKey: "conditions",
        noteType: "condition_record",
        content: "Chronic diabetes condition",
      }),
      makeItem({
        id: "d-2",
        patientHash,
        fieldKey: "medications",
        noteType: "medication_record",
        content: "Insulin therapy",
      }),
    ];

    buildSemanticIndex(items, { patientHash });

    const first = searchSemanticIndex(
      embedQueryText("diabetes insulin").embedding,
      {
        patientHash,
        topK: 10,
      },
    );
    const second = searchSemanticIndex(
      embedQueryText("diabetes insulin").embedding,
      {
        patientHash,
        topK: 10,
      },
    );

    expect(first).toEqual(second);

    const upsert = upsertSemanticIndex(items, { patientHash });
    expect(upsert.updatedCount).toBe(0);

    const stats = getSemanticIndexStats(patientHash);
    expect(stats.indexLoaded).toBe(true);
    expect(stats.patientScopedCount).toBe(2);
  });
});
