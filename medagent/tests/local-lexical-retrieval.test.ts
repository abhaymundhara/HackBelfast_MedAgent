import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { CanonicalEvidenceItem } from "@/lib/agent/state";
import { buildLexicalIndex } from "@/lib/agent/retrieval/buildLexicalIndex";
import { localLexicalSearch } from "@/lib/agent/retrieval/localLexicalSearch";
import { normalizeMedicalQuery } from "@/lib/agent/retrieval/normalizeMedicalQuery";

function makeItem(input: {
  id: string;
  patientHash: string;
  fieldKey: string;
  noteType: string;
  content: string;
  recencyBucket?: CanonicalEvidenceItem["recencyBucket"];
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
    recencyBucket: input.recencyBucket ?? "historical",
    language: "en",
    provenance: {
      timestamp: input.timestamp ?? "2026-01-01T00:00:00.000Z",
    },
  };
}

describe("local lexical retrieval", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  it("returns only same-patient chunks", () => {
    const patientA = "patient-a";
    const patientB = "patient-b";

    buildLexicalIndex(
      [
        makeItem({
          id: "a1",
          patientHash: patientA,
          fieldKey: "allergies",
          noteType: "allergy_record",
          content: "Severe penicillin allergy with anaphylaxis",
        }),
      ],
      { db, mode: "rebuild", patientHash: patientA },
    );

    buildLexicalIndex(
      [
        makeItem({
          id: "b1",
          patientHash: patientB,
          fieldKey: "allergies",
          noteType: "allergy_record",
          content: "Severe penicillin allergy in another patient",
        }),
      ],
      { db, mode: "rebuild", patientHash: patientB },
    );

    const results = localLexicalSearch(
      {
        patientHash: patientA,
        query: normalizeMedicalQuery({ query: "penicillin allergy" }),
        topK: 5,
      },
      { db },
    );

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((result) => result.item.patientHash === patientA),
    ).toBe(true);
  });

  it("applies targetFields filtering", () => {
    const patientHash = "patient-filter-fields";
    const items = [
      makeItem({
        id: "f1",
        patientHash,
        fieldKey: "allergies",
        noteType: "allergy_record",
        content: "Latex allergy",
      }),
      makeItem({
        id: "f2",
        patientHash,
        fieldKey: "medications",
        noteType: "medication_record",
        content: "Levetiracetam 500mg",
      }),
    ];

    buildLexicalIndex(items, { db, mode: "rebuild", patientHash });

    const results = localLexicalSearch(
      {
        patientHash,
        query: normalizeMedicalQuery({ query: "allergy levetiracetam" }),
        targetFields: ["allergies"],
      },
      { db },
    );

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (result) => result.item.authorization.fieldKey === "allergies",
      ),
    ).toBe(true);
  });

  it("applies noteType filtering", () => {
    const patientHash = "patient-filter-note-type";
    const items = [
      makeItem({
        id: "n1",
        patientHash,
        fieldKey: "conditions",
        noteType: "condition_record",
        content: "Type 2 diabetes chronic condition",
      }),
      makeItem({
        id: "n2",
        patientHash,
        fieldKey: "conditions",
        noteType: "lab_result",
        content: "HbA1c 7.6 percent",
      }),
    ];

    buildLexicalIndex(items, { db, mode: "rebuild", patientHash });

    const results = localLexicalSearch(
      {
        patientHash,
        query: normalizeMedicalQuery({ query: "diabetes hba1c" }),
        targetNoteTypes: ["lab_result"],
      },
      { db },
    );

    expect(results.length).toBe(1);
    expect(results[0].item.noteType).toBe("lab_result");
  });

  it("prefers exact field/note type and recency in ranking", () => {
    const patientHash = "patient-ranking";

    const olderExact = makeItem({
      id: "r-older",
      patientHash,
      fieldKey: "medications",
      noteType: "medication_record",
      content: "Insulin safety check before procedure",
      recencyBucket: "historical",
      timestamp: "2025-01-01T00:00:00.000Z",
    });

    const recentExact = makeItem({
      id: "r-recent",
      patientHash,
      fieldKey: "medications",
      noteType: "medication_record",
      content: "Insulin safety check before procedure",
      recencyBucket: "current_admission",
      timestamp: "2026-04-01T00:00:00.000Z",
    });

    const wrongField = makeItem({
      id: "r-wrong",
      patientHash,
      fieldKey: "allergies",
      noteType: "allergy_record",
      content: "Insulin safety check before procedure",
      recencyBucket: "current_admission",
      timestamp: "2026-04-01T00:00:00.000Z",
    });

    buildLexicalIndex([olderExact, recentExact, wrongField], {
      db,
      mode: "rebuild",
      patientHash,
    });

    const input = {
      patientHash,
      query: normalizeMedicalQuery({ query: "insulin safety" }),
      targetFields: ["medications"],
      targetNoteTypes: ["medication_record"],
      topK: 3,
      mode: "exact" as const,
    };

    const firstRun = localLexicalSearch(input, { db });
    const secondRun = localLexicalSearch(input, { db });

    expect(firstRun[0].item.id).toBe("r-recent");
    expect(firstRun.map((result) => result.item.id)).toEqual(
      secondRun.map((result) => result.item.id),
    );
  });

  it("fails open to metadata fallback when lexical match is sparse", () => {
    const patientHash = "patient-sparse-fallback";
    const items = [
      makeItem({
        id: "c1",
        patientHash,
        fieldKey: "emergencyContact",
        noteType: "contact_info",
        content: '{"name":"A. Person","phone":"+44-000"}',
        recencyBucket: "last_30_days",
      }),
    ];

    buildLexicalIndex(items, { db, mode: "rebuild", patientHash });

    const results = localLexicalSearch(
      {
        patientHash,
        query: normalizeMedicalQuery({
          query: "need emergency contact details for urgent consent",
        }),
        targetFields: ["emergencyContact"],
        targetNoteTypes: ["contact_info"],
        topK: 3,
        mode: "balanced",
      },
      { db },
    );

    expect(results).toHaveLength(1);
    expect(results[0].item.id).toBe("c1");
    expect(results[0].item.authorization.fieldKey).toBe("emergencyContact");
  });

  it("treats reserved FTS keywords as literal terms", () => {
    const patientHash = "patient-literal-keyword";
    buildLexicalIndex(
      [
        makeItem({
          id: "kw1",
          patientHash,
          fieldKey: "documents",
          noteType: "document",
          content: "OR marker appears in this note",
        }),
      ],
      { db, mode: "rebuild", patientHash },
    );

    const results = localLexicalSearch(
      {
        patientHash,
        query: {
          rawQuery: "OR marker",
          normalizedQuery: "or marker",
          phraseTerms: [],
          keywordTerms: ["OR", "marker"],
        },
        topK: 5,
      },
      { db },
    );

    expect(results).toHaveLength(1);
    expect(results[0].item.id).toBe("kw1");
  });
});
