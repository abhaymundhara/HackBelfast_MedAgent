# Market Feedback

This is a conservative demo-stage validation log compiled on 2026-04-12. It does not claim signed pilots or formal discovery interviews. It records the directional feedback that shaped the current build and points to the visible product changes that resulted from it.

## Cycle 1 - clinical usability and trust boundary

### 2026-04-11

- Source type: informal clinician-style reviewer
- Concern raised: emergency care needs a compact, high-signal subset faster than a full records workflow.
- Resulting product change: the app now centers a deterministic three-tier release model instead of a broad records-sharing story.
- Visible proof: `/clinician/session/[id]` clearly separates `Released` and `Withheld`, and `tests/field-filtering.test.ts` asserts the tier differences.
- Residual open question: whether a real live deployment would need even tighter Tier 3 summarization by condition type.

### 2026-04-11

- Source type: non-team product reviewer
- Concern raised: patient consent should not block a true unconscious-patient emergency, but break-glass access must stay narrow and auditable.
- Resulting product change: Tier 3 releases only critical data, keeps documents and discharge context withheld, and still logs the event to Solana.
- Visible proof: `lib/agent/tools/decideTier.ts`, `lib/agent/tools/fetchSummary.ts`, `/audit/[patientId]`, and `tests/tier-logic.test.ts`.
- Residual open question: what external governance or review would be required for production break-glass policies.

### 2026-04-11

- Source type: hackathon demo reviewer
- Concern raised: a generic chatbot framing weakens trust in a medical emergency product.
- Resulting product change: the request remains natural-language, but the system now exposes the workflow steps, verification basis, and constrained follow-up behavior directly in the clinician session.
- Visible proof: `/clinician/session/[id]`, `lib/agent/medagent.ts`, and `docs/agentic-design.md`.
- Residual open question: whether a future version should show even more explicit tool inputs/outputs for enterprise buyers.

## Cycle 2 - auditability, approval flow, and demo clarity

### 2026-04-12

- Source type: technical demo reviewer
- Concern raised: Tier 2 approval must clearly pause and resume the same request, not appear to create a second hidden request.
- Resulting product change: the clinician waiting state now tracks a single `requestId`, polls a read-only request-status endpoint, and resumes the original request after patient approval.
- Visible proof: `components/app/clinician-console.tsx`, `app/api/access/request/[id]/route.ts`, and `tests/tier2-resume.test.ts`.
- Residual open question: whether a production workflow should use websocket or push updates instead of polling.

### 2026-04-12

- Source type: hackathon pitch reviewer
- Concern raised: judges need to see that the clinician request changes the experience without changing policy.
- Resulting product change: the session now includes a `Clinical intent` panel, request-specific prioritization, and request-specific follow-up question starters, while access scope remains unchanged.
- Visible proof: `/clinician/session/[id]`, `lib/agent/tools/analyzeRequestIntent.ts`, and `tests/request-intent.test.ts`.
- Residual open question: whether future buyer validation would prefer specialty-specific intent templates over general emergency heuristics.

### 2026-04-12

- Source type: technical integration reviewer
- Concern raised: the Solana story is strongest when the operator can prove live readiness before the demo rather than discovering missing credentials or mirror issues on stage.
- Resulting product change: the repo now includes a dedicated readiness path for credentials, RPC health, Anchor audit write, and Solscan-verifiable transaction references.
- Visible proof: `lib/solana/readiness.ts`, `scripts/demo-readiness.ts`, `/api/demo/readiness`, and `docs/demo-script.md`.
- Residual open question: how often a production operator should run active readiness pings versus passive health checks.

## Net effect on the build

- The clinician flow now demonstrates agent orchestration more clearly without giving the model control over access decisions.
- The Tier 2 human-in-the-loop story is more reliable and more judge-friendly.
- The Solana audit path is easier to prove live before judging.
- The validation narrative remains conservative, but it is now easier to map each directional signal to a concrete product change.
