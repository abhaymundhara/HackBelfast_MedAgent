import fs from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearBackgroundQueueForTests,
  isBackgroundTaskQueued,
} from "@/lib/rag/indexing/indexingQueue";
import {
  clearIndexRefreshInFlightForTests,
  enqueueIndexRefresh,
  runIndexRefreshNow,
} from "@/lib/rag/indexing/indexingWorker";
import { readIndexManifestEntry } from "@/lib/rag/indexing/indexManifest";
import { getPatientRow } from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";
import { resetDatabase } from "@/lib/db";
import { fetchSummary } from "@/lib/agent/tools/fetchSummary";
import { computeSourceFingerprint } from "@/lib/rag/indexing/sourceFingerprint";

const MANIFEST_PATH = path.join(process.cwd(), "data", "index-manifest.json");
let originalEnableBackgroundIndexing: string | undefined;

describe("indexing worker", () => {
  beforeEach(async () => {
    originalEnableBackgroundIndexing =
      process.env.MEDAGENT_ENABLE_BACKGROUND_INDEXING;
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.rmSync(MANIFEST_PATH, { force: true });
    }
    resetDatabase();
    await seedDemo();
    clearBackgroundQueueForTests();
    clearIndexRefreshInFlightForTests();
    process.env.MEDAGENT_ENABLE_BACKGROUND_INDEXING = "true";
  });

  afterEach(() => {
    if (originalEnableBackgroundIndexing === undefined) {
      delete process.env.MEDAGENT_ENABLE_BACKGROUND_INDEXING;
    } else {
      process.env.MEDAGENT_ENABLE_BACKGROUND_INDEXING =
        originalEnableBackgroundIndexing;
    }
  });

  it("updates manifest on first build and refresh", async () => {
    const row = getPatientRow("sarah-bennett");
    expect(row).toBeDefined();

    const source = await fetchSummary({ patientId: "sarah-bennett" });
    const fingerprint = computeSourceFingerprint(source.rawCandidates);

    const first = await runIndexRefreshNow(row!.patient_hash, {
      sourceFingerprint: fingerprint,
      reason: "first_use",
      force: true,
    });

    expect(first.status).toBe("ready");

    const manifest = readIndexManifestEntry(row!.patient_hash);
    expect(manifest).not.toBeNull();
    expect(manifest?.indexStatus).toBe("ready");
    expect(manifest?.chunkCount).toBeGreaterThan(0);
    expect(manifest?.sourceFingerprint).toBe(fingerprint);

    const refresh = await runIndexRefreshNow(row!.patient_hash, {
      sourceFingerprint: fingerprint,
      reason: "manual",
      force: true,
    });

    expect(refresh.status).toBe("ready");
    expect(refresh.chunkCount).toBeGreaterThan(0);
  });

  it("dedupes duplicate concurrent refresh requests", async () => {
    const row = getPatientRow("sarah-bennett");
    const source = await fetchSummary({ patientId: "sarah-bennett" });
    const fingerprint = computeSourceFingerprint(source.rawCandidates);

    const firstPromise = runIndexRefreshNow(row!.patient_hash, {
      sourceFingerprint: fingerprint,
      reason: "manual",
      force: true,
    });
    const secondPromise = runIndexRefreshNow(row!.patient_hash, {
      sourceFingerprint: fingerprint,
      reason: "manual",
      force: true,
    });

    expect(firstPromise).toBe(secondPromise);

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
  });

  it("queues background refresh once for stale index", async () => {
    const row = getPatientRow("sarah-bennett");
    const queuedFirst = enqueueIndexRefresh(row!.patient_hash, "fingerprint-a", "index_stale");
    const queuedSecond = enqueueIndexRefresh(row!.patient_hash, "fingerprint-a", "index_stale");

    expect(queuedFirst).toBe(true);
    expect(queuedSecond).toBe(false);
    expect(isBackgroundTaskQueued(`index:${row!.patient_hash}`)).toBe(true);
  });

  it("falls back safely from malformed manifest", async () => {
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, "{bad json");

    const row = getPatientRow("sarah-bennett");
    const result = await runIndexRefreshNow(row!.patient_hash, {
      reason: "manual",
      force: true,
    });

    expect(result.status).toBe("ready");
    const manifest = readIndexManifestEntry(row!.patient_hash);
    expect(manifest?.indexStatus).toBe("ready");
  });
});
