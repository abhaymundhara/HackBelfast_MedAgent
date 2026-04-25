# MedAgent App

This package contains the Next.js application, the LangGraph-based MedAgent workflow, local retrieval stack, Solana audit integration, and the demo/test scripts used by the root project.

Use the repository root `README.md` as the primary project guide. It documents:

- product scope and demo flow
- deterministic access policy
- retrieval freshness, evaluation, and observability
- workflow API boundaries
- local setup and verification commands

Common app commands:

```bash
npm run dev
npm run seed:demo
npm run demo:readiness
npm run eval:retrieval
npm run test
npm run build
```

Anchor wallet path is configured from `SOLANA_WALLET` in the repo `Anchor.toml`.
Set an absolute path before Anchor commands:

- macOS/Linux: `export SOLANA_WALLET="$HOME/.config/solana/id.json"`
- Windows PowerShell: `$env:SOLANA_WALLET="$env:USERPROFILE\.config\solana\id.json"`
