# Agentic Design

## Active Workflow

```text
Clinician request
  |
  v
deterministicEngine
  |
  +--> denied / awaiting_human --> auditAgent --> End
  |
  v
requestUnderstanding
  |
  v
retrievalPlanner
  |
  v
evidenceFilter
  |
  v
evidenceReviewer
  |------------------------------\
  | retry retrieval (max 2, 250ms -> 750ms backoff) \ proceed
  v                               v
retrievalPlanner              medicalSynthesizer
                                  |
                                  v
                              sessionIssuer
                                  |
                                  v
                               auditAgent
                                  |
                                  v
                                 End
```

## Runtime Nodes

- `deterministicEngine`
- `requestUnderstanding`
- `retrievalPlanner`
- `evidenceFilter`
- `evidenceReviewer`
- `medicalSynthesizer`
- `sessionIssuer`
- `auditAgent`

## Human-in-the-loop

The approval-required path inserts a pause inside deterministic policy evaluation and before any PHI subset is released.

- the workflow stops in an `awaiting_human` state
- the patient dashboard exposes the pending approval
- the approval route resumes the same request thread

## Why this is agentic

- The workflow is graph-based rather than a linear request handler.
- Branching depends on typed workflow state, retrieval evidence, and policy output.
- LLM use is bounded to request understanding, evidence review, and synthesis after access control.
- The trace is persisted and inspectable through the UI and local state stores.

## Bounded Retry Policy

- `evidenceReviewer -> retrievalPlanner` retries are bounded to `maxRetries=2`.
- Retry progression is deterministic: `balanced` (initial) -> `broad` (retry #1) -> `exact` (retry #2), then stop.
- Backoff is fixed and bounded (250ms before retry #1, 750ms before retry #2) to avoid hot-looping.
- When retries are exhausted or the gap is policy-blocked, flow does **not** loop back to retrieval; it routes to a safe terminal path:
  clarification/partial-answer handling in `medicalSynthesizer`, or deny/escalate-to-human behavior when policy requires.
