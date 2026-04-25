import { describe, expect, it } from "vitest";

import { normalizeMedicalQuery } from "@/lib/agent/retrieval/normalizeMedicalQuery";

describe("normalizeMedicalQuery", () => {
  it("infers field hints from clinical intent terms", () => {
    const normalized = normalizeMedicalQuery({
      query:
        "Need emergency contact details and discharge follow up care plan context",
    });

    expect(normalized.fieldHints).toEqual(
      expect.arrayContaining([
        "emergencyContact",
        "recentDischarge",
        "documents",
        "alerts",
      ]),
    );
  });

  it("expands keywords with retrieval-oriented synonyms", () => {
    const normalized = normalizeMedicalQuery({
      query: "urgent consent contact context",
    });

    expect(normalized.keywordTerms).toEqual(
      expect.arrayContaining(["phone", "relationship", "emergency"]),
    );
  });
});
