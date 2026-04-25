import fs from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runRetrievalPlanner } from "@/lib/agent/agents/retrievalPlanner";
import { AgentStateType } from "@/lib/agent/state";
import {
  resetDatabase,
  getPatientRow,
  getPatientSummary,
  upsertPatient,
} from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";
import { encryptJson } from "@/lib/crypto";
import {
  __unsafeSetRetrievalCacheEntryForTests,
  clearRetrievalCacheForTests,
  getRetrievalCacheStatsForTests,
} from "@/lib/rag/cache/retrievalCache";

const MANIFEST_PATH = path.join(process.cwd(), "data", "index-manifest.json");
const ENV_KEYS = [
  "MEDAGENT_ENABLE_BACKGROUND_INDEXING",
  "MEDAGENT_ENABLE_STALE_WHILE_REVALIDATE",
  "MEDAGENT_CACHE_MAX_ENTRIES",
  "MEDAGENT_INDEX_STALE_AFTER_MS",
  "MEDAGENT_CACHE_FRESH_TTL_MS",
  "MEDAGENT_CACHE_STALE_TTL_MS",
  "MEDAGENT_ENABLE_PLAN_OPTIMIZER",
  "MEDAGENT_PLAN_OPTIMIZER_PROFILE",
] as const;
let originalEnv: Partial<
  Record<(typeof ENV_KEYS)[number], string | undefined>
> = {};

function baseState(patientId = "sarah-bennett"): AgentStateType {
  return {
    requestContext: {
      requestId: `req-${patientId}`,
      patientId,
      requesterId: "did:solana:demo:doctor-1",
      naturalLanguageRequest: "Need allergy and medication safety context",
      targetLocale: "en",
      emergencyMode: true,
      patientApprovalPresent: false,
    },
    policyContext: {
      verified: true,
      decision: "granted",
      tier: 1,
      fieldsAllowed: ["allergies", "medications", "conditions"],
    },
    understandingContext: {
      focusAreas: ["allergies", "medications"],
      withheldAreas: [],
      ambiguityFlags: [],
      suggestedStrategy: "fallback",
    },
    retrievalContext: {
      queryPlans: [],
      executionLog: [],
      rawCandidates: [],
      totalBaselineCandidates: 0,
      totalRagCandidates: 0,
      totalSemanticCandidates: 0,
      totalUniqueCandidates: 0,
      ragUsed: false,
      semanticUsed: false,
      cacheHitCount: 0,
      staleCacheServedCount: 0,
      cacheMissCount: 0,
      backgroundRefreshQueued: false,
      indexStatus: "missing",
      indexFreshness: "missing",
      cacheLookupLatencyMs: 0,
      cacheWriteLatencyMs: 0,
      retryCount: 0,
    },
    evidenceContext: {
      authorizedChunks: [],
    },
    responseContext: {
      answerStatus: "pending",
    },
    completedAgents: [],
    trace: {
      requestId: `req-${patientId}`,
      patientId,
      requesterId: "did:solana:demo:doctor-1",
      steps: [],
    },
  } as unknown as AgentStateType;
}

