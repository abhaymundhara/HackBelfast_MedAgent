<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# medagent_audit

## Purpose
Solana Anchor program for recording non-PHI audit events on-chain. Each audit event stores hashed metadata (doctor/patient hashes, jurisdiction, decision, timestamps) without any protected health information.

## Key Files

| File | Description |
|------|-------------|
| `Cargo.toml` | Crate config — depends on `anchor-lang` 0.31.1 |
| `src/lib.rs` | Program entry point — instruction handlers, account structs, event definitions |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | Rust source code |

## For AI Agents

### Working In This Directory
- Build: `NO_DNA=1 anchor build` (from repo root)
- Deploy: `NO_DNA=1 anchor deploy --provider.cluster devnet`
- Check: `cargo check -p medagent_audit`
- Program ID is in `Anchor.toml` — update both localnet and devnet entries if regenerated
- Never store PHI in on-chain account data or event fields

### Testing Requirements
- `cargo check -p medagent_audit` must pass
- Anchor build must succeed with `NO_DNA=1`
- App-side integration tested via `medagent/tests/audit-payload.test.ts`

### Common Patterns
- Uses Anchor's `#[program]`, `#[account]`, and `#[event]` macros
- Accounts are PDAs derived from request-scoped seeds
- Events emitted via Anchor's event system for client-side indexing

## Dependencies

### External
- `anchor-lang` 0.31.1 — Solana framework

<!-- MANUAL: -->
