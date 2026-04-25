import { runInBackgroundQueue } from "@/lib/rag/indexing/indexingQueue";
import {
  IndexManifestEntry,
  markIndexBuilding,
  markIndexFailed,
  markIndexReady,
  markIndexStale,
  readIndexManifestEntry,
} from "@/lib/rag/indexing/indexManifest";
import { isBackgroundIndexingEnabled } from "@/lib/rag/indexing/refreshPolicy";
import { computeSourceFingerprint } from "@/lib/rag/indexing/sourceFingerprint";
import { fetchSummary } from "@/lib/agent/tools/fetchSummary";
import { buildLexicalIndex } from "@/lib/agent/retrieval/buildLexicalIndex";
import { buildSemanticIndex } from "@/lib/agent/tools/retrievers/localSemanticIndex";
import { getPatientRowByHash } from "@/lib/db";

type RefreshReason =
  | "first_use"
  | "index_stale"
  | "source_fingerprint_changed"
  | "cache_stale"
  | "cache_expired"
  | "manual";

export type IndexRefreshResult = {
  patientHash: string;
  sourceFingerprint: string;
  chunkCount: number;
  status: "ready" | "skipped" | "failed";
  reason?: RefreshReason;
  error?: string;
  entry: IndexManifestEntry | null;
  latencyMs: number;
};

type RunIndexRefreshNowInput = {
  sourceFingerprint?: string;
  reason?: RefreshReason;
  force?: boolean;
};

const inFlightByPatient = new Map<string, Promise<IndexRefreshResult>>();

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "index_refresh_failed";
}

function hasReadyIndex(entry: IndexManifestEntry | null) {
  return !!entry && entry.indexStatus === "ready" && entry.chunkCount > 0;
}

async function executeRefresh(
  patientHash: string,
  input?: RunIndexRefreshNowInput,
): Promise<IndexRefreshResult> {
  const started = Date.now();

  const existing = readIndexManifestEntry(patientHash);
  if (!input?.force && hasReadyIndex(existing) && input?.sourceFingerprint) {
    if (existing?.sourceFingerprint === input.sourceFingerprint) {
      return {
        patientHash,
        sourceFingerprint: existing.sourceFingerprint,
        chunkCount: existing.chunkCount,
        status: "skipped",
        reason: input.reason,
        entry: existing,
        latencyMs: Date.now() - started,
      };
    }

    if (existing) {
      markIndexStale({
        patientHash,
        sourceFingerprint: existing.sourceFingerprint,
        reason: "source_fingerprint_changed",
      });
    }
  }

  const patient = getPatientRowByHash(patientHash);
  if (!patient) {
    const message = "patient_not_found";
    markIndexFailed({
      patientHash,
      sourceFingerprint: input?.sourceFingerprint ?? existing?.sourceFingerprint ?? "unknown",
      error: message,
    });

    return {
      patientHash,
      sourceFingerprint:
        input?.sourceFingerprint ?? existing?.sourceFingerprint ?? "unknown",
      chunkCount: existing?.chunkCount ?? 0,
      status: "failed",
      reason: input?.reason,
      error: message,
      entry: readIndexManifestEntry(patientHash),
      latencyMs: Date.now() - started,
    };
  }

  const source = await fetchSummary({ patientId: patient.id });
  const fingerprint = computeSourceFingerprint(source.rawCandidates);
  markIndexBuilding({ patientHash, sourceFingerprint: fingerprint });

  try {
    buildLexicalIndex(source.rawCandidates, {
      patientHash,
      mode: "rebuild",
    });
    buildSemanticIndex(source.rawCandidates, {
      patientHash,
    });

    const readyEntry = markIndexReady({
      patientHash,
      sourceFingerprint: fingerprint,
      chunkCount: source.rawCandidates.length,
    });

    return {
      patientHash,
      sourceFingerprint: fingerprint,
      chunkCount: source.rawCandidates.length,
      status: "ready",
      reason: input?.reason,
      entry: readyEntry,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const message = toErrorMessage(error);
    const failedEntry = markIndexFailed({
      patientHash,
      sourceFingerprint: fingerprint,
      error: message,
    });

    return {
      patientHash,
      sourceFingerprint: fingerprint,
      chunkCount: source.rawCandidates.length,
      status: "failed",
      reason: input?.reason,
      error: message,
      entry: failedEntry,
      latencyMs: Date.now() - started,
    };
  }
}

export function runIndexRefreshNow(
  patientHash: string,
  input?: RunIndexRefreshNowInput,
): Promise<IndexRefreshResult> {
  const existing = inFlightByPatient.get(patientHash);
  if (existing) {
    return existing;
  }

  const promise = executeRefresh(patientHash, input).finally(() => {
    inFlightByPatient.delete(patientHash);
  });

  inFlightByPatient.set(patientHash, promise);
  return promise;
}

export function enqueueIndexRefresh(
  patientHash: string,
  sourceFingerprint?: string,
  reason: RefreshReason = "index_stale",
) {
  if (!isBackgroundIndexingEnabled()) {
    return false;
  }

  return runInBackgroundQueue(`index:${patientHash}`, async () => {
    await runIndexRefreshNow(patientHash, {
      sourceFingerprint,
      reason,
    });
  });
}

export function getInFlightIndexRefreshCount() {
  return inFlightByPatient.size;
}

export function clearIndexRefreshInFlightForTests() {
  inFlightByPatient.clear();
}
