import { describe, expect, it } from "vitest";

import {
  DEFAULT_DATASET_PATH,
  loadRetrievalEvalDataset,
} from "@/lib/rag/eval/retrievalEvalDataset";

describe("retrieval eval dataset", () => {
  it("is schema-valid and expanded beyond the seed pair", () => {
    const dataset = loadRetrievalEvalDataset(DEFAULT_DATASET_PATH);

    expect(dataset.examples.length).toBeGreaterThanOrEqual(12);
    expect(dataset.examples.length).toBeLessThanOrEqual(20);

    for (const example of dataset.examples) {
      expect(example.expectedEvidenceIds).toEqual([]);
      expect(
        example.expectedFieldKeys.length > 0 ||
          example.expectedNoteTypes.length > 0,
      ).toBe(true);
    }
  });
});
