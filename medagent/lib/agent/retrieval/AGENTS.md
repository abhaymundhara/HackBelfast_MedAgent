<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# retrieval

## Purpose
Retrieval pipeline implementations — lexical search, semantic reranking, query normalization, and scoring. These are the low-level search primitives used by the retrieval planner and RAG client.

## Key Files

| File | Description |
|------|-------------|
| `buildLexicalIndex.ts` | Builds in-memory lexical (BM25-style) indexes from patient records |
| `localLexicalSearch.ts` | Executes lexical queries against built indexes |
| `scoreLexicalCandidates.ts` | Scores and ranks lexical search candidates |
| `semanticReranker.ts` | Reranks retrieval candidates using semantic similarity |
| `normalizeMedicalQuery.ts` | Normalizes medical terminology in queries for better recall |
| `plannerDefaults.ts` | Default retrieval planner configuration values |
| `retrievalTypes.ts` | Shared types for the retrieval subsystem |

## For AI Agents

### Working In This Directory
- Lexical and semantic paths are independent — can be used solo or fused
- `normalizeMedicalQuery.ts` handles synonym expansion and abbreviation resolution
- Planner defaults in `plannerDefaults.ts` can be overridden by the plan optimizer
- All retrieval is patient-scoped — never cross patient boundaries

### Testing Requirements
- `../../../tests/local-lexical-retrieval.test.ts`
- `../../../tests/semantic-reranker.test.ts`
- `../../../tests/normalize-medical-query.test.ts`
- `../../../tests/retrieval-planner-lexical.test.ts`
- `../../../tests/retrieval-planner-hybrid.test.ts`

<!-- MANUAL: -->
