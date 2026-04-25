<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# tools

## Purpose
LangGraph tool definitions — callable actions available to the agent supervisor and sub-agents. Each tool wraps a specific capability (verify identity, fetch data, translate, audit, etc.).

## Key Files

| File | Description |
|------|-------------|
| `verifyRequester.ts` | Verifies clinician identity and credentials |
| `analyzeRequestIntent.ts` | Extracts structured intent from natural-language requests |
| `decideTier.ts` | Invokes the deterministic policy engine for tier classification |
| `fetchSummary.ts` | Retrieves authorized patient summary data |
| `translateTerms.ts` | Translates medical terminology to the target locale |
| `issueSessionToken.ts` | Issues a short-lived JWT session token |
| `requestPatientApproval.ts` | Triggers Tier 2 patient approval flow |
| `logAuditOnChain.ts` | Submits audit events via the Solana client |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `retrievers/` | Semantic retrieval tools — embedding, fusion, local semantic index (see `retrievers/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Tools are LangGraph `tool` definitions — they have typed input/output schemas
- `decideTier.ts` delegates to `../policy/deterministicEngine.ts` — it must not contain its own logic
- `logAuditOnChain.ts` calls into `../../solana/client.ts`
- New tools must be registered in the supervisor graph (`../supervisor.ts`)

### Testing Requirements
- `../../../tests/verify-requester.test.ts`
- `../../../tests/request-intent.test.ts`
- `../../../tests/audit-payload.test.ts`

<!-- MANUAL: -->
