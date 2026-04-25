<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# MedAgent (Root)

## Purpose
Deterministic emergency medical access system built for hackathon demo. Clinicians get narrow, time-limited views of a traveler's emergency summary under a three-tier access policy, with non-PHI audit metadata recorded on Solana via an Anchor program.

## Key Files

| File | Description |
|------|-------------|
| `Anchor.toml` | Anchor framework config — program IDs for localnet/devnet, wallet via `${SOLANA_WALLET}` |
| `Cargo.toml` | Rust workspace root — members: `programs/medagent_audit` |
| `Cargo.lock` | Pinned Rust dependency tree |
| `rust-toolchain.toml` | Anchor version pin (0.31.1) |
| `.gitignore` | Repo-level ignores |
| `README.md` | Full project documentation: architecture, setup, demo flow, verification |
| `MEDAGENT_BUILD_SPEC.md` | Detailed build specification |
| `MEDAGENT_IMPLEMENTATION_PROMPT.md` | Implementation guidance prompt |
| `IMESSAGE_INTEGRATION_PROMPT.md` | iMessage integration and Belfast pivot specification |
| `Hackathon_Cheat_Sheet.md` | Quick-reference for hackathon context |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `medagent/` | Next.js application — UI, API routes, agent workflow, RAG pipeline (see `medagent/AGENTS.md`) |
| `programs/` | Solana Anchor programs (see `programs/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- The Next.js app lives in `medagent/` — run `npm` commands from there.
- Anchor/Rust commands run from repo root: `cargo check -p medagent_audit`, `NO_DNA=1 anchor build`.
- Environment variables go in `medagent/.env.local` (never commit).
- `Anchor.toml` wallet uses `${SOLANA_WALLET}` env var — set to absolute path before Anchor commands.

### Testing Requirements
- App: `cd medagent && npm run test` (vitest) and `npm run build` (Next.js)
- Program: `cargo check -p medagent_audit`
- Demo readiness: `cd medagent && npm run demo:readiness`

### Common Patterns
- Deterministic policy decisions — LLM never decides access tiers
- No PHI on-chain — only hashed/pseudonymous metadata
- Feature flags control optional subsystems (retrieval observability, plan optimizer)

## Dependencies

### External
- Next.js 14 — App router framework
- LangChain / LangGraph — Agent workflow orchestration
- Anchor 0.31.1 / Solana Web3.js — On-chain audit logging
- SQLite (better-sqlite3) — Local data store
- OpenAI — Translation and follow-up (optional, falls back to deterministic)

<!-- MANUAL: -->
