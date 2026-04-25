# MedAgent

MedAgent is a deterministic emergency medical access demo built for live walkthroughs and hackathon judging. It gives clinicians a narrow, time-limited view of a traveler's emergency summary while recording non-PHI audit metadata through the `medagent_audit` Anchor program.

The system is intentionally scoped around emergency access rather than full EHR interoperability. Its core question is simple: what is the minimum safe medical context a clinician should see right now, under what policy, and with what audit trail?

## Product Model

MedAgent uses a deterministic three-tier access policy:

- `Tier 1`: trusted clinician + patient auto-access
- `Tier 2`: patient-approved access after a pause/resume step
- `Tier 3`: break-glass critical-only access
- `Denied`: no release, no session token, audit still recorded

The AI layer does not decide access. The model is used for request interpretation, translation, briefing, and constrained follow-up answers after authorization. Policy decisions stay deterministic and outside the LLM.

## Solana Audit Design

Audit logging is Solana-first in this branch.

- On-chain writes go through the `medagent_audit` Anchor program.
- Audit events are written with hashed or pseudonymous metadata only.
- No PHI is written on-chain.
- The app stores local copies of audit rows so the UI can deterministically replay and render the audit timeline.
- Audit viewer rows link to Solscan transaction URLs in the form:
  `https://solscan.io/tx/<signature>?cluster=devnet`

Current audit event shape:

- `event_type`
- `request_id`
- `doctor_hash`
- `patient_hash`
- `jurisdiction`
- `decision`
- `token_expiry`
- `timestamp`

## Architecture

- `medagent/`: Next.js app, API routes, UI, tests
- `medagent/lib/agent/`: LangGraph workflow and tool orchestration
- `medagent/lib/solana/`: Solana client, readiness checks, audit store
- `programs/medagent_audit/`: Anchor program for on-chain audit writes
- `medagent/docs/`: judge-facing and product-facing demo material

High-level runtime flow:

1. Clinician submits a natural-language emergency request.
2. MedAgent verifies the requester and applies deterministic tier policy.
3. If needed, the workflow pauses for patient approval.
4. Authorized fields are fetched, translated, and summarized.
5. A short-lived session token is issued.
6. Audit events are written through the Anchor program and reflected in the audit viewer.

## Retrieval Freshness and Background Indexing

MedAgent now maintains local retrieval indexes with a background refresh path:

- First request for a patient with no usable index performs a synchronous build for safety.
- After first build, stale indexes are still servable while an index refresh is queued in the background.
- Background refresh updates a patient-scoped manifest (`ready` / `stale` / `building` / `failed`) keyed by source fingerprint.

Retrieval caching is patient-scoped, query-plan-aware, and source-fingerprint-aware:

- `fresh`: serve directly from cache.
- `stale_servable`: serve immediately and queue background recompute (stale-while-revalidate).
- `expired`: recompute synchronously.

Cache and index behavior are local-only and deterministic. Policy, tiering, evidence filtering, and synthesis boundaries remain unchanged: no cache or index path can widen data access beyond deterministic policy controls.

## Retrieval Evaluation and Plan Optimization

MedAgent includes a local-first retrieval evaluation harness and a deterministic planner optimizer.

- Evaluation runner executes retrieval-only checks (no reviewer/synthesizer) across multiple modes:
  `lexical_only`, `lexical_plus_rerank`, `cached`, and `cold_start`.
- Metrics include recall@k, precision@k, MRR, nDCG-lite, field/note-type coverage, latency, cache-hit rate, stale-cache serve rate, background-refresh rate, and rerank deltas.
- Planner optimizer uses prior retrieval telemetry to recommend deterministic plan settings (`precision_first`, `balanced`, `recall_first`), bounded `topK`, and mode ordering.
- Optimizer is optional and flag-gated:
  `MEDAGENT_ENABLE_PLAN_OPTIMIZER` and `MEDAGENT_PLAN_OPTIMIZER_PROFILE`.

This evaluation and optimizer layer does not alter deterministic policy boundaries, access controls, or synthesis safety constraints.

Run evaluation locally:

```bash
cd medagent
npm run eval:retrieval
```

Create a local eval baseline:

```bash
cd medagent
npm run eval:retrieval -- --make-baseline --baseline=./data/retrieval-observability/eval/baseline.json
```

Compare current retrieval behavior against a saved baseline:

```bash
cd medagent
npm run eval:retrieval -- --compare-baseline --baseline=./data/retrieval-observability/eval/baseline.json
```

## Retrieval Observability and Regression Gates

MedAgent also includes a local-first observability and regression pipeline around retrieval planner execution.

