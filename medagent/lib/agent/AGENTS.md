<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# agent

## Purpose
LangGraph-based agent workflow for processing emergency medical access requests. Implements the supervisor pattern: a central orchestrator delegates to specialized agents and tools, with deterministic policy enforcement at every decision point.

## Key Files

| File | Description |
|------|-------------|
| `supervisor.ts` | LangGraph supervisor — defines the workflow graph, node routing, and state transitions |
| `medagent.ts` | Public API entry point — `runMedAgentWorkflow()` and resume helpers |
| `state.ts` | Workflow state definition — typed state channels for the LangGraph graph |
| `prompts.ts` | System and agent prompts for LLM calls |
| `traceHelpers.ts` | Workflow trace formatting for the UI trace viewer |
| `fileCheckpointSaver.ts` | Local file-based checkpoint persistence for pause/resume flows |
| `legacySupervisorTypes.ts` | Backward-compatible type exports |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `agents/` | Specialized sub-agents (audit, consent, evidence review, synthesis, etc.) (see `agents/AGENTS.md`) |
| `policy/` | Deterministic policy engine — tier decisions, evidence filtering, token issuance (see `policy/AGENTS.md`) |
| `retrieval/` | Retrieval pipeline — lexical search, semantic reranking, query normalization (see `retrieval/AGENTS.md`) |
| `tools/` | LangGraph tool definitions — verify, fetch, translate, audit, approve (see `tools/AGENTS.md`) |
| `__tests__/` | Agent-level tests (adversarial workflow, retrieval planner cache) |

## For AI Agents

### Working In This Directory
- The supervisor graph in `supervisor.ts` is the central orchestration point
- Policy decisions are **deterministic** (in `policy/`) — never use LLM output for access control
- `medagent.ts` is the public API surface — routes and scripts import from here
- Workflow state flows through typed LangGraph channels defined in `state.ts`
- Checkpoint persistence enables pause/resume across process restarts

### Testing Requirements
- `npm run test` covers unit tests in `__tests__/`
- `npm run test:agent` runs the full workflow integration test
- `../../tests/agent/workflow.invariants.test.ts` tests critical safety invariants

### Common Patterns
- Supervisor delegates to sub-agents via LangGraph node routing
- Tools are thin wrappers that call into `policy/` and `retrieval/`
- All LLM calls are post-authorization — the model never sees data before policy approval

## Dependencies

### Internal
- `../rag/` — Retrieval indexing and caching
- `../solana/` — On-chain audit writes
- `../db.ts` — Patient and request data
- `../crypto.ts` — Hash generation for audit events

### External
- `@langchain/langgraph` — Workflow graph engine
- `@langchain/openai` — LLM provider
- `@langchain/core` — Base abstractions

<!-- MANUAL: -->
