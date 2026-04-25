<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# rag

## Purpose
Retrieval-Augmented Generation pipeline — handles indexing patient records, caching retrieval results, evaluating retrieval quality, and providing observability into retrieval performance.

## Key Files

| File | Description |
|------|-------------|
| `ragClient.ts` | Main RAG client — orchestrates retrieval across indexes and cache |
| `ragIndex.ts` | Index management — build and query retrieval indexes |
| `ragTypes.ts` | Shared types for the RAG subsystem |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `cache/` | Retrieval caching — patient-scoped, fingerprint-aware, stale-while-revalidate (see `cache/AGENTS.md`) |
| `eval/` | Retrieval evaluation — metrics, dataset, runner, plan optimizer (see `eval/AGENTS.md`) |
| `indexing/` | Background indexing — manifest, queue, worker, refresh policy (see `indexing/AGENTS.md`) |
| `observability/` | Retrieval observability — budgets, regression detection, cost tracking (see `observability/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- RAG never widens access beyond deterministic policy — it retrieves only authorized fields
- Cache and index paths are local-only and patient-scoped
- Feature flags control optional subsystems (`MEDAGENT_ENABLE_RETRIEVAL_OBSERVABILITY`, etc.)
- Each subdirectory has its own `__tests__/` with colocated unit tests

### Testing Requirements
- `npm run test` runs all RAG tests
- `npm run eval:retrieval` runs the full evaluation harness
- Baseline comparison: `npm run eval:retrieval -- --compare-baseline`

## Dependencies

### Internal
- `../agent/retrieval/` — Lexical and semantic search implementations
- `../db.ts` — Patient data access

### External
- `@langchain/openai` — Embeddings for semantic search

<!-- MANUAL: -->
