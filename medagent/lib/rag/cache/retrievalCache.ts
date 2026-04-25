import { CanonicalEvidenceItem } from "@/lib/agent/state";
import {
  getCacheMaxEntries,
  getCacheTimingWindow,
  isStaleWhileRevalidateEnabled,
} from "@/lib/rag/indexing/refreshPolicy";

export type RetrievalCacheStatus = "fresh" | "stale_servable" | "expired";

export type RetrievalCacheEntry = {
  key: string;
  patientHash: string;
  sourceFingerprint: string;
  candidates: CanonicalEvidenceItem[];
  createdAt: number;
  staleAt: number;
  expiresAt: number;
  cacheStatus: RetrievalCacheStatus;
  metadata?: {
    lexicalReturnedCount?: number;
    lexicalContributedCount?: number;
    lexicalLatencyMs?: number;
    rerankApplied?: boolean;
    rerankInputCount?: number;
    rerankLatencyMs?: number;
    rerankModel?: string;
    semanticTopScore?: number;
    fusionTopScore?: number;
    semanticReturnedCount?: number;
    semanticContributedCount?: number;
    semanticLatencyMs?: number;
    fusionApplied?: boolean;
    fusionInputCount?: number;
    semanticIndexHit?: boolean;
    semanticFailureReason?: string;
  };
};

type CacheLookupResult = {
  entry: RetrievalCacheEntry | null;
  status: RetrievalCacheStatus;
};

const cache = new Map<string, RetrievalCacheEntry>();
const backgroundRecomputeInFlight = new Set<string>();

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneCandidates(items: CanonicalEvidenceItem[]) {
  return items.map((item) => deepClone(item));
}

function cloneMetadata(
  metadata: RetrievalCacheEntry["metadata"],
): RetrievalCacheEntry["metadata"] {
  return metadata ? deepClone(metadata) : undefined;
}

function validateEntryShape(entry: RetrievalCacheEntry) {
  if (!entry || !entry.patientHash || !entry.sourceFingerprint || !entry.key) {
    return false;
  }
  if (!Array.isArray(entry.candidates)) return false;
  if (!Number.isFinite(entry.createdAt)) return false;
  if (!Number.isFinite(entry.staleAt)) return false;
  if (!Number.isFinite(entry.expiresAt)) return false;
  return true;
}

function classifyStatus(
  entry: RetrievalCacheEntry,
  nowMs = Date.now(),
): RetrievalCacheStatus {
  if (nowMs <= entry.staleAt) return "fresh";
  if (nowMs <= entry.expiresAt && isStaleWhileRevalidateEnabled()) {
    return "stale_servable";
  }
  return "expired";
}

function enforceMaxEntries() {
  const maxEntries = getCacheMaxEntries();
  while (cache.size > maxEntries) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) break;
    cache.delete(firstKey);
  }
}

export function getRetrievalCacheEntry(
  key: string,
  constraints?: { patientHash?: string; sourceFingerprint?: string },
): CacheLookupResult {
  const existing = cache.get(key);
  if (!existing) {
    return { entry: null, status: "expired" };
  }

  if (!validateEntryShape(existing)) {
    cache.delete(key);
    return { entry: null, status: "expired" };
  }

  if (
    constraints?.patientHash &&
    existing.patientHash !== constraints.patientHash
  ) {
    cache.delete(key);
    return { entry: null, status: "expired" };
  }

  if (
    constraints?.sourceFingerprint &&
    existing.sourceFingerprint !== constraints.sourceFingerprint
  ) {
    cache.delete(key);
    return { entry: null, status: "expired" };
  }

  const status = classifyStatus(existing);

  if (status === "expired") {
    cache.delete(key);
    return { entry: null, status };
  }

  cache.delete(key);
  cache.set(key, existing);

  return {
    entry: {
      ...existing,
      candidates: cloneCandidates(existing.candidates),
      cacheStatus: status,
      metadata: cloneMetadata(existing.metadata),
    },
    status,
  };
}

export function setRetrievalCacheEntry(input: {
  key: string;
  patientHash: string;
  sourceFingerprint: string;
  candidates: CanonicalEvidenceItem[];
  nowMs?: number;
  metadata?: RetrievalCacheEntry["metadata"];
}) {
  const now = input.nowMs ?? Date.now();
  const timings = getCacheTimingWindow(now);

  const entry: RetrievalCacheEntry = {
    key: input.key,
    patientHash: input.patientHash,
    sourceFingerprint: input.sourceFingerprint,
    candidates: cloneCandidates(input.candidates),
    createdAt: now,
    staleAt: timings.staleAt,
    expiresAt: timings.expiresAt,
    cacheStatus: "fresh",
    metadata: cloneMetadata(input.metadata),
  };

  cache.delete(input.key);
  cache.set(input.key, entry);
  enforceMaxEntries();

  return {
    ...entry,
    candidates: cloneCandidates(entry.candidates),
    metadata: cloneMetadata(entry.metadata),
  };
}

export function enqueueRetrievalCacheRecompute(
  key: string,
  task: () => Promise<void>,
) {
  if (backgroundRecomputeInFlight.has(key)) {
    return false;
  }

  backgroundRecomputeInFlight.add(key);

  Promise.resolve()
    .then(async () => {
      await task();
    })
    .catch(() => {
      // cache refresh is best-effort
    })
    .finally(() => {
      backgroundRecomputeInFlight.delete(key);
    });

  return true;
}

export function __unsafeSetRetrievalCacheEntryForTests(
  key: string,
  entry: RetrievalCacheEntry,
) {
  cache.set(key, entry);
}

export function clearRetrievalCacheForTests() {
  cache.clear();
  backgroundRecomputeInFlight.clear();
}

export function getRetrievalCacheStatsForTests() {
  return {
    entryCount: cache.size,
    backgroundRecomputeInFlightCount: backgroundRecomputeInFlight.size,
    keys: [...cache.keys()],
  };
}
