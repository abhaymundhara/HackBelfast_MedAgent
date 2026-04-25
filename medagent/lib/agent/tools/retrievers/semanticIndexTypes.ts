import { z } from "zod";

export const SemanticIndexEntrySchema = z.object({
  evidenceId: z.string(),
  patientHash: z.string(),
  fieldKey: z.string(),
  noteType: z.string().optional(),
  contentHash: z.string(),
  embeddingModel: z.string(),
  embeddingDimensions: z.number().int().min(1),
  updatedAt: z.string(),
});
export type SemanticIndexEntry = z.infer<typeof SemanticIndexEntrySchema>;

export const SemanticSearchResultSchema = z.object({
  evidenceId: z.string(),
  semanticScore: z.number(),
  rank: z.number().int().min(1),
});
export type SemanticSearchResult = z.infer<typeof SemanticSearchResultSchema>;

export const SemanticIndexStatsSchema = z.object({
  indexLoaded: z.boolean(),
  entryCount: z.number().int().min(0),
  patientScopedCount: z.number().int().min(0).optional(),
  embeddingModel: z.string(),
  lastBuiltAt: z.string().optional(),
});
export type SemanticIndexStats = z.infer<typeof SemanticIndexStatsSchema>;

export const EmbeddedCanonicalEvidenceSchema = z
  .object({
    evidenceId: z.string(),
    patientHash: z.string(),
    fieldKey: z.string(),
    noteType: z.string().optional(),
    contentHash: z.string(),
    embeddingModel: z.string(),
    embeddingDimensions: z.number().int().min(1),
    normalizedText: z.string(),
    embedding: z.array(z.number()),
    updatedAt: z.string(),
  })
  .refine((data) => data.embedding.length === data.embeddingDimensions, {
    path: ["embedding"],
    message: "embedding length must equal embeddingDimensions",
  });
export type EmbeddedCanonicalEvidence = z.infer<
  typeof EmbeddedCanonicalEvidenceSchema
>;
