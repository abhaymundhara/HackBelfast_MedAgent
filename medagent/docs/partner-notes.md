# Partner Notes

## Current status

There is no signed pilot or formal deployment commitment attached to this repo yet.

## Near-term partner fit

The strongest early conversations are still with operational teams that already handle cross-border urgency rather than full EHR modernization.

- hospital international patient offices in tourism-heavy cities
- travel insurance medical assistance desks
- corporate mobility or study-abroad programs responsible for medically higher-risk travelers

## Why these profiles fit first

- They already coordinate cross-border care handoffs.
- They care about narrow, fast, auditable information sharing.
- They do not need a full EHR replacement to see value.
- The demo can be positioned as an emergency packet workflow rather than a hospital-wide integration program.

## What the demo now proves for those conversations

- The product is explicitly scoped to emergency access, not longitudinal record sync.
- Tier 1, Tier 2, and Tier 3 show different release boundaries rather than a binary allow/deny model.
- The auditor view is Solana-backed and independently inspectable.
- The operator can run `npm run demo:readiness` before a meeting or judging session to confirm the live Solana path.

## What a real pilot would still need to validate

- Which clinician identity evidence is acceptable in practice for Tier 1 versus Tier 2.
- Whether patient approval latency is operationally acceptable in real emergency-adjacent workflows.
- Whether per-patient Solana accounts/PDAs remain the right partitioning model for a real operator (Solana partitions per-user state via program-owned accounts, often Program Derived Accounts, rather than HCS-style topics).
- Which buyer owns procurement first: hospital operations, insurer assistance desk, or traveler program sponsor.

## Conservative takeaway

This repo now supports a stronger first-partner narrative than before, but it still represents a demo-stage product. The honest story is:

- the wedge is clearer
- the Solana trust layer is more demonstrable
- the validation evidence is directional, not contractual
