# Agentic Society Hackathon — Builder Cheat Sheet

_Clean Markdown preservation of the uploaded PDF._

## Fidelity notes

- This is a clean preservation of the source PDF's readable content and embedded hyperlink targets.
- The original visual layout, branding, spacing, and exact annotation positions are not reproduced exactly in the recreated PDF.
- Several docs.hedera.com links are truncated inside the source PDF itself and are preserved here exactly as embedded, rather than guessed or repaired.
- The footer text `© 2026 Hedera Hashgraph, LLC. All rights reserved.` and `CONFIDENTIAL AND PROPRIETARY - DO NOT SHARE` appears on pages 2 to 8 of the source PDF.

---

## Page 1

# Agentic Society Hackathon — Builder Cheat Sheet

**Theme:** AI Agents × the Agentic Economy

**Build time:** Saturday 11 April 5 pm – Sunday 12 April 10 am

**Demos:** 10:30 am – 12:00 pm Sunday

**Prize pool:** ~$10,000 (1st / 2nd / 3rd)

**Bonus:** Top projects earn a direct path into Hedera's incubator (launching 18 May) with mentorship and funding pathways.

### What you're building

An AI agent (or multi-agent system) that interacts with the Hedera network. Think: agents that make payments, manage tokens, coordinate decisions, or prove their actions on-chain. The theme is the agentic society — autonomous agents that act, transact, and coordinate across products and markets.

### Ideas to spark inspiration

- A treasury agent that monitors balances and executes transfers based on rules or natural language
- An agent-to-agent marketplace where AI agents negotiate and settle trades

---

## Page 2

- A compliance agent that logs every decision to Hedera Consensus Service for auditability
- An agentic payment flow where agents pay for data or API access using HBAR or HTS tokens

### Step 0 — Get a Hedera testnet account

