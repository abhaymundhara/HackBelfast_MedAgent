import { CanonicalEvidenceItem } from "@/lib/agent/state";
import { embedCanonicalEvidence } from "@/lib/agent/tools/retrievers/embedCanonicalEvidence";
import {
  SemanticIndexEntry,
  SemanticIndexStats,
  SemanticSearchResult,
} from "@/lib/agent/tools/retrievers/semanticIndexTypes";

type SemanticIndexBuildOptions = {
  patientHash?: string;
};

type SemanticSearchOptions = {
  patientHash: string;
  topK: number;
  targetFields?: string[];
  targetNoteTypes?: string[];
};

type SemanticRecord = {
  entry: SemanticIndexEntry;
  embedding: number[];
  item: CanonicalEvidenceItem;
  normalizedText: string;
};

type SemanticIndexStore = {
  loaded: boolean;
  embeddingModel: string;
  lastBuiltAt?: string;
  recordsByEvidenceId: Map<string, SemanticRecord>;
  patientToEvidenceIds: Map<string, Set<string>>;
};

const store: SemanticIndexStore = {
  loaded: false,
  embeddingModel:
    process.env.MEDAGENT_LOCAL_EMBED_MODEL || "local-hash-embed-v1",
  recordsByEvidenceId: new Map(),
  patientToEvidenceIds: new Map(),
};

function normalizeSet(values: string[] | undefined) {
  return new Set((values ?? []).filter(Boolean));
}

function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    dot += l * r;
    leftNorm += l * l;
    rightNorm += r * r;
  }

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function ensurePatientSet(patientHash: string) {
  const existing = store.patientToEvidenceIds.get(patientHash);
  if (existing) return existing;

  const created = new Set<string>();
  store.patientToEvidenceIds.set(patientHash, created);
  return created;
}

function deleteEvidenceId(evidenceId: string) {
  const existing = store.recordsByEvidenceId.get(evidenceId);
  if (!existing) return;

  const patientSet = store.patientToEvidenceIds.get(existing.entry.patientHash);
  patientSet?.delete(evidenceId);
  store.recordsByEvidenceId.delete(evidenceId);
}

export function loadSemanticIndex() {
  store.loaded = true;
  return getSemanticIndexStats();
}

export function buildSemanticIndex(
  items: CanonicalEvidenceItem[],
  options?: SemanticIndexBuildOptions,
) {
  loadSemanticIndex();

  const patientHash = options?.patientHash;
  if (patientHash) {
    const patientSet = store.patientToEvidenceIds.get(patientHash);
    if (patientSet?.size) {
      for (const evidenceId of patientSet) {
        store.recordsByEvidenceId.delete(evidenceId);
      }
    }
    store.patientToEvidenceIds.set(patientHash, new Set());
  } else {
    store.recordsByEvidenceId.clear();
    store.patientToEvidenceIds.clear();
  }

  return upsertSemanticIndex(items, options);
}

export function upsertSemanticIndex(
  items: CanonicalEvidenceItem[],
  options?: SemanticIndexBuildOptions,
) {
  loadSemanticIndex();

  const scopedItems = options?.patientHash
    ? items.filter((item) => item.patientHash === options.patientHash)
    : items;

  let updatedCount = 0;

  for (const item of scopedItems) {
    const embedded = embedCanonicalEvidence(item);
    const existing = store.recordsByEvidenceId.get(item.id);

    if (existing && existing.entry.contentHash === embedded.contentHash) {
      continue;
    }

    if (existing) {
      deleteEvidenceId(item.id);
    }

    const entry: SemanticIndexEntry = {
      evidenceId: item.id,
      patientHash: item.patientHash,
      fieldKey: item.authorization.fieldKey,
      noteType: item.noteType,
      contentHash: embedded.contentHash,
      embeddingModel: embedded.embeddingModel,
      embeddingDimensions: embedded.embeddingDimensions,
      updatedAt: embedded.updatedAt,
    };

    store.recordsByEvidenceId.set(item.id, {
      entry,
      embedding: embedded.embedding,
      item,
      normalizedText: embedded.normalizedText,
    });

    ensurePatientSet(item.patientHash).add(item.id);
    store.embeddingModel = embedded.embeddingModel;
    updatedCount += 1;
  }

  store.lastBuiltAt = new Date().toISOString();

  return {
    updatedCount,
    stats: getSemanticIndexStats(options?.patientHash),
  };
}

export function searchSemanticIndex(
  queryEmbedding: number[],
  options: SemanticSearchOptions,
): SemanticSearchResult[] {
  const patientSet = store.patientToEvidenceIds.get(options.patientHash);
  if (!patientSet?.size) {
    return [];
  }

  const fieldSet = normalizeSet(options.targetFields);
  const noteTypeSet = normalizeSet(options.targetNoteTypes);

  const scored: Array<SemanticSearchResult & { timestamp: string }> = [];

  for (const evidenceId of patientSet) {
    const record = store.recordsByEvidenceId.get(evidenceId);
    if (!record) continue;

    if (fieldSet.size && !fieldSet.has(record.entry.fieldKey)) {
      continue;
    }

    if (
      noteTypeSet.size &&
      (!record.entry.noteType || !noteTypeSet.has(record.entry.noteType))
    ) {
      continue;
    }

    const semanticScore = cosineSimilarity(queryEmbedding, record.embedding);
    scored.push({
      evidenceId,
      semanticScore,
      rank: 0,
      timestamp: record.item.provenance.timestamp,
    });
  }

  scored.sort((left, right) => {
    if (right.semanticScore !== left.semanticScore) {
      return right.semanticScore - left.semanticScore;
    }

    const leftTime = Date.parse(left.timestamp);
    const rightTime = Date.parse(right.timestamp);
    if (
      !Number.isNaN(leftTime) &&
      !Number.isNaN(rightTime) &&
      leftTime !== rightTime
    ) {
      return rightTime - leftTime;
    }

    return left.evidenceId.localeCompare(right.evidenceId);
  });

  return scored.slice(0, Math.max(0, options.topK)).map((result, index) => ({
    evidenceId: result.evidenceId,
    semanticScore: result.semanticScore,
    rank: index + 1,
  }));
}

export function getSemanticEvidenceById(evidenceId: string) {
  return store.recordsByEvidenceId.get(evidenceId)?.item;
}

export function getSemanticIndexStats(
  patientHash?: string,
): SemanticIndexStats {
  const patientScopedCount = patientHash
    ? (store.patientToEvidenceIds.get(patientHash)?.size ?? 0)
    : undefined;

  return {
    indexLoaded: store.loaded,
    entryCount: store.recordsByEvidenceId.size,
    patientScopedCount,
    embeddingModel: store.embeddingModel,
    lastBuiltAt: store.lastBuiltAt,
  };
}
