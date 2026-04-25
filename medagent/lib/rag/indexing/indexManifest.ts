import fs from "fs";
import path from "path";

import { getIndexStaleAfterMs } from "@/lib/rag/indexing/refreshPolicy";

export type IndexStatus = "ready" | "stale" | "building" | "failed";

export type IndexManifestEntry = {
  patientHash: string;
  sourceFingerprint: string;
  sourceVersion?: string;
  lastIndexedAt: string;
  lastSeenAt: string;
  chunkCount: number;
  indexStatus: IndexStatus;
  lastError?: string | null;
};

type IndexManifestStore = {
  entries: Record<string, IndexManifestEntry>;
};

const DEFAULT_MANIFEST_PATH = path.join(
  process.cwd(),
  "data",
  "index-manifest.json",
);

function ensureParentDir(manifestPath: string) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
}

function makeEmptyStore(): IndexManifestStore {
  return { entries: {} };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeEntry(
  patientHash: string,
  value: unknown,
): IndexManifestEntry | null {
  if (!isObject(value)) return null;

  const sourceFingerprint =
    typeof value.sourceFingerprint === "string" ? value.sourceFingerprint : "";
  const lastIndexedAt =
    typeof value.lastIndexedAt === "string" ? value.lastIndexedAt : "";
  const lastSeenAt =
    typeof value.lastSeenAt === "string" ? value.lastSeenAt : "";
  const chunkCount =
    typeof value.chunkCount === "number" && Number.isFinite(value.chunkCount)
      ? Math.max(0, Math.floor(value.chunkCount))
      : 0;
  const indexStatus =
    value.indexStatus === "ready" ||
    value.indexStatus === "stale" ||
    value.indexStatus === "building" ||
    value.indexStatus === "failed"
      ? value.indexStatus
      : "stale";

  if (!sourceFingerprint || !lastIndexedAt || !lastSeenAt) {
    return null;
  }

  return {
    patientHash,
    sourceFingerprint,
    sourceVersion:
      typeof value.sourceVersion === "string" ? value.sourceVersion : undefined,
    lastIndexedAt,
    lastSeenAt,
    chunkCount,
    indexStatus,
    lastError:
      value.lastError === null
        ? null
        : typeof value.lastError === "string"
          ? value.lastError
          : undefined,
  };
}

function safeReadStore(
  manifestPath = DEFAULT_MANIFEST_PATH,
): IndexManifestStore {
  try {
    if (!fs.existsSync(manifestPath)) {
      return makeEmptyStore();
    }

    const raw = fs.readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed) || !isObject(parsed.entries)) {
      return makeEmptyStore();
    }

    const entries: Record<string, IndexManifestEntry> = {};
    for (const [patientHash, candidate] of Object.entries(parsed.entries)) {
      const sanitized = sanitizeEntry(patientHash, candidate);
      if (sanitized) {
        entries[patientHash] = sanitized;
      }
    }

    return { entries };
  } catch {
    return makeEmptyStore();
  }
}

function writeStore(
  store: IndexManifestStore,
  manifestPath = DEFAULT_MANIFEST_PATH,
) {
  ensureParentDir(manifestPath);
  const tempPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2));
  fs.renameSync(tempPath, manifestPath);
}

function withManifestLock<T>(
  manifestPath: string,
  action: () => T,
): T {
  ensureParentDir(manifestPath);
  const lockPath = `${manifestPath}.lock`;
  const timeoutMs = 5_000;
  const sleepMs = 25;
  const start = Date.now();

  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.closeSync(fd);
      break;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code !== "EEXIST") {
        throw error;
      }
      if (Date.now() - start >= timeoutMs) {
        throw new Error(`Timed out acquiring manifest lock: ${lockPath}`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, sleepMs);
    }
  }

  try {
    return action();
  } finally {
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      // best-effort lock cleanup
    }
  }
}

export function readIndexManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  return safeReadStore(manifestPath);
}

export function readIndexManifestEntry(
  patientHash: string,
  manifestPath = DEFAULT_MANIFEST_PATH,
): IndexManifestEntry | null {
  const store = safeReadStore(manifestPath);
  return store.entries[patientHash] ?? null;
}

