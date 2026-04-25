<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# medagent

## Purpose
Next.js 14 application providing the full MedAgent product: clinician console, patient dashboard, audit viewer, API routes, LangGraph agent workflow, RAG retrieval pipeline, and Solana audit integration.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Dependencies and scripts (`dev`, `build`, `test`, `seed:demo`, `eval:retrieval`, etc.) |
| `next.config.mjs` | Next.js configuration |
| `tsconfig.json` | TypeScript config |
| `tailwind.config.ts` | Tailwind CSS theme and plugin config |
| `postcss.config.mjs` | PostCSS pipeline |
| `vitest.config.ts` | Vitest test runner config |
| `components.json` | shadcn/ui component configuration |
| `.eslintrc.json` | ESLint rules |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router — pages and API routes (see `app/AGENTS.md`) |
| `components/` | React components — app-specific and shadcn/ui primitives (see `components/AGENTS.md`) |
| `lib/` | Core logic — agent workflow, RAG, Solana client, DB, crypto (see `lib/AGENTS.md`) |
| `hooks/` | React hooks (see `hooks/AGENTS.md`) |
| `scripts/` | CLI scripts — demo seeding, readiness checks, eval runners (see `scripts/AGENTS.md`) |
| `tests/` | Integration and unit tests (see `tests/AGENTS.md`) |
| `types/` | TypeScript type declarations (see `types/AGENTS.md`) |
| `docs/` | Hackathon documentation — pitch, demo script, competitive analysis (see `docs/AGENTS.md`) |
| `public/` | Static assets (SVG icons) |

## For AI Agents

### Working In This Directory
- Run `npm run dev` to start the dev server on `http://localhost:3000`
- Use `npm run seed:demo` to populate demo data before testing
- All env vars go in `.env.local` — see root `README.md` for the full list
- This is a Next.js App Router project — pages use `page.tsx`, API routes use `route.ts`

### Testing Requirements
- `npm run test` — vitest with coverage
- `npm run test:agent` — agent workflow integration test
- `npm run build` — Next.js production build (catches type errors)
- `npm run demo:readiness` — validates Solana RPC, program, and credentials

### Common Patterns
- camelCase naming throughout
- shadcn/ui components in `components/ui/`, app components in `components/app/`
- API routes return JSON with consistent error shapes
- Agent workflow uses LangGraph state machine pattern
- Feature flags via `MEDAGENT_*` environment variables

## Dependencies

### External
- `next` 14 — Framework
- `react` 18 — UI
- `@langchain/langgraph` — Agent graph orchestration
- `@langchain/openai` — LLM provider
- `@coral-xyz/anchor` / `@solana/web3.js` — Solana integration
- `better-sqlite3` — Local SQLite database
- `zod` — Schema validation
- `tailwindcss` 3 / Radix UI — Styling and primitives

<!-- MANUAL: -->
