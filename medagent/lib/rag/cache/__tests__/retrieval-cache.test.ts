import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __unsafeSetRetrievalCacheEntryForTests,
  clearRetrievalCacheForTests,
  enqueueRetrievalCacheRecompute,
  getRetrievalCacheEntry,
  getRetrievalCacheStatsForTests,
  setRetrievalCacheEntry,
} from "@/lib/rag/cache/retrievalCache";

const KEY = "cache-key";
const ENV_KEYS = [
  "MEDAGENT_CACHE_FRESH_TTL_MS",
  "MEDAGENT_CACHE_STALE_TTL_MS",
  "MEDAGENT_ENABLE_STALE_WHILE_REVALIDATE",
  "MEDAGENT_CACHE_MAX_ENTRIES",
] as const;
let originalEnv: Partial<
  Record<(typeof ENV_KEYS)[number], string | undefined>
> = {};

describe("retrieval cache", () => {
  beforeEach(() => {
    originalEnv = Object.fromEntries(
      ENV_KEYS.map((key) => [key, process.env[key]]),
    ) as Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

    clearRetrievalCacheForTests();
    process.env.MEDAGENT_CACHE_FRESH_TTL_MS = "1000";
    process.env.MEDAGENT_CACHE_STALE_TTL_MS = "1000";
    process.env.MEDAGENT_ENABLE_STALE_WHILE_REVALIDATE = "true";
    process.env.MEDAGENT_CACHE_MAX_ENTRIES = "3";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    clearRetrievalCacheForTests();
  });

  it("serves fresh entries directly", () => {
    const now = Date.now();
    setRetrievalCacheEntry({
      key: KEY,
      patientHash: "p1",
      sourceFingerprint: "f1",
      candidates: [],
      nowMs: now,
    });

    const lookup = getRetrievalCacheEntry(KEY, {
      patientHash: "p1",
      sourceFingerprint: "f1",
    });

    expect(lookup.status).toBe("fresh");
    expect(lookup.entry).not.toBeNull();
  });

  it("serves stale_servable when enabled", () => {
    const now = Date.now();
    __unsafeSetRetrievalCacheEntryForTests(KEY, {
      key: KEY,
      patientHash: "p1",
      sourceFingerprint: "f1",
      candidates: [],
      createdAt: now - 2000,
      staleAt: now - 1000,
      expiresAt: now + 1000,
      cacheStatus: "fresh",
    });

    const lookup = getRetrievalCacheEntry(KEY, {
      patientHash: "p1",
      sourceFingerprint: "f1",
    });
    expect(lookup.status).toBe("stale_servable");
    expect(lookup.entry).not.toBeNull();
  });

  it("expires entries after stale ttl", () => {
    setRetrievalCacheEntry({
      key: KEY,
      patientHash: "p1",
      sourceFingerprint: "f1",
      candidates: [],
      nowMs: 100,
    });

    __unsafeSetRetrievalCacheEntryForTests(KEY, {
      key: KEY,
      patientHash: "p1",
      sourceFingerprint: "f1",
      candidates: [],
      createdAt: 0,
      staleAt: 1,
      expiresAt: 2,
      cacheStatus: "fresh",
    });

    const lookup = getRetrievalCacheEntry(KEY, {
      patientHash: "p1",
      sourceFingerprint: "f1",
    });

    expect(lookup.status).toBe("expired");
    expect(lookup.entry).toBeNull();
  });

  it("invalidates cache on source fingerprint mismatch", () => {
    setRetrievalCacheEntry({
      key: KEY,
      patientHash: "p1",
      sourceFingerprint: "old",
      candidates: [],
    });

    const lookup = getRetrievalCacheEntry(KEY, {
      patientHash: "p1",
      sourceFingerprint: "new",
    });

    expect(lookup.status).toBe("expired");
    expect(lookup.entry).toBeNull();
  });

  it("prevents cross-patient cache leakage", () => {
    setRetrievalCacheEntry({
      key: KEY,
      patientHash: "p1",
      sourceFingerprint: "f1",
      candidates: [],
    });

    const lookup = getRetrievalCacheEntry(KEY, {
      patientHash: "p2",
      sourceFingerprint: "f1",
    });

    expect(lookup.status).toBe("expired");
    expect(lookup.entry).toBeNull();
  });

  it("falls back safely on malformed entries", () => {
    __unsafeSetRetrievalCacheEntryForTests(KEY, {
      key: KEY,
      patientHash: "",
      sourceFingerprint: "",
      candidates: [] as any,
      createdAt: Number.NaN,
      staleAt: 0,
      expiresAt: 0,
      cacheStatus: "fresh",
    } as any);

    const lookup = getRetrievalCacheEntry(KEY, {
      patientHash: "p1",
      sourceFingerprint: "f1",
    });

    expect(lookup.status).toBe("expired");
    expect(lookup.entry).toBeNull();
  });

  it("dedupes background recompute queue for same key", async () => {
    let runs = 0;
    const firstQueued = enqueueRetrievalCacheRecompute(KEY, async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const secondQueued = enqueueRetrievalCacheRecompute(KEY, async () => {
      runs += 1;
    });

    expect(firstQueued).toBe(true);
    expect(secondQueued).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(runs).toBe(1);
  });

  it("evicts least-recently-used entries when capacity exceeded", () => {
    setRetrievalCacheEntry({
      key: "k1",
      patientHash: "p1",
      sourceFingerprint: "f1",
      candidates: [],
    });
    setRetrievalCacheEntry({
      key: "k2",
      patientHash: "p1",
      sourceFingerprint: "f1",
      candidates: [],
    });
    setRetrievalCacheEntry({
      key: "k3",
      patientHash: "p1",
      sourceFingerprint: "f1",
      candidates: [],
    });
    setRetrievalCacheEntry({
      key: "k4",
      patientHash: "p1",
      sourceFingerprint: "f1",
      candidates: [],
    });

    const stats = getRetrievalCacheStatsForTests();
    expect(stats.entryCount).toBe(3);
    expect(stats.keys.includes("k1")).toBe(false);
  });
});