export function upsertIndexManifestEntry(
  patientHash: string,
  partial: Partial<IndexManifestEntry>,
  manifestPath = DEFAULT_MANIFEST_PATH,
) {
  return withManifestLock(manifestPath, () => {
    const store = safeReadStore(manifestPath);
    const nowIso = new Date().toISOString();
    const existing = store.entries[patientHash];

    const hasLastErrorPatch = Object.prototype.hasOwnProperty.call(
      partial,
      "lastError",
    );

    const entry: IndexManifestEntry = {
      patientHash,
      sourceFingerprint:
        partial.sourceFingerprint ?? existing?.sourceFingerprint ?? "unknown",
      sourceVersion: partial.sourceVersion ?? existing?.sourceVersion,
      lastIndexedAt:
        partial.lastIndexedAt ?? existing?.lastIndexedAt ?? nowIso,
      lastSeenAt: partial.lastSeenAt ?? existing?.lastSeenAt ?? nowIso,
      chunkCount: partial.chunkCount ?? existing?.chunkCount ?? 0,
      indexStatus: partial.indexStatus ?? existing?.indexStatus ?? "stale",
      lastError: hasLastErrorPatch
        ? (partial.lastError ?? null)
        : existing?.lastError,
    };

    store.entries[patientHash] = entry;
    writeStore(store, manifestPath);
    return entry;
  });
}

export function touchIndexManifestSeenAt(
  patientHash: string,
  manifestPath = DEFAULT_MANIFEST_PATH,
) {
  return upsertIndexManifestEntry(
    patientHash,
    {
      lastSeenAt: new Date().toISOString(),
    },
    manifestPath,
  );
}

export function markIndexReady(input: {
  patientHash: string;
  sourceFingerprint: string;
  chunkCount: number;
  manifestPath?: string;
}) {
  const nowIso = new Date().toISOString();
  return upsertIndexManifestEntry(
    input.patientHash,
    {
      sourceFingerprint: input.sourceFingerprint,
      sourceVersion: input.sourceFingerprint,
      lastIndexedAt: nowIso,
      lastSeenAt: nowIso,
      chunkCount: Math.max(0, Math.floor(input.chunkCount)),
      indexStatus: "ready",
      lastError: null,
    },
    input.manifestPath,
  );
}

export function markIndexBuilding(input: {
  patientHash: string;
  sourceFingerprint: string;
  manifestPath?: string;
}) {
  const existing = readIndexManifestEntry(
    input.patientHash,
    input.manifestPath,
  );
  return upsertIndexManifestEntry(
    input.patientHash,
    {
      sourceFingerprint: input.sourceFingerprint,
      sourceVersion: input.sourceFingerprint,
      lastSeenAt: new Date().toISOString(),
      chunkCount: existing?.chunkCount ?? 0,
      indexStatus: "building",
      lastError: undefined,
    },
    input.manifestPath,
  );
}

export function markIndexFailed(input: {
  patientHash: string;
  sourceFingerprint: string;
  error: string;
  manifestPath?: string;
}) {
  const existing = readIndexManifestEntry(
    input.patientHash,
    input.manifestPath,
  );
  return upsertIndexManifestEntry(
    input.patientHash,
    {
      sourceFingerprint: input.sourceFingerprint,
      sourceVersion: input.sourceFingerprint,
      lastSeenAt: new Date().toISOString(),
      chunkCount: existing?.chunkCount ?? 0,
      indexStatus: "failed",
      lastError: input.error,
    },
    input.manifestPath,
  );
}

export function markIndexStale(input: {
  patientHash: string;
  sourceFingerprint: string;
  reason?: string;
  manifestPath?: string;
}) {
  const existing = readIndexManifestEntry(
    input.patientHash,
    input.manifestPath,
  );
  return upsertIndexManifestEntry(
    input.patientHash,
    {
      sourceFingerprint: input.sourceFingerprint,
      sourceVersion: input.sourceFingerprint,
      lastSeenAt: new Date().toISOString(),
      chunkCount: existing?.chunkCount ?? 0,
      indexStatus: "stale",
      lastError: input.reason,
    },
    input.manifestPath,
  );
}

export function computeIndexFreshness(input: {
  entry: IndexManifestEntry | null;
  sourceFingerprint: string;
  nowMs?: number;
}) {
  const now = input.nowMs ?? Date.now();
  const staleAfterMs = getIndexStaleAfterMs();

  if (!input.entry) {
    return {
      indexStatus: "missing" as const,
      indexFreshness: "missing" as const,
    };
  }

  const indexedAt = Date.parse(input.entry.lastIndexedAt);
  const ageMs = Number.isFinite(indexedAt)
    ? Math.max(0, now - indexedAt)
    : Infinity;
  const fingerprintMatches =
    input.entry.sourceFingerprint === input.sourceFingerprint;

  if (
    input.entry.indexStatus === "ready" &&
    fingerprintMatches &&
    ageMs <= staleAfterMs
  ) {
    return {
      indexStatus: input.entry.indexStatus,
      indexFreshness: "fresh" as const,
    };
  }

  return {
    indexStatus: input.entry.indexStatus,
    indexFreshness: "stale" as const,
  };
}
