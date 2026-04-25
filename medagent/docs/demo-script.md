# MedAgent Demo Script (iMessage — Belfast 2036)

## Setup (~5 min)
1. On the Mac with Messages.app, run `npm run imessage:live` (single terminal command)
2. `npm run imessage:health` (expect `{ "healthy": true, ... }`)
3. `npm run imessage:smoke -- --chat 'iMessage;-;+447700900401' --text 'MedAgent online'`
4. `npm run demo:reset`
5. Open `http://localhost:3000/audit/sarah-bennett` on second screen

## Flow 1 — Tier 1 (HSE clinician, verified, same jurisdiction)
- iMessage from +353871000001 (Dr. Aoife Murphy, HSE)
- Send: "Need emergency access to patient SARAHB. RTA on the M1 outside Newry, GCS 13."
- Expect: Tier 1 grant with full critical info card
- Audit page: new row — Granted · Tier 1 · dr-murphy · HSE Ireland

## Flow 2 — Tier 2 (NHS NI clinician, cross-jurisdiction)
- iMessage from +447700900201 (Dr. Chidi Okonkwo, NHS NI)
- Send: "Patient SARAHB just walked into RVH A&E, suspected stroke, need full record."
- Expect: clinician gets "pending patient approval"
- Patient (+447700900401) receives approval prompt
- Patient replies YES
- Clinician receives Tier 2 grant
- Audit page: two rows (request opened, granted)

## Flow 3 — Tier 3 (break-glass, unverified)
- iMessage from unmapped handle
- Send: "BREAK GLASS — patient SARAHB unconscious, road traffic accident"
- Expect: Tier 3 break-glass grant, critical-only fields
- Audit page: Tier 3 · break-glass · unverified

## Flow 4 — Denial
- dr-okonkwo requests omar-haddad
- Expect: denial text with reason
- Audit page: Denied · reason logged

## Pitch Beat
"Every one of these accesses was logged on Solana. Any patient can verify exactly who opened their record, when, and under what authority. PHI never went on-chain — only hashes, decisions, and timestamps."
