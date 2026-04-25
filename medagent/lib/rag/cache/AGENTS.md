<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# cache

## Purpose
Patient-scoped retrieval cache with stale-while-revalidate semantics. Caches retrieval results keyed by patient, query plan, and source fingerprint.

## Key Files

| File | Description |
|------|-------------|
| `retrievalCache.ts` | Cache implementation — freshness states: `fresh`, `stale_servable`, `expired` |
| `cacheKeys.ts` | Cache key generation — deterministic keys from patient ID, query plan, and source fingerprint |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Cache unit tests (`retrieval-cache.test.ts`) |

## For AI Agents

### Working In This Directory
- Cache never widens access — only caches results that were already policy-approved
- Three freshness states: `fresh` (serve), `stale_servable` (serve + background refresh), `expired` (recompute)
- Keys include source fingerprint so cache invalidates when underlying data changes

<!-- MANUAL: -->
