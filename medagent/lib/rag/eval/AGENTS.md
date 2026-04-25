<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# eval

## Purpose
Retrieval evaluation harness — measures retrieval quality (recall, precision, MRR, nDCG), supports baseline comparison for regression detection, and includes a deterministic plan optimizer.

## Key Files

| File | Description |
|------|-------------|
| `retrievalEvalRunner.ts` | Eval runner — executes retrieval across modes (lexical, rerank, cached, cold start) |
| `retrievalMetrics.ts` | Metric computation — recall@k, precision@k, MRR, nDCG-lite |
| `retrievalEvalDataset.ts` | Eval dataset loader and expected-result resolution |
| `retrievalEvalTypes.ts` | Type definitions for eval artifacts |
| `planOptimizer.ts` | Deterministic plan optimizer — recommends settings from prior telemetry |
| `queryPlanDiagnostics.ts` | Query plan health diagnostics — FTS usage, scan hints, patient scoping |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Eval unit tests (metrics, dataset, runner, optimizer, diagnostics) |
| `fixtures/` | Test fixtures (`retrieval-eval-dataset.json`) |

## For AI Agents

### Working In This Directory
- Eval runner is invoked via `npm run eval:retrieval`
- Plan optimizer is flag-gated: `MEDAGENT_ENABLE_PLAN_OPTIMIZER`
- Baseline generation: `npm run eval:retrieval -- --make-baseline`
- Baseline comparison: `npm run eval:retrieval -- --compare-baseline`
- Metrics must not alter policy or access boundaries

### Testing Requirements
- Tests in `__tests__/` cover all metric computations and optimizer logic
- Fixtures in `fixtures/` provide deterministic test datasets

<!-- MANUAL: -->
