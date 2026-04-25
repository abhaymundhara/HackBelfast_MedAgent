# Pitch Outline

## Problem

Travelers can become emergency patients in places where the treating clinician cannot safely or quickly access the right medical context.

## Solution

MedAgent stores an encrypted emergency summary off-chain and uses an agentic access-control workflow to release only the right subset:

- Tier 1 for trusted clinicians
- Tier 2 with patient approval
- Tier 3 for break-glass emergencies
- denial when none of the valid paths apply

## Why Solana

- Solana gives ordered, timestamped, tamper-evident audit records
- Anchor-backed audit writes let the demo show live network evidence
- per-patient audit logs make the audit story easy to inspect
- PHI stays off-chain

## Why agentic

- the request begins as natural language
- the workflow branches based on tool output
- the Tier 2 path pauses for a human and then resumes
- the UI exposes the trace, not just the final answer

## Network impact

- 1 registry anchor
- up to 3 patient audit logs in the demo
- 4 Solana writes across the core access scenarios
- 1 or more audit log reads from the auditor page

## Future path

- richer clinician verification sources
- tenant-aware audit partitioning for higher scale
- stronger document packaging and care-team workflows
- integration with insurer or hospital coordination desks
