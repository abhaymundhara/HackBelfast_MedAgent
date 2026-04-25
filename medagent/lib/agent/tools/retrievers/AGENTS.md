<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# retrievers

## Purpose
Semantic retrieval tools — embedding generation, local semantic index management, semantic search, and hybrid result fusion.

## Key Files

| File | Description |
|------|-------------|
| `embedCanonicalEvidence.ts` | Generates embeddings for canonical patient evidence documents |
| `localSemanticIndex.ts` | Builds and manages local semantic vector indexes |
| `localSemanticSearch.ts` | Executes semantic similarity search against local indexes |
| `fuseRetrievalResults.ts` | Fuses lexical and semantic results into a ranked candidate list |
| `semanticIndexTypes.ts` | Type definitions for the semantic index subsystem |

## For AI Agents

### Working In This Directory
- Semantic search uses OpenAI embeddings (falls back gracefully when key is missing)
- Fusion strategy combines lexical BM25 scores with semantic similarity
- Indexes are patient-scoped and stored locally
- Types are shared via `semanticIndexTypes.ts`

### Testing Requirements
- `../../../../tests/local-semantic-search.test.ts`
- `../../../../tests/semantic-index.test.ts`
- `../../../../tests/hybrid-fusion.test.ts`

<!-- MANUAL: -->
