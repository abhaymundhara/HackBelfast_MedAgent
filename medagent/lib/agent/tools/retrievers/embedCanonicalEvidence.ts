import crypto from "crypto";

import { CanonicalEvidenceItem } from "@/lib/agent/state";
import { EmbeddedCanonicalEvidence } from "@/lib/agent/tools/retrievers/semanticIndexTypes";

const DEFAULT_EMBED_MODEL = "local-hash-embed-v1";
const DEFAULT_EMBED_DIMS = 128;
const MAX_EMBED_DIMS = 4096;

export class LocalEmbeddingError extends Error {
  readonly code = "LOCAL_EMBEDDING_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "LocalEmbeddingError";
  }
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTagList(tags: string[]) {
  return [...new Set(tags.map((tag) => normalizeText(tag)).filter(Boolean))];
}

function parseEmbeddingDimensions() {
  const raw = process.env.MEDAGENT_LOCAL_EMBED_DIMS;
  if (!raw) return DEFAULT_EMBED_DIMS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_EMBED_DIMS) {
    throw new LocalEmbeddingError("invalid_embedding_dimensions");
  }
  return parsed;
}

function hashToBucket(token: string, dimensions: number) {
  const digest = crypto.createHash("sha256").update(token).digest();
  const value = digest.readUInt32BE(0);
  return value % dimensions;
}

function tokenize(text: string) {
  return text
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9%+\-/_.]/g, "").trim())
    .filter((token) => token.length > 1);
}

function buildEmbeddingVector(text: string, dimensions: number) {
  const tokens = tokenize(text);
  const vector = new Array<number>(dimensions).fill(0);

  if (!tokens.length) {
    return vector;
  }

  const frequency = new Map<string, number>();
  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  for (const [token, tf] of frequency) {
    const bucket = hashToBucket(token, dimensions);
    const signSeed = crypto.createHash("md5").update(token).digest()[0] ?? 0;
    const sign = signSeed % 2 === 0 ? 1 : -1;
    const weight = 1 + Math.log1p(tf);
    vector[bucket] += sign * weight;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

function buildEmbeddingText(item: CanonicalEvidenceItem) {
  const fieldKey = normalizeText(item.authorization.fieldKey);
  const noteType = normalizeText(item.noteType ?? "");
  const clinicalTags = normalizeTagList(item.clinicalTags);
  const sensitivityTags = normalizeTagList(item.sensitivityTags);
  const content = normalizeText(item.content);

  return [
    `field:${fieldKey}`,
    noteType ? `note:${noteType}` : "",
    clinicalTags.length ? `clinical:${clinicalTags.join(" ")}` : "",
    sensitivityTags.length ? `sensitivity:${sensitivityTags.join(" ")}` : "",
    `content:${content}`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function embedCanonicalEvidence(
  item: CanonicalEvidenceItem,
): EmbeddedCanonicalEvidence {
  try {
    const embeddingModel =
      process.env.MEDAGENT_LOCAL_EMBED_MODEL?.trim() || DEFAULT_EMBED_MODEL;
    const embeddingDimensions = parseEmbeddingDimensions();
    const normalizedText = normalizeText(buildEmbeddingText(item));

    const contentHash = crypto
      .createHash("sha256")
      .update(normalizedText)
      .digest("hex");

    const embedding = buildEmbeddingVector(normalizedText, embeddingDimensions);

    return {
      evidenceId: item.id,
      patientHash: item.patientHash,
      fieldKey: item.authorization.fieldKey,
      noteType: item.noteType,
      contentHash,
      embeddingModel,
      embeddingDimensions,
      normalizedText,
      embedding,
      updatedAt: item.provenance.timestamp,
    };
  } catch (error) {
    if (error instanceof LocalEmbeddingError) {
      throw error;
    }
    throw new LocalEmbeddingError(
      error instanceof Error ? error.message : "embedding_failure",
    );
  }
}

export function embedQueryText(queryText: string) {
  try {
    const embeddingModel =
      process.env.MEDAGENT_LOCAL_EMBED_MODEL?.trim() || DEFAULT_EMBED_MODEL;
    const embeddingDimensions = parseEmbeddingDimensions();
    const normalizedText = normalizeText(queryText);
    const embedding = buildEmbeddingVector(normalizedText, embeddingDimensions);

    return {
      embeddingModel,
      embeddingDimensions,
      normalizedText,
      embedding,
    };
  } catch (error) {
    if (error instanceof LocalEmbeddingError) {
      throw error;
    }
    throw new LocalEmbeddingError(
      error instanceof Error ? error.message : "embedding_failure",
    );
  }
}
