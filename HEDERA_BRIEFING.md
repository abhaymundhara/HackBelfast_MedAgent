# Hedera Hackathon Briefing

Verified on 2026-04-11.

## What I loaded

- Hedera skills package installed globally with `npx -y skills add hedera-dev/hedera-skills --all -g`
- Official Hedera docs MCP manifest downloaded to `.references/hedera-mcp.html`
- Hedera Agent Kit JS repo cloned to `.references/hedera-agent-kit-js`
- Hedera Agent Kit Python repo cloned to `.references/hedera-agent-kit-py`
- Hedera skills repo cloned to `.references/hedera-skills`
- Official product/blog pages saved locally:
  - `.references/hedera-agent-kit-blog.html`
  - `.references/hedera-ai-studio.html`
  - `.references/hedera-agent-lab-docs.html`
  - `.references/portal-hedera.html`

## Installed Hedera skills

Installed under `~/.agents/skills`:

- `hedera-plugin-creation`
- `hedera-consensus-service`
- `hedera-token-service`
- `hts-system-contract-skill`
- `schedule-service-system-contract-skill`
- `hedera-hackathon-prd`
- `hedera-hackathon-submission-validator`
- `project-scaffolding`
- `quality-gates`
- `session-management`

Important: these are installed for Codex, but a fresh Codex session is needed for them to appear in the built-in skill registry automatically. In this session, I can still read and use them directly from disk.

## Local repo checkpoints

- `hedera-agent-kit-js`
  - path: `.references/hedera-agent-kit-js`
  - commit: `573608a711c6ff2f1e928c8dd955f27b6b74e932`
- `hedera-agent-kit-py`
  - path: `.references/hedera-agent-kit-py`
  - commit: `fdc07460f585db1f42fd3d70e096ff0407ac1b0f`
- `hedera-skills`
  - path: `.references/hedera-skills`
  - commit: `046715e40c40d00f2c7985b1d88db8e3e9fbbfc8`

## Current versions and metadata

### Hedera docs MCP

The endpoint `https://docs.hedera.com/mcp` currently returns a JSON MCP manifest, not a marketing page.

- server name: `Hedera`
- version: `1.0.0`
- transport: `http`
- tools:
  - `search_hedera`
  - `query_docs_filesystem_hedera`
- resource:
  - `mintlify://skills/hedera`

This is useful because the docs side already exposes:

- semantic search across Hedera docs
- a virtual read-only filesystem over documentation and OpenAPI files

### Hedera Agent Kit JS

- npm package: `hedera-agent-kit`
- latest npm version observed: `3.8.2`
- npm publish timestamp observed via `npm search`: `2026-03-21T11:53:25.433Z`
- package path in repo: `.references/hedera-agent-kit-js/typescript/package.json`
- minimum Node version: `>=18`

Notable dependencies in the current repo state:

- `@hashgraph/sdk` `2.80.0`
- `@modelcontextprotocol/sdk` `1.27.1`
- `langchain` `1.2.24`
- `@langchain/core` `1.1.24`
- `@langchain/mcp-adapters` `1.1.3`
- `ai` `6.0.86`
- `ethers` `6.15.0`

Examples available locally:

- `.references/hedera-agent-kit-js/typescript/examples/ai-sdk`
- `.references/hedera-agent-kit-js/typescript/examples/langchain`
- `.references/hedera-agent-kit-js/typescript/examples/langchain-v1`
- `.references/hedera-agent-kit-js/typescript/examples/nextjs`
- `.references/hedera-agent-kit-js/typescript/examples/plugin`
- `.references/hedera-agent-kit-js/modelcontextprotocol`

Core plugin families documented in `docs/HEDERAPLUGINS.md`:

- Account
- Account Query
- Consensus
- Consensus Query
- Token
- Token Query
- EVM
- EVM Query
- Misc Query
- Transaction Query

### Hedera Agent Kit Python

- PyPI package: `hedera-agent-kit`
- current PyPI version observed: `3.3.0`
- package path in repo: `.references/hedera-agent-kit-py/python/pyproject.toml`
- Python range: `>=3.10,<3.14`

Notable dependencies in the current repo state:

- `langchain == 1.2.10`
- `langchain-openai == 1.1.10`
- `langchain-anthropic == 1.3.4`
- `langchain-groq == 1.1.2`
- `google-adk == 1.28.0`
- `hiero-sdk-python == 0.2.0`
- `mcp == 1.26.0`
- `langchain-mcp-adapters ^0.2.1`

