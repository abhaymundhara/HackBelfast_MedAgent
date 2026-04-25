# iMessage Integration Flow

## Architecture
```
iMessage (Mac) → Local poller (chat.db) → Webhook POST → MedAgent Workflow → Messages.app bridge sendText → iMessage
```

## Sequence: Belfast appointment + full-record share
1. Patient onboards in iMessage and uploads a medical report PDF.
2. Patient texts a request such as "my knee injury is spiking in Belfast, book a doctor".
3. Webhook identifies the handle as an onboarded patient and classifies `appointment_search`.
4. MedAgent searches the demo NHS booking-management adapter for Belfast slots today/tomorrow.
5. Patient replies with a slot number, or sends a future date in `YYYY-MM-DD` format.
6. MedAgent books the selected slot and confirms doctor, clinic, and time.
7. MedAgent asks a separate consent question: share the full uploaded medical record with the named doctor?
8. If the patient replies YES, MedAgent creates a full-record share and returns the original `/share/{id}#token=...` doctor link.
9. The doctor opens the live share page. The page uses the fragment token to fetch summary fields and live document descriptors.
10. Patient can revoke future live access from the dashboard. Revocation does not erase data already viewed or downloaded.

The NHS booking integration is represented by deterministic seeded demo slots. Raw medical data remains off-chain; Solana receives audit metadata, hashes, expiry, scope, and revocation events only.

## Sequence: Tier 1 (Same-jurisdiction verified)
1. Clinician sends iMessage to MedAgent number
2. Local poller reads new row from `~/Library/Messages/chat.db`
3. Poller posts webhook event to `/api/imessage/webhook`
4. Webhook parses inbound, resolves handle → dr-murphy (HSE)
4. Classifies intent: freeform_clinician, patientHint=sarah-bennett
5. Sends ack: "MedAgent received your request, working..."
6. Calls `runAccessRequest({ patientId, requesterId, ... })`
7. deterministicEngine: verified + autoAccess + sameJurisdiction → Tier 1
8. Workflow completes → MedAgentOutcome
9. formatOutbound → Tier 1 grant text
10. bridge.sendText → clinician receives grant via iMessage
11. Audit event written to Solana

## Sequence: Tier 2 (Cross-jurisdiction, patient approval needed)
1. Clinician (NHS NI) sends iMessage
2. Webhook resolves handle → dr-okonkwo
3. deterministicEngine: verified + autoAccess + crossJurisdiction → awaiting_human
4. Clinician receives "pending patient approval" message
5. Patient receives approval prompt via iMessage
6. Patient replies YES
7. Local poller forwards patient's YES reply via webhook
8. Webhook: intent=approval, decision=approve
9. Calls `resumeApprovedRequest(requestId)`
10. Workflow resumes → Tier 2 grant
11. Clinician receives Tier 2 grant
12. Patient receives confirmation

## Sequence: Tier 3 (Break-glass)
1. Unknown clinician sends "BREAK GLASS — patient SARAHB unconscious"
2. Handle unmapped → unknown-emergency
3. emergencyMode=true detected from "BREAK GLASS"
4. deterministicEngine: breakGlassAllowed → Tier 3
5. Clinician receives critical-only fields

## Sequence: Denial
1. dr-okonkwo requests omar-haddad
2. Omar's policy: all access paths disabled
3. deterministicEngine → denied
4. Clinician receives denial text
5. Audit event still logged on Solana
