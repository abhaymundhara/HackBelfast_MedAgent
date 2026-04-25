<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# policy

## Purpose
Deterministic policy engine — makes all access control decisions without LLM involvement. Handles tier classification, evidence filtering, session token issuance, retry logic, and runtime safety limits.

## Key Files

| File | Description |
|------|-------------|
| `deterministicEngine.ts` | Core tier decision logic — maps requester + patient state to Tier 1/2/3/Denied |
| `evidenceFilter.ts` | Filters retrieved evidence to only authorized fields per tier |
| `issuer.ts` | Issues short-lived JWT session tokens after authorization |
| `retryDecision.ts` | Determines whether a failed request can be retried |
| `runtimeLimits.ts` | Safety bounds — max tokens, max retrieval depth, timeout constraints |

## For AI Agents

### Working In This Directory
- **Critical safety boundary** — all code here must be deterministic, never LLM-driven
- `deterministicEngine.ts` is the single source of truth for tier decisions
- `evidenceFilter.ts` controls what data reaches the LLM — errors here leak PHI
- Changes require corresponding test updates in `../../../tests/tier-logic.test.ts`, `field-filtering.test.ts`, `redaction-guards.test.ts`
- Never weaken filtering assertions or add exceptions without explicit justification

### Testing Requirements
- `tier-logic.test.ts` — tier decision coverage
- `field-filtering.test.ts` — evidence filtering
- `redaction-guards.test.ts` — PHI redaction enforcement
- `runtime-limits.test.ts` — safety bound enforcement

<!-- MANUAL: -->