Sign up at the Hedera Developer Portal: [portal.hedera.com](http://portal.hedera.com)

You get access to 5x accounts that are topped up with 1,000 test HBAR every 24 hours. You'll get an Account ID and Private Key — keep these safe, you'll need them.

### Choose your path

Most hackers will follow Path A (no blockchain experience needed). Choose Path B if you're already comfortable with Solidity and EVM tooling.

### Path A: Hedera SDK + AI Agent Kit (recommended for most)

This path lets you build AI agents without writing smart contracts. The Agent Kit gives your AI agent tools to create accounts, transfer HBAR, mint tokens, and publish messages, all via natural language.

### What / Link

- Hedera Agent Kit (JS/TS) — the primary SDK for building AI agents on Hedera: <https://github.com/hashgraph/hedera-agent-kit-js>

> Header link shown in source PDF: [hedera.com](http://hedera.com)

---

## Page 3

### What / Link

- Hedera Agent Kit (Python) — same capabilities, Python-native with LangChain v1.0: <https://github.com/hashgraph/hedera-agent-kit-py>
- Agent Kit docs — overview, plugin list, and SDK comparison: <http://docs.hedera.com/%E2%80%A6/hedera-ai-agent-kit>
- Deep dive blog — plugins, tools, and practical workflows explained: <http://hedera.com/blog/deep-dive-into-the-hedera-agent-kit>
- npm package — npm install hedera-agent-kit (v3, latest): <http://npmjs.com/package/hedera-agent-kit>
- AI Studio overview — the full suite of AI developer tools on Hedera: <http://hedera.com/ai-studio>
- Hedera Agent Lab — browser-based, no-code/low-code agent builder (launched March 2026): <http://portal.hedera.com>

### Quick start (JS)

```text
npm install hedera-agent-kit @langchain/core langchain @langchain/langgraph @langchain/openai @hashgraph/sdk dotenv
```

Create a `.env` with your `OPERATOR_ID`, `OPERATOR_KEY`, and `OPENAI_API_KEY`, then follow the example in `examples/langchain/tool-calling-agent.ts`.

> Header link shown in source PDF: [hedera.com](http://hedera.com). The source PDF also visibly shows the word `Shell` at the top of this page.

---

## Page 4

### What the Agent Kit gives you out of the box

- Account operations (create, update, query balances)
- Token operations via HTS (create fungible/non-fungible tokens, transfer, mint, burn)
- Consensus messaging via HCS (create topics, publish messages)
- Smart contract interaction via EVM (ERC-20, ERC-721)
- LangChain integration (JS and Python), Vercel AI SDK, ElizaOS, and MCP Server support

### Path B: EVM + AI Agents

If you're comfortable with Solidity, you can deploy EVM-compatible smart contracts on Hedera and wire AI agents to them.

### What / Link

- EVM developer quickstart: <http://docs.hedera.com/%E2%80%A6/evm-developers>
- Hedera Contract Builder — browser-based Solidity IDE, deploy to testnet in seconds: <http://portal.hedera.com>
- Hardhat / Foundry / Ethers integration: <http://docs.hedera.com/%E2%80%A6/tutorials>
- JSON-RPC Relay — use standard EVM tooling (web3.js, ethers, Hardhat, Foundry): <http://docs.hedera.com>

> Header link shown in source PDF: [hedera.com](http://hedera.com)

---

## Page 5

### Hiero CLI — let your AI agent drive Hedera from the command line

The Hiero CLI is a command-line tool for Hedera operations: creating accounts, transferring HBAR, managing tokens, deploying contracts, and more. The key insight for this hackathon is that AI coding agents can use the CLI directly. Tools like OpenClaw, Claude Code, and Codex can invoke `hcli` commands as part of their workflows, giving your agent a simple, scriptable interface to the Hedera network without needing to integrate an SDK programmatically.

This makes the Hiero CLI a powerful building block for agentic architectures where the agent itself orchestrates on-chain actions via the terminal.

### What / Link

- Hiero CLI GitHub: <http://github.com/hiero-ledger/hiero-cli>

Install: `npm install -g @hiero/cli` then run `hcli --help`

### Example — an AI agent could run commands like

```text
hcli account create --balance 100000000 --name myaccount
hcli account balance --account myaccount
hcli hbar transfer --to 0.0.123456 --amount 10
```

> Header link shown in source PDF: [hedera.com](http://hedera.com). The source PDF also visibly shows the word `Shell` at the top of this page.

---

## Page 6

### Hedera Agent Skills — accelerate your build

The Hedera Agent Skills repo is a collection of ready-made skills and examples designed to help AI agents (and developers) get productive on Hedera quickly. Use these as starting points or reference implementations.

### What / Link

- Hedera Agent Skills: <http://github.com/hedera-dev/hedera-skills>

### Other useful resources

### What / Link

- Hedera Developer Playground — write and run JS/Java code in the browser against testnet: <http://portal.hedera.com/playground>
- Hedera SDK docs — full reference for JS, Java, Go SDKs: <http://docs.hedera.com/%E2%80%A6/sdk-developers>
- Tutorials — step-by-step guides for HBAR transfers, token creation, HCS topics: <http://docs.hedera.com/%E2%80%A6/tutorials>
- Start Building page — curated starting points: <http://hedera.com/start-building>
- Hedera Discord — ask questions in the developer-help-desk channel: <http://discord.gg/DNx3r3CW>

> Header link shown in source PDF: [hedera.com](http://hedera.com)

---

## Page 7

### Key concepts in 60 seconds

If you're new to Hedera, here's the minimum you need to know:

- HBAR is the native cryptocurrency. You use it to pay transaction fees (fractions of a cent each).
- Hedera Token Service (HTS) lets you create fungible and non-fungible tokens natively, no smart contracts needed.
- Hedera Consensus Service (HCS) is a tamper-proof, ordered message log. Great for audit trails and agent-to-agent coordination.
- Accounts are on-ledger entities identified by an Account ID (e.g. 0.0.123456). You create them via the SDK or CLI.
- Transactions are fast (~3–5 seconds to finality), cheap (fixed USD fees), and final (no forks, no rollbacks).
- Testnet is free to use and behaves identically to mainnet.

### Judging and submission

- Submit your project by 10:00 am Sunday.
- Demos run 10:30 am – 12:00 pm, winner announced at 12:00 pm.
- Judging criteria TBC — will be shared at hackathon kick-off.

Good luck and happy hacking! 🚀

> Header link shown in source PDF: [hedera.com](http://hedera.com)

---

## Page 8

### About Hedera

As the trust layer of the digital economy, Hedera empowers builders to create real-world impact. Hedera stands apart as the only public network governed by some of the world’s most respected institutions. Built for speed, security, and scalability, Hedera provides a trusted platform for decentralized applications across highly regulated industries such as finance, supply chain, energy, healthcare, and government.

Its open-source network combines high-throughput technology, fixed low-cost fees, and real-time transaction ordering, delivering predictable performance and fairness without compromising compliance. With a thriving ecosystem and strong developer tools, Hedera is driving innovation in tokenization, AI, and sustainable finance.

For more information, visit [hedera.com](http://hedera.com), or follow us on [X](https://x.com/hedera) and [LinkedIn](https://www.linkedin.com/company/hedera-network/posts/?feedView=all). The Hedera whitepaper can be found at [hedera.com/knowledge-center/](https://hedera.com/knowledge-center/).

> Header link shown in source PDF: [hedera.com](http://hedera.com)

---
