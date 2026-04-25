# Network Impact

## Demo footprint

Assuming live Solana credentials are available and the seeded demo is run as designed:

- Demo identities created: 6
- 3 patient identities
- 3 demo issuer/requester identities
- Operator account used: 1 existing account
- Audit PDAs initialized: up to 3
- one PDA-backed audit log per patient when activity occurs
- Solana writes during setup/readiness: 1
- readiness transaction through the Anchor audit program
- Solana writes during the core demo: 4
- Tier 1 grant for `sarah-bennett`
- Tier 2 grant for `sarah-bennett` after approval
- Tier 3 break-glass grant for `sarah-bennett`
- Denial for `omar-haddad`
- Audit viewer reads during the core demo: 1 to 3
- At least one auditor page load for `sarah-bennett`
- Optional repeat load for denial proof and session confirmation

## Why this matters for judges

The project leaves a visible Solana footprint without forcing PHI on-chain:

- The registry anchor proves the trusted clinician list is chain-anchored.
- Each patient can map to a dedicated PDA-backed audit log, so access events are easy to isolate in the demo.
- Each decision creates a transaction signature and slot record that can be cross-linked to Solscan.

## Scale model

### 1,000 travelers onboarded

- Demo-style per-patient audit logs: up to 1,000 PDA-backed audit accounts
- Shared registry anchor: 1
- Total audit-account count: about 1,001
- Initial registry anchor writes: 1
- Onboarding Solana writes: 0
- Patient summaries and docs remain fully off-chain

### 100 daily emergency lookups

- Solana decision writes per day: about 100
- Audit viewer reads per day: about 100 to 300
- 1 read per auditor view
- additional reads for operational reconciliation or replay
- JWT sessions issued per day: up to 100, depending on granted requests

## Tradeoff

Per-patient PDA-backed audit logs are not the lowest-account-count design, but they are the clearest hackathon design:

- easier to explain
- easier to audit
- easier to verify on Solscan
- cleaner privacy separation between patients

In a production version, the write pattern could be optimized with batched event indexing or alternate account partitioning by tenant/region. For the hackathon MVP, one patient audit log per traveler is the right tradeoff.