describe("retrieval planner cache integration", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    originalEnv = Object.fromEntries(
      ENV_KEYS.map((key) => [key, process.env[key]]),
    ) as Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

    if (fs.existsSync(MANIFEST_PATH)) {
      fs.rmSync(MANIFEST_PATH, { force: true });
    }
    clearRetrievalCacheForTests();
    resetDatabase();
    await seedDemo();
    process.env.MEDAGENT_ENABLE_BACKGROUND_INDEXING = "true";
    process.env.MEDAGENT_ENABLE_STALE_WHILE_REVALIDATE = "true";
    process.env.MEDAGENT_CACHE_MAX_ENTRIES = "100";
    process.env.MEDAGENT_INDEX_STALE_AFTER_MS = "1";
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("uses fresh cache hit without recomputation", async () => {
    process.env.MEDAGENT_CACHE_FRESH_TTL_MS = "60000";
    process.env.MEDAGENT_CACHE_STALE_TTL_MS = "60000";

    const first = await runRetrievalPlanner(baseState());
    expect(first.retrievalContext?.cacheMissCount).toBeGreaterThan(0);

    const second = await runRetrievalPlanner(baseState());
    expect(second.retrievalContext?.cacheHitCount).toBeGreaterThan(0);
    expect(second.retrievalContext?.cacheMissCount).toBe(0);
    expect(second.retrievalContext?.plannerLatencyMs).toBeGreaterThanOrEqual(0);
    expect(second.retrievalContext?.lexicalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(second.retrievalContext?.rerankLatencyMs).toBeGreaterThanOrEqual(0);
    expect(second.retrievalContext?.latencyClassification).toMatch(
      /healthy|degraded|budget_exceeded/,
    );
  });

  it("serves stale cache and queues background recompute", async () => {
    vi.useFakeTimers();
    process.env.MEDAGENT_CACHE_FRESH_TTL_MS = "1";
    process.env.MEDAGENT_CACHE_STALE_TTL_MS = "60000";

    await runRetrievalPlanner(baseState());
    vi.advanceTimersByTime(10);

    const second = await runRetrievalPlanner(baseState());
    expect(second.retrievalContext?.staleCacheServedCount).toBeGreaterThan(0);
    expect(second.retrievalContext?.backgroundRefreshQueued).toBe(true);
  });

  it("recomputes synchronously when cache expired", async () => {
    process.env.MEDAGENT_CACHE_FRESH_TTL_MS = "1";
    process.env.MEDAGENT_CACHE_STALE_TTL_MS = "1";

    await runRetrievalPlanner(baseState());
    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = await runRetrievalPlanner(baseState());
    expect(second.retrievalContext?.cacheMissCount).toBeGreaterThan(0);
  });

  it("invalidates cache when source fingerprint changes", async () => {
    process.env.MEDAGENT_CACHE_FRESH_TTL_MS = "60000";
    process.env.MEDAGENT_CACHE_STALE_TTL_MS = "60000";

    const before = await runRetrievalPlanner(baseState());
    const row = getPatientRow("sarah-bennett");
    const summary = getPatientSummary("sarah-bennett");

    expect(row).toBeDefined();
    expect(summary).toBeTruthy();

    upsertPatient({
      patientId: row!.id,
      localIdentity: row!.local_identity,
      encryptedSummary: encryptJson({
        ...summary!,
        alerts: [...(summary!.alerts ?? []), "new-clinical-alert"],
      }),
      patientHash: row!.patient_hash,
      chainIdentity: row!.chain_identity,
      registryAccountId: row!.registry_account_id,
      auditRef: row!.audit_ref,
    });

    const after = await runRetrievalPlanner(baseState());
    expect(after.retrievalContext?.sourceFingerprint).not.toBe(
      before.retrievalContext?.sourceFingerprint,
    );
    expect(after.retrievalContext?.cacheMissCount).toBeGreaterThan(0);
  });

  it("never leaks cache across patients", async () => {
    process.env.MEDAGENT_CACHE_FRESH_TTL_MS = "60000";
    process.env.MEDAGENT_CACHE_STALE_TTL_MS = "60000";

    await runRetrievalPlanner(baseState("sarah-bennett"));
    const second = await runRetrievalPlanner(baseState("omar-haddad"));

    expect(second.retrievalContext?.cacheHitCount).toBe(0);
    expect(second.retrievalContext?.cacheMissCount).toBeGreaterThan(0);
  });

  it("falls back safely from malformed cache entries", async () => {
    process.env.MEDAGENT_CACHE_FRESH_TTL_MS = "60000";
    process.env.MEDAGENT_CACHE_STALE_TTL_MS = "60000";

    await runRetrievalPlanner(baseState());
    const keys = getRetrievalCacheStatsForTests().keys;
    expect(keys.length).toBeGreaterThan(0);

    __unsafeSetRetrievalCacheEntryForTests(keys[0], {
      key: keys[0],
      patientHash: "",
      sourceFingerprint: "",
      candidates: [] as any,
      createdAt: Number.NaN,
      staleAt: 0,
      expiresAt: 0,
      cacheStatus: "fresh",
    } as any);

    const result = await runRetrievalPlanner(baseState());
    expect(result.retrievalContext?.cacheMissCount).toBeGreaterThan(0);
  });

  it("falls back safely from malformed manifest", async () => {
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, "{bad json");

    const result = await runRetrievalPlanner(baseState());
    expect(result.retrievalContext?.totalUniqueCandidates).toBeGreaterThan(0);
    expect(result.retrievalContext?.indexStatus).not.toBe("missing");
  });

  it("keeps retrieval ordering deterministic", async () => {
    process.env.MEDAGENT_CACHE_FRESH_TTL_MS = "60000";
    process.env.MEDAGENT_CACHE_STALE_TTL_MS = "60000";

    const first = await runRetrievalPlanner(baseState());
    const second = await runRetrievalPlanner(baseState());

    const firstPlanOrder = (first.retrievalContext?.executionLog ?? []).map(
      (entry) => entry.queryPlanIndex,
    );
    const secondPlanOrder = (second.retrievalContext?.executionLog ?? []).map(
      (entry) => entry.queryPlanIndex,
    );

    expect(firstPlanOrder).toEqual(secondPlanOrder);
    expect(firstPlanOrder).toEqual([...firstPlanOrder].sort((a, b) => a - b));
  });

  it("preserves policy-driven retrieval boundaries", async () => {
    const state = baseState();
    state.policyContext.fieldsAllowed = ["unknownField"];
    state.understandingContext.focusAreas = ["unknownField"];
    state.retrievalContext.retryCount = 2;

    const result = await runRetrievalPlanner(state);

    expect(result.retrievalContext?.totalRagCandidates).toBe(0);
    expect(result.retrievalContext?.totalBaselineCandidates).toBeGreaterThan(0);
  });

  it("uses balanced defaults with topK 5 when optimizer is not enabled", async () => {
    delete process.env.MEDAGENT_ENABLE_PLAN_OPTIMIZER;
    delete process.env.MEDAGENT_PLAN_OPTIMIZER_PROFILE;

    const result = await runRetrievalPlanner(baseState());
    const retrieval = result.retrievalContext;

    expect(retrieval?.optimizerApplied).toBe(false);
    expect(retrieval?.optimizerProfile).toBe("balanced");
    expect(retrieval?.recommendedModeOrder).toEqual([
      "balanced",
      "broad",
      "exact",
    ]);
    expect(retrieval?.recommendedTopK).toBe(5);
    expect((retrieval?.queryPlans ?? []).every((plan) => plan.topK === 5)).toBe(
      true,
    );
  });

  it("keeps env optimizer profile overrides authoritative when enabled", async () => {
    process.env.MEDAGENT_ENABLE_PLAN_OPTIMIZER = "true";
    process.env.MEDAGENT_PLAN_OPTIMIZER_PROFILE = "precision_first";

    const result = await runRetrievalPlanner(baseState());
    const retrieval = result.retrievalContext;

    expect(retrieval?.optimizerApplied).toBe(true);
    expect(retrieval?.optimizerProfile).toBe("precision_first");
    expect(retrieval?.recommendedModeOrder).toEqual(["balanced", "exact"]);
  });
});
