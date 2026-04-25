<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# agents

## Purpose
Specialized sub-agents invoked by the LangGraph supervisor. Each agent handles a discrete step in the emergency access workflow — request understanding, verification, evidence review, medical synthesis, consent, and audit.

## Key Files

| File | Description |
|------|-------------|
| `requestUnderstanding.ts` | Interprets the clinician's natural-language request into structured intent |
| `verificationAgent.ts` | Verifies requester credentials and identity |
| `medicalAgent.ts` | Retrieves and structures authorized medical data |
| `evidenceReviewer.ts` | Reviews retrieved evidence for completeness and relevance |
| `medicalSynthesizer.ts` | Synthesizes a clinician-facing briefing from authorized fields |
| `consentAgent.ts` | Manages patient consent flow for Tier 2 requests |
| `auditAgent.ts` | Prepares and submits audit event payloads |
| `retrievalPlanner.ts` | Plans retrieval strategy (lexical, semantic, hybrid) based on query analysis |

## For AI Agents

### Working In This Directory
- Each agent is a LangGraph node — it receives workflow state and returns updated state
- Agents must never access data beyond what the policy engine has authorized
- The synthesizer and reviewer run only after policy approval
- Add new agents here and wire them into `../supervisor.ts`

<!-- MANUAL: -->
