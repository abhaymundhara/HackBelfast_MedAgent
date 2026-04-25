<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# lib

## Purpose
Core application logic — agent workflow orchestration, RAG retrieval pipeline, Solana audit client, database layer, cryptography, and shared utilities.

## Key Files

| File | Description |
|------|-------------|
| `db.ts` | SQLite database initialization and access (better-sqlite3) |
| `types.ts` | Shared TypeScript types used across the app |
| `crypto.ts` | Hashing and encryption utilities (patient/doctor pseudonymization) |
| `utils.ts` | General utility functions |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `agent/` | LangGraph agent workflow — supervisor, tools, policy engine, retrieval (see `agent/AGENTS.md`) |
| `rag/` | RAG pipeline — indexing, caching, evaluation, observability (see `rag/AGENTS.md`) |
| `solana/` | Solana integration — Anchor client, audit store, readiness checks (see `solana/AGENTS.md`) |
| `ips/` | International Patient Summary — FHIR-like schema and seed data (see `ips/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `agent/` is the core workflow — changes here affect the entire request pipeline
- `rag/` is the retrieval subsystem — has its own test suite and eval harness
- `solana/` is the on-chain audit layer — falls back gracefully when keys are missing
- `db.ts` and `types.ts` are shared foundations — changes ripple widely

### Testing Requirements
- Unit tests colocated in `__tests__/` subdirectories
- Integration tests in `../tests/`
- `npm run test` runs all vitest suites

<!-- MANUAL: -->
