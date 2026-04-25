<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# indexing

## Purpose
Background indexing system — manages patient-scoped retrieval index lifecycle (build, refresh, staleness detection) with a manifest-driven approach.

## Key Files

| File | Description |
|------|-------------|
| `indexManifest.ts` | Index manifest — tracks per-patient index state (`ready`, `stale`, `building`, `failed`) |
| `indexingQueue.ts` | Background queue for index build/refresh jobs |
| `indexingWorker.ts` | Worker that processes index build jobs from the queue |
| `refreshPolicy.ts` | Determines when indexes need refresh based on source fingerprints |
| `sourceFingerprint.ts` | Generates deterministic fingerprints from source data for staleness detection |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Indexing unit tests (`indexing-worker.test.ts`) |

## For AI Agents

### Working In This Directory
- First request for an unindexed patient triggers synchronous build
- Subsequent refreshes happen in background (stale indexes remain servable)
- Manifest states: `ready` → `stale` → `building` → `ready`/`failed`
- Source fingerprints detect when underlying patient data has changed

<!-- MANUAL: -->