Examples available locally:

- `.references/hedera-agent-kit-py/python/examples/langchain`
- `.references/hedera-agent-kit-py/python/examples/langchain-classic`
- `.references/hedera-agent-kit-py/python/examples/adk`
- `.references/hedera-agent-kit-py/python/examples/langchain/hedera_mcp_agent.py`

Core plugin families documented in `docs/HEDERAPLUGINS.md` largely mirror the JS toolkit:

- Account
- Account Query
- Consensus
- Consensus Query
- Token
- Token Query
- EVM
- Misc Query
- Transaction Query

## Product and docs notes

### Deep dive blog

Official page saved at `.references/hedera-agent-kit-blog.html`.

Observed metadata:

- title: `Deep Dive into the Hedera Agent Kit: Plugins, Tools, and Practical Workflows | Hedera`
- published: `2025-10-01T14:00:00+00:00`
- modified: `2025-12-08T18:03:58+00:00`

The page frames Agent Kit around:

- HCS
- HTS
- account management
- human-in-the-loop and autonomous execution

### AI Studio overview

Official page saved at `.references/hedera-ai-studio.html`.

Observed metadata:

- title: `AI Studio | Hedera`
- canonical/og URL: `https://hedera.com/product/ai-studio/`
- modified: `2026-04-10T15:27:52+00:00`

Page description:

- AI Studio is positioned as a way to build AI agents with verifiable trust and transparency on Hedera.

### Agent Lab

Most useful public references I found:

- docs page: `https://docs.hedera.com/hedera/open-source-solutions/ai-studio-on-hedera/agent-lab`
- launch blog: `https://hedera.com/blog/introducing-hedera-agent-lab/`

Local artifact:

- `.references/hedera-agent-lab-docs.html`

Key observed details from current official docs/blog:

- Agent Lab is in the Hedera Developer Portal.
- It supports a no-code Agent Builder, a low-code code-generation mode, and an Advanced Mode with direct editing.
- Its workflow is `Build -> Code -> Run`.
- Generated code is TypeScript.
- It runs agents against Hedera Testnet.
- HITL mode returns unsigned transaction bytes for approval/signing.
- The launch blog is dated `March 26, 2026`.
- The launch blog says users can choose between LangChain, Vercel AI SDK, and Google ADK coming soon.
- The launch blog says future work includes `Policies and Hooks`.

Note on direct portal access: a plain `curl` to `https://portal.hedera.com` hit a Cloudflare challenge page from this environment, so the docs/blog pages were more reliable sources than the raw portal HTML.

## Useful local entry points

Fast ways to search what I downloaded:

```bash
rg -n "HederaLangchainToolkit|Plugin|MCP|HITL|Human-In-The-Loop" .references/hedera-agent-kit-js .references/hedera-agent-kit-py
rg -n "topic|TopicMessage|TopicCreateTransaction" ~/.agents/skills/hedera-consensus-service .references/hedera-agent-kit-js .references/hedera-agent-kit-py
rg -n "TokenCreateTransaction|AIRDROP|ALLOWANCE|ERC20|ERC721" ~/.agents/skills/hedera-token-service .references/hedera-agent-kit-js .references/hedera-agent-kit-py
```

High-value docs to open first:

- `.references/hedera-agent-kit-js/README.md`
- `.references/hedera-agent-kit-js/docs/HEDERAPLUGINS.md`
- `.references/hedera-agent-kit-js/docs/DEVEXAMPLES.md`
- `.references/hedera-agent-kit-py/README.md`
- `.references/hedera-agent-kit-py/docs/HEDERAPLUGINS.md`
- `.references/hedera-agent-kit-py/docs/DEVEXAMPLES.md`
- `~/.agents/skills/hedera-plugin-creation/SKILL.md`
- `~/.agents/skills/hedera-consensus-service/SKILL.md`
- `~/.agents/skills/hedera-token-service/SKILL.md`

## Practical implications for this hackathon

- JS/TS is the most up-to-date primary path right now because the npm package is at `3.8.2` and the repo examples cover AI SDK, LangChain, Next.js, plugin authoring, and MCP.
- Python is viable and current enough for LangChain v1 and Google ADK work, but the packaged version currently trails JS (`3.3.0` vs `3.8.2`).
- Agent Lab is real and public as of March 26, 2026, so it can be used for rapid prototyping, export, and HITL demos.
- Hedera’s docs MCP endpoint is worth wiring into workflows later because it already provides both search and doc-file access.