- Each planner invocation can emit a deterministic retrieval metrics snapshot (latency, cache/index freshness, candidate counts, zero-result/pruning diagnostics).
- Latency budgets classify planner health as `healthy`, `degraded`, or `budget_exceeded` without interrupting request flow.
- Metrics snapshots are persisted locally and can be compared against baseline snapshots to detect regressions in latency and retrieval quality trends.
- Query-plan health diagnostics expose indexed-path signals (FTS usage, patient scoping, expensive scan hints) via structured flags.
- Eval artifacts now support baseline generation and baseline comparison for local regression gating.
- Workflow checkpoint state is persisted locally so pause/resume flows survive process restarts during demos.
- Readiness checks use dry-run validation and do not submit probe events on-chain.

Feature flags:

- `MEDAGENT_ENABLE_RETRIEVAL_OBSERVABILITY=true|false`
- `MEDAGENT_RETRIEVAL_BUDGET_PROFILE=default|strict`
- `MEDAGENT_RETRIEVAL_SAVE_METRICS=true|false`
- `MEDAGENT_RETRIEVAL_REGRESSION_BASELINE=<path>`
- `MEDAGENT_RETRIEVAL_HEALTHCHECK_EXPLAIN=true|false`

Defaults are local deterministic behavior with observability enabled, metrics persistence enabled, and explain-based health diagnostics enabled in non-production environments.

## Workflow API Boundary

The request workflow boundary is now:

```ts
runMedAgentWorkflow({
  input: {
    patientId,
    requesterId,
    naturalLanguageRequest,
    targetLocale,
    emergencyMode,
    presentedCredential,
  },
});
```

Resume flows use:

```ts
runMedAgentWorkflow({ resumeRequestId });
```

The compatibility shim in `medagent/lib/agent/medagent.ts` re-exports the public workflow helpers used by routes, scripts, and tests.

## Local Setup

### App

```bash
cd medagent
npm install
npm run seed:demo
npm run dev
```

Open `http://localhost:3000`.

### Environment

Optional `.env.local` values:

```bash
OPENAI_API_KEY=...
SOLANA_PRIVATE_KEY=[...]
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WALLET=/absolute/path/to/solana/id.json
JWT_SECRET=...
ENCRYPTION_PEPPER=...
```

Notes:

- If `SOLANA_PRIVATE_KEY` is missing, the app falls back to local-only audit markers instead of live chain submission.
- If `OPENAI_API_KEY` is missing, translation/follow-up fall back to deterministic local behavior.
- Demo readiness checks validate RPC/program availability without polluting the audit log.
- `Anchor.toml` now resolves wallet via `${SOLANA_WALLET}` for cross-platform compatibility.
  Set it to an absolute path before running Anchor commands:
  - macOS/Linux: `export SOLANA_WALLET=\"$HOME/.config/solana/id.json\"`
  - Windows PowerShell: `$env:SOLANA_WALLET=\"$env:USERPROFILE\\.config\\solana\\id.json\"`
- Patient QR payloads currently emit both new (`auditRef`, `chainIdentity`) and legacy (`topicId`, `hederaIdentity`) keys for backward compatibility during migration.

### Anchor Program

From the repo root:

```bash
NO_DNA=1 anchor build
NO_DNA=1 anchor deploy --provider.cluster devnet
```

This branch has been wired so the app-side Solana audit layer invokes the Anchor program directly rather than using an opaque memo-only write path.

If you are doing purely local chain development, use `--provider.cluster localnet` and keep app/runtime URLs aligned to localnet values.

## Useful Commands

From `medagent/`:

```bash
npm run dev
npm run seed:demo
npm run demo:reset
npm run demo:readiness
npm run eval:retrieval
npm run test
npm run test:agent
npm run build
```

From repo root:

```bash
cargo check -p medagent_audit
NO_DNA=1 anchor build
```

## Demo Flow

Recommended demo path:

1. Run `npm run demo:readiness`
2. Open `/clinician`
3. Trigger Tier 1 with `Dr. Garcia`
4. Trigger Tier 2 with `Dr. Patel` and approve from `/patient/dashboard`
5. Trigger Tier 3 with the unknown emergency clinician
6. Open `/audit/sarah-bennett`

What to point out:

- deterministic tiering
- HITL pause/resume on the same request
- released vs withheld data
- short-lived session
- workflow trace
- Solana slot + transaction signature + Solscan link in the audit view

## Verification

App quality gates:

```bash
cd medagent
npm run test
npm run build
```

Program quality gate:

```bash
cargo check -p medagent_audit
```

Readiness check:

```bash
cd medagent
npm run demo:readiness
```

Expected readiness outcome in a live-configured environment:

- credentials available
- RPC reachable
- dry-run write path validated against `medagent_audit`

## Why This Is Agentic

MedAgent is not a chat wrapper over a records store.

- The workflow is graph-based.
- Branching depends on tool outputs and policy state.
- Human approval is a first-class control point.
- The LLM is constrained to tasks that are safe after access control.
- The app exposes the trace so operators can inspect what happened.

## Status

This branch is Solana-first for audit logging and is intended for demo and hackathon use. It is built to prove:

- narrow emergency-only release
- clear policy boundaries
- auditable on-chain evidence without PHI leakage
- a visible, inspectable agent workflow
