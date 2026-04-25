# Judge Evidence Matrix

## AI / agentic fit

- Route / behavior: `/clinician`, `/clinician/session/[id]`
- Code / docs: `lib/agent/medagent.ts`, `lib/agent/tools/analyzeRequestIntent.ts`, `docs/agentic-design.md`
- Proof to show live: natural-language request, graph-based step trace, request-specific focus panel, HITL pause/resume, constrained follow-up prompts
- Test / script: `tests/request-intent.test.ts`, `tests/tier2-resume.test.ts`

## Real Solana usage

- Route / behavior: `/audit/[patientId]`, `/api/demo/readiness`
- Code / docs: `lib/solana/client.ts`, `lib/solana/auditStore.ts`, `lib/solana/readiness.ts`
- Proof to show live: Solana Anchor program submission signature, slot metadata, Solscan link, readiness check output
- Test / script: `npm run demo:readiness`, `tests/demo-readiness.test.ts`

## Clear user value

- Route / behavior: `/`, `/patient/dashboard`, `/clinician/session/[id]`
- Code / docs: landing page, patient dashboard, `docs/demo-script.md`
- Proof to show live: narrow emergency use case, three visibly different release scopes, time-limited access session
- Test / script: `tests/field-filtering.test.ts`

## Privacy and safety

- Route / behavior: session page shows released versus withheld fields and requested-but-withheld focus
- Code / docs: `lib/crypto.ts`, `lib/agent/tools/fetchSummary.ts`, `lib/agent/tools/logAuditOnChain.ts`
- Proof to show live: AES-256-GCM at rest, PHI off-chain, audit payload limited to hashes and metadata
- Test / script: `tests/audit-payload.test.ts`, `tests/field-filtering.test.ts`

## Technical rigor

- Route / behavior: request lifecycle, patient approval, request-status polling, session creation
- Code / docs: `lib/db.ts`, `app/api/access/request/[id]/route.ts`, `app/api/access/approve/route.ts`, `scripts/test-agent.ts`
- Proof to show live: deterministic tiering, no duplicate Tier 2 request on resume, auditable denial path
- Test / script: `npm run test`, `npm run test:agent`, `tests/tier-logic.test.ts`, `tests/tier2-resume.test.ts`

## Demo readiness

- Route / behavior: `/patient/dashboard`, `/audit/[patientId]`, `/api/demo/readiness`
- Code / docs: `docs/demo-script.md`, `scripts/demo-reset.ts`, `scripts/demo-readiness.ts`
- Proof to show live: seeded personas, one-command reset, visible patient approval controls, readiness pass/fail before judging
- Test / script: `npm run demo:reset`, `npm run demo:readiness`
