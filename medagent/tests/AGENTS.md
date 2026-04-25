<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# tests

## Purpose
Integration and unit tests for the MedAgent application. Covers tier logic, access control, retrieval, redaction, audit payloads, and agent workflow invariants.

## Key Files

| File | Description |
|------|-------------|
| `tier-logic.test.ts` | Deterministic tier decision tests |
| `tier2-resume.test.ts` | Tier 2 pause/resume workflow tests |
| `denial.test.ts` | Access denial scenario tests |
| `field-filtering.test.ts` | Field-level data filtering tests |
| `redaction-guards.test.ts` | PHI redaction enforcement tests |
| `verify-requester.test.ts` | Requester verification tests |
| `request-intent.test.ts` | Natural language intent analysis tests |
| `audit-payload.test.ts` | Audit event shape and content tests |
| `demo-readiness.test.ts` | Demo readiness check tests |
| `local-lexical-retrieval.test.ts` | Lexical search tests |
| `local-semantic-search.test.ts` | Semantic search tests |
| `semantic-reranker.test.ts` | Reranking pipeline tests |
| `semantic-index.test.ts` | Semantic index construction tests |
| `hybrid-fusion.test.ts` | Hybrid retrieval fusion tests |
| `retrieval-planner-lexical.test.ts` | Lexical planner tests |
| `retrieval-planner-hybrid.test.ts` | Hybrid planner tests |
| `normalize-medical-query.test.ts` | Medical query normalization tests |
| `runtime-limits.test.ts` | Runtime safety limit tests |
| `issuer-audit-tail.test.ts` | Token issuer audit trail tests |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `agent/` | Agent workflow invariant tests (`workflow.invariants.test.ts`) |

## For AI Agents

### Working In This Directory
- Run all tests: `npm run test`
- Tests use vitest — follow existing patterns for new test files
- Test files match the pattern `*.test.ts`
- Agent-specific tests also exist in `../lib/agent/__tests__/`

### Testing Requirements
- New features need corresponding test coverage here
- Redaction and field-filtering tests are security-critical — never weaken assertions

<!-- MANUAL: -->
