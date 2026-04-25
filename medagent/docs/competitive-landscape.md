# Competitive Landscape

## What MedAgent is not

- not a full EHR replacement
- not a longitudinal medical records sync platform
- not a generic medical chatbot
- not an on-chain PHI product

## Positioning

MedAgent sits in a narrower lane: emergency access control for travelers. The product focus is not “all your health data everywhere.” The focus is “what is the minimum safe subset a clinician can access right now, for how long, and under what proof trail?”

## Comparison

### Against patient portals and records apps

- Patient portals assume the patient can log in and share.
- Cross-border portals often depend on full-system interoperability.
- MedAgent instead keeps a small, encrypted emergency packet ready for constrained release.

### Against generic AI medical assistants

- Generic assistants can summarize or answer questions, but they do not enforce access control or create tamper-evident audit logs by default.
- MedAgent uses AI for translation, briefing, and constrained follow-up, but deterministic tier logic and audit logging stay outside the model.

### Against traditional break-glass models

- Traditional break-glass access often implies broad release inside a single institution.
- MedAgent narrows the break-glass release to critical-only data and makes the decision portable and auditable via Solana.

## Advantage in a hackathon setting

- judges can see different data released by different tiers
- judges can see the agent branch and pause
- judges can inspect the Solana-backed auditor page
- judges can verify that PHI does not land on-chain
