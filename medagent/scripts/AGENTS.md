<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# scripts

## Purpose
CLI scripts for demo setup, readiness checks, evaluation runners, and manual agent testing. All run via `tsx`.

## Key Files

| File | Description |
|------|-------------|
| `seed-demo.ts` | Populates demo patients, clinicians, and IPS records (`npm run seed:demo`) |
| `demo-reset.ts` | Resets demo state to clean baseline (`npm run demo:reset`) |
| `demo-readiness.ts` | Validates Solana RPC, program, and credentials (`npm run demo:readiness`) |
| `test-agent.ts` | Manual agent workflow integration test (`npm run test:agent`) |
| `run-retrieval-eval.ts` | Retrieval evaluation harness (`npm run eval:retrieval`) |
| `run-embedding-bakeoff.ts` | Embedding model comparison (`npm run eval:embedding-bakeoff`) |
| `run-retrieval-cost-dashboard.ts` | Retrieval cost analysis (`npm run eval:cost-dashboard`) |

## For AI Agents

### Working In This Directory
- Scripts are run with `tsx` (TypeScript execution) — no compile step needed
- Most scripts depend on the database being initialized first
- `seed-demo.ts` must run before demo flows work
- Eval scripts are safe to run locally — they don't write on-chain

<!-- MANUAL: -->
