<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# solana

## Purpose
Solana integration layer — Anchor client for the `medagent_audit` program, local audit event storage, and RPC readiness checks. Falls back gracefully to local-only audit markers when Solana credentials are unavailable.

## Key Files

| File | Description |
|------|-------------|
| `client.ts` | Anchor client wrapper — connects to Solana RPC, submits audit transactions |
| `auditStore.ts` | Local audit event storage — persists audit rows for UI rendering alongside on-chain references |
| `readiness.ts` | RPC and program readiness checks — dry-run validation without on-chain writes |

## For AI Agents

### Working In This Directory
- `client.ts` wraps `@coral-xyz/anchor` — changes here must match the Anchor program's IDL
- Program ID must match `Anchor.toml` entries
- Readiness checks use dry-run mode — they never submit real transactions
- When `SOLANA_PRIVATE_KEY` is missing, the client falls back to local-only mode
- Audit events contain only hashed/pseudonymous data — never store PHI

### Testing Requirements
- `../../tests/audit-payload.test.ts` validates audit event shapes
- `../../tests/demo-readiness.test.ts` tests readiness checks
- Manual: `npm run demo:readiness` for end-to-end validation

## Dependencies

### Internal
- `../../programs/medagent_audit/` — On-chain program (must stay in sync)
- `../crypto.ts` — Hash generation for audit fields

### External
- `@coral-xyz/anchor` — Anchor framework client
- `@solana/web3.js` — Solana RPC and transaction handling

<!-- MANUAL: -->
