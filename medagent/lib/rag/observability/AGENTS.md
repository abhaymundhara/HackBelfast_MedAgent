<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# observability

## Purpose
Retrieval observability layer — latency budgets, metrics persistence, regression detection, cost tracking, and query plan health diagnostics.

## Key Files

| File | Description |
|------|-------------|
| `retrievalObservability.ts` | Main observability facade — collects and emits retrieval metrics snapshots |
| `retrievalBudget.ts` | Latency budget classification — `healthy`, `degraded`, `budget_exceeded` |
| `retrievalRegression.ts` | Baseline comparison for detecting retrieval quality regressions |
| `retrievalCost.ts` | Retrieval cost tracking and analysis |
| `metricsStore.ts` | Local metrics persistence layer |
| `queryPlanHealth.ts` | Query plan health diagnostics — FTS usage, patient scoping, scan hints |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Observability unit tests (metrics store, query health, regression, observability) |

## For AI Agents

### Working In This Directory
- Feature-flagged: `MEDAGENT_ENABLE_RETRIEVAL_OBSERVABILITY=true|false`
- Budget profiles: `MEDAGENT_RETRIEVAL_BUDGET_PROFILE=default|strict`
- Observability is passive — never interrupts request flow
- Regression detection compares current metrics against saved baselines
- Cost tracking is local-only, no external reporting

### Testing Requirements
- Tests in `__tests__/` cover all observability components
- `npm run eval:cost-dashboard` generates cost analysis reports

<!-- MANUAL: -->
