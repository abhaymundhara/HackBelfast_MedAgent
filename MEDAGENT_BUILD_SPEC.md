# MedAgent — Implementation Spec for Coding Agent

You are building **MedAgent**: an AI agent that grants **tiered, time-boxed, cryptographically auditable access** to a traveller's emergency medical summary.

This version is intentionally simplified for the hackathon:

* **3 tiers only**
* **Barcelona clinic demo as the main happy path**
* **Tier 1 = verified clinician**
* **Tier 2 = clinician could not be strongly verified, so the patient approves via push/email**
* **Tier 3 = break-glass / patient unconscious, so only limited life-saving info is shown**

Ruthlessly prioritise a working end-to-end demo over completeness.

**Do not scope-creep.**
**Do not put PHI on-chain.** Only hashes, access decisions, and audit events go to Hedera Consensus Service (HCS).
Stop and ask the user before deviating from this spec.

---

## 0. Judge-Max Build Rules

This spec is rewritten to maximise the scoring ceiling across the Hedera hackathon marking criteria, while keeping the MVP buildable in hackathon time.

If a judge cannot see evidence for a criterion in the demo, README, or repo docs, assume it does not count.

Prioritise these score levers in this order:

1. **Execution (20%)**
   Build a frictionless demo with obvious tier differences, strong UI clarity, and no terminal dependency.
2. **Success (20%)**
   Make Hedera network impact visible: topics created, messages submitted, mirror-node visibility, and projected account / audit activity at scale.
3. **Integration (15%)**
   Make Hedera core to the trust story, not an afterthought. HCS must power the audit trail, mirror-node data must power the auditor page, and HashScan links must be shown in setup/demo.
4. **Validation (15%)**
   Capture external feedback from at least 5 non-team people, show at least 2 feedback cycles, and record at least 1 soft partner / pilot signal in the repo.
5. **Pitch (10%)**
   Make the problem, why Hedera, why this is agentic, and network impact easy to explain in under 2 minutes.
6. **Innovation (10%)**
   Frame MedAgent as an AI-native, cross-border emergency access layer that is unusual on Hedera and stronger because it uses Hedera for neutral trust, not generic storage.
7. **Feasibility (10%)**
   Include a narrow beachhead, buyer story, market sizing, and Lean Canvas so the project feels commercially credible rather than just technically interesting.

Non-negotiable implementation rules:

* HCS logging is mandatory for **every grant and every denial**
* auditor view must use **mirror node data**, not local DB
* the UI must make the difference between Tier 1, Tier 2, and Tier 3 visually obvious
* the demo must show at least one HashScan URL and one mirror-node readback
* the clinician experience must visibly be **agentic**, not a static form flow
* the repo must include short written assets for pitch, validation, network impact, feasibility, and market evidence

### 0.1 Judge Evidence Map

Every section of the rubric needs explicit proof:

| Criterion | What judges need to see | Required evidence in this plan |
| --- | --- | --- |
| **Innovation** | this is not a generic chatbot or medical dashboard | AI access-control agent, cross-border emergency use case, HCS used as neutral trust substrate, competitive landscape note |
| **Feasibility** | believable business and product logic | narrow beachhead, buyer persona, Lean Canvas, Web3-vs-Web2 rationale, roadmap |
| **Execution** | working, polished, end-to-end product | no-terminal demo, stable happy paths, denial path, screenshots, tests, UX clarity |
| **Integration** | Hedera is fundamental, not decorative | patient / issuer Hedera identities, HCS topic logging, mirror-node auditor view, HashScan links, hedera-agent-kit |
| **Validation** | outsiders tested this and influenced it | interview notes, feedback cycles, changes made, soft pilot interest |
| **Success** | credible Hedera growth story | account creation, topic/message counts, MAA/TPS model, new audience exposure |
| **Pitch** | clear, exciting, evidence-backed story | 90-second script, cited market/problem numbers, Q&A sheet, architecture diagram |

### 0.2 AI / Agentic Track Alignment

This project must read and demo as an **AI agent product**, not just a rules engine with a chat box.

The agentic element is mandatory and must be visible:

* clinician starts with a natural-language request or guided chat, not only a plain form submit
* MedAgent autonomously chooses and executes the tool sequence needed for that case
* MedAgent branches between grant, approval request, break-glass, denial, translation, and audit logging based on tool results
* MedAgent produces a human-readable decision justification and clinician brief
* Tier 2 is a clear human-in-the-loop workflow
* the UI must show an `Agent action trace` or `Decision trace` so judges can see the system behaving like an agent

The deterministic rule layer still controls trust boundaries.
The agent is responsible for orchestration, adaptation, explanation, localisation, and logging discipline.

---

## 1. What you are building (MVP)

A web app with three surfaces:

1. **Patient app** (mobile-first web page)
   Patient registers, creates an emergency medical summary, chooses what can be shared, enables/disables auto emergency access, and can receive live approval requests.

2. **Clinician app** (web page)
   Doctor selects a demo identity, enters/scans a patient ID or QR, chats with MedAgent, and receives a time-boxed view of the permitted emergency summary.

3. **Auditor view** (read-only page)
   Shows the live HCS audit log for any patient: who requested access, what tier was used, what fields were released, the hash of the released data, consensus timestamp, sequence number, and a HashScan link.

The **MedAgent** itself is a LangChain agent that:

* verifies whether the clinician is strongly recognised or not
* decides the trust tier using rules first
* checks the patient's policy
* requests patient approval for Tier 2
* decrypts and assembles the correct subset of the medical summary
* translates medical content into the clinician's language
* creates a clinician-ready emergency brief from the authorised subset
* issues a time-boxed session token
* logs the entire decision to a per-patient HCS topic

For judging purposes, MedAgent must be demonstrably autonomous:

* it must run as a multi-step tool-using workflow, not a single API handler with AI text bolted on
* at least one screen must expose the agent's steps, tools used, and final justification
* the clinician must be able to ask follow-up questions about the released data inside the session, limited to the allowed fields only

---

## 2. The three tiers (implement exactly these)

| Tier                              | Who                                                                                 | Auto-access?                                                                                         | TTL    | Fields released                                                                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Verified clinician**        | Recognised clinician from a trusted demo issuer, e.g. **Hospital Clinic Barcelona** | Yes, if patient pre-authorised emergency auto-access                                                 | 30 min | Full emergency summary: allergies, meds, conditions, alerts, emergency contact, recent discharge summary, patient-approved emergency docs                                 |
| **2 — Patient-authorised access** | Clinician could not be strongly verified                                            | No — patient must approve via push notification or email code sent to the email used at registration | 15 min | Limited emergency summary: allergies, meds, key conditions, key alerts, emergency contact, optionally patient-marked shareable docs                                       |
| **3 — Break-glass / unconscious** | Patient cannot respond, emergency access needed immediately                         | Yes, narrow view only                                                                                | 20 min | Critical-only data: allergies, critical meds, major conditions, implants / critical alerts, emergency contact. **No discharge summary, no documents, no broader history** |

### Important distinction

* **Tier 1** = trusted clinician, broad emergency summary
* **Tier 2** = patient-approved clinician, reduced emergency summary
* **Tier 3** = unconscious patient, smallest life-saving dataset only

The tier must be decided by a **deterministic rule layer first**.
The LLM may only:

* explain ambiguous cases
* translate medical terms
* write a human-readable justification for the audit log

---

## 3. How patient upload works

The patient does **not** upload their full lifelong NHS record.

They create a **portable emergency summary** during registration.

### Required fields

* full name
* DOB
* sex
* home country
* languages
* allergies
* current medications
* major conditions
* key alerts
* emergency contact

### Optional fields

* blood type
* recent discharge summary
* selected supporting docs
* discharge letter
* medication list
* allergy letter
* implant card
* pregnancy note

### Patient policy

```ts
{
  emergencyAutoAccess: boolean,          // allows Tier 1 auto-access
  allowPatientApprovalRequests: boolean, // allows Tier 2 live approval
  breakGlassAllowed: boolean,            // allows Tier 3 emergency release
  shareableDocumentIds: string[],        // docs allowed for Tier 1/2
}
```

### Registration flow

1. patient creates profile with passphrase + email
2. app creates a **Hedera-backed MedAgent identity** for the patient in demo mode
3. patient fills emergency summary form
4. patient optionally uploads 0–3 supporting docs
5. patient sets sharing policy
6. data is encrypted at rest
7. patient gets a QR code / patient ID for emergency lookup, linked to their MedAgent Hedera identity

---

## 4. Architecture

```text
┌────────────────┐         ┌────────────────────────────┐
│  Patient App   │────────▶│  Next.js App + API Routes  │
│  (mobile web)  │         │  - Encrypts summary at rest│
└────────────────┘         │  - Stores ciphertext in    │
                           │    SQLite                  │
┌────────────────┐         │  - Hosts MedAgent          │
│ Clinician App  │────────▶│  - Sends approval emails   │
│   (web)        │         │    / push mocks for Tier 2 │
└────────────────┘         └──────────┬─────────────────┘
                                      │
                                      ▼
┌────────────────┐         ┌────────────────────────────┐
│  Auditor View  │────────▶│     MedAgent (LangChain)   │
│   (web)        │         │  - hedera-agent-kit        │
└────────────────┘         │  - gpt-4o-mini             │
                           │  - Custom tools:           │
                           │    verifyRequester()       │
                           │    decideTier()            │
                           │    requestPatientApproval()│
                           │    fetchSummary()          │
                           │    translateTerms()        │
                           │    issueSessionToken()     │
                           │    logToHCS()              │
                           └──────────┬─────────────────┘
                                      │
                                      ▼
                           ┌────────────────────────────┐
                           │      Hedera Testnet        │
                           │  - demo patient accounts   │
                           │  - demo issuer accounts    │
                           │  - HCS topic per patient   │
                           │    for audit logs          │
                           │  - HCS topic for trusted   │
                           │    issuer registry         │
                           │  - Mirror node query path  │
                           │    for auditor UI          │
                           └────────────────────────────┘
```

**Critical rule:** PHI never goes on-chain.
Only:

* SHA-256 hash of released payload
* tier
* requester identity
* timestamp
* decision
* justification
* session metadata

go to HCS.

### Why Hedera is essential

This must be clear in the code, docs, and pitch:

* emergency access is a **cross-border trust problem**, not just a database problem
* patient, clinic, auditor, travel insurer, and family may not trust one central vendor log
* HCS provides an **ordered, timestamped, tamper-evident audit trail**
* mirror nodes let auditors independently verify access events without trusting the app database
* HashScan links make the audit trail visible during the demo
* PHI stays off-chain, so Hedera is used for **verifiable trust and transparency**, not storage

### Why this is genuinely agentic

This must also be clear in the code, docs, and pitch:

* the problem is not only storing records, it is **deciding and executing safe emergency access under uncertainty**
* the system must gather requester context, apply rules, escalate to HITL approval when needed, localise output, and prepare a clinician-ready answer
* the agent must use tools and branch between workflows rather than return a single static response
* judges should be able to see the tool sequence, decision state, and final explanation
* the agent is bounded by deterministic guardrails so autonomy improves usability without weakening safety

### Hedera network impact story

The project must explicitly present how it affects Hedera metrics:

* each patient gets a demo Hedera identity at registration
* each trusted issuer persona has a Hedera identity
* each patient gets a dedicated audit topic
* each access decision creates an HCS audit event
* denial events also create HCS audit events
* the trusted issuer registry is anchored in a Hedera topic
* at scale, hospitals / insurers / travel-assistance providers can independently monitor or submit to the same shared audit fabric

For the MVP submission assets, include these estimates:

* **Demo footprint**: number of accounts created, number of topics created, number of HCS messages created by the 3-tier demo, number of mirror-node reads
* **Scale model**: simple projection for 1k travellers and 100 daily emergency lookups, including account creation, monthly active accounts, and daily HCS writes
* **Audience expansion**: travellers, clinics, insurers, and medical auditors as new Hedera-adjacent users

---

## 5. Tech stack (locked — do not substitute)

* **Frontend / backend:** Next.js 14 App Router + API routes
* **UI:** Tailwind + shadcn/ui
* **Agent:** `hedera-agent-kit`, `@langchain/openai`, `@langchain/langgraph`
* **Model:** `gpt-4o-mini`
* **Storage:** SQLite via `better-sqlite3`
* **Crypto:** Node `crypto`, AES-256-GCM
* **Hedera:** testnet only via `@hashgraph/sdk`
* **QR:** `qrcode`, `html5-qrcode`
* **Validation:** `zod`
* **Session token:** signed JWT or simple HMAC token

Install:

```bash
npx create-next-app@latest medagent --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd medagent
npm install hedera-agent-kit @langchain/core @langchain/openai @langchain/langgraph langchain @hashgraph/sdk dotenv better-sqlite3 qrcode html5-qrcode zod jsonwebtoken
npm install -D @types/better-sqlite3 @types/qrcode @types/jsonwebtoken
npx shadcn@latest init -d
npx shadcn@latest add button card input textarea badge dialog tabs toast switch
```

`.env.local`

```env
OPERATOR_ID=0.0.xxxxx
OPERATOR_KEY=302e0201...
OPENAI_API_KEY=sk-...
HEDERA_NETWORK=testnet
ENCRYPTION_PEPPER=<random-32-bytes-hex>
JWT_SECRET=<random-32-bytes-hex>
MIRROR_NODE_BASE_URL=https://testnet.mirrornode.hedera.com
```

---

## 6. File structure

```text
medagent/
├── app/
│   ├── page.tsx
│   ├── patient/
│   │   ├── page.tsx
│   │   └── dashboard/page.tsx
│   ├── clinician/
│   │   ├── page.tsx
│   │   └── session/[id]/page.tsx
│   ├── audit/
│   │   └── [patientId]/page.tsx
│   └── api/
│       ├── patients/route.ts
│       ├── patients/[id]/route.ts
│       ├── access/request/route.ts
│       ├── access/approve/route.ts
│       ├── audit/[patientId]/route.ts
│       └── demo/send-approval/route.ts
├── lib/
│   ├── hedera/
│   │   ├── client.ts
│   │   ├── topics.ts
│   │   ├── mirror.ts
│   │   └── registry.ts
│   ├── agent/
│   │   ├── medagent.ts
│   │   └── tools/
│   │       ├── verifyRequester.ts
│   │       ├── decideTier.ts
│   │       ├── requestPatientApproval.ts
│   │       ├── fetchSummary.ts
│   │       ├── translateTerms.ts
│   │       ├── issueSessionToken.ts
│   │       └── logToHCS.ts
│   ├── crypto.ts
│   ├── db.ts
│   └── ips/
│       ├── schema.ts
│       └── seed.ts
├── docs/
│   ├── demo-script.md
│   ├── market-feedback.md
│   ├── network-impact.md
│   └── pitch-outline.md
└── scripts/
    ├── setup-hedera.ts
    ├── seed-demo.ts
    ├── test-agent.ts
    └── demo-reset.ts
```

---

## 7. Data model

### Emergency summary schema

```ts
export const EmergencySummary = z.object({
  patientId: z.string(),
  demographics: z.object({
    name: z.string(),
    dob: z.string(),
    sex: z.enum(["male", "female", "other"]),
    bloodType: z.string().optional(),
    languages: z.array(z.string()),
    homeCountry: z.string(),
    email: z.string().email(),
  }),
  allergies: z.array(z.object({
    substance: z.string(),
    severity: z.enum(["mild", "moderate", "severe", "life-threatening"]),
    reaction: z.string().optional(),
  })),
  medications: z.array(z.object({
    name: z.string(),
    dose: z.string(),
    frequency: z.string(),
    critical: z.boolean().default(false),
  })),
  conditions: z.array(z.object({
    label: z.string(),
    major: z.boolean().default(false),
  })),
  alerts: z.array(z.enum([
    "pregnancy",
    "epilepsy",
    "diabetes",
    "anticoagulants",
    "implanted-device",
    "DNR",
    "immunocompromised"
  ])),
  emergencyContact: z.object({
    name: z.string(),
    relation: z.string(),
    phone: z.string(),
  }),
  recentDischarge: z.string().optional(),
  documents: z.array(z.object({
    id: z.string(),
    title: z.string(),
    patientApprovedForTier1Or2: z.boolean(),
  })).optional(),
});
```

### HCS audit message format

```json
{
  "v": 1,
  "ts": "2026-04-12T08:14:22Z",
  "patientHash": "sha256:abcd...",
  "requesterId": "did:hedera:testnet:0.0.4567_demo",
  "requesterLabel": "Dr. Garcia",
  "issuerLabel": "Hospital Clinic Barcelona",
  "tier": 1,
  "decision": "granted",
  "ttlSeconds": 1800,
  "fieldsHash": "sha256:efgh...",
  "fieldsReleased": ["allergies", "medications", "conditions", "alerts", "emergencyContact"],
  "justification": "Verified clinician from trusted Barcelona clinic. Patient enabled emergency auto-access. Tier 1 granted.",
  "sessionId": "uuid"
}
```

Audit message fields that must be visible in the auditor page:

* topic ID
* sequence number
* consensus timestamp
* decision
* tier
* requester label
* issuer label
* fields released
* fields hash
* HashScan link

---

## 8. Exact tier logic

### Tier 1 — Verified clinician

Grant Tier 1 only if all of these are true:

* requester is recognised as a trusted demo clinician
* issuer matches trusted registry entry
* patient has `emergencyAutoAccess = true`
* not using break-glass

Demo example:

* **Dr. Garcia**
* issuer: **Hospital Clinic Barcelona**
* trusted registry says this issuer is `verified`

Released fields:

* allergies
* medications
* conditions
* alerts
* emergencyContact
* recentDischarge
* patient-approved docs

TTL: **30 min**

---

### Tier 2 — Patient-authorised access

Use Tier 2 if:

* requester could not be strongly verified
* patient approval is possible
* patient approves request via push/email code to the email used at registration

Released fields:

* allergies
* medications
* key conditions
* key alerts
* emergencyContact
* optionally docs marked shareable for Tier 1/2

Do **not** include by default:

* recentDischarge
* all documents
* broad history

TTL: **15 min**

Patient approval can be mocked in the demo as:

* clicking `Approve` in the patient UI
* or entering a one-time code sent to registered email

---

### Tier 3 — Break-glass / unconscious

Use Tier 3 if:

* patient cannot respond
* emergency mode is triggered
* patient policy allows break-glass

Released fields:

* allergies
* critical meds only
* major conditions only
* implants / critical alerts
* emergencyContact

Do **not** include:

* recentDischarge
* documents
* non-critical meds
* broader history

TTL: **20 min**

### Denials

If access is denied for any reason:

* no summary data is released
* no session token is issued
* the denial is still logged to HCS with reason and requester metadata

---

## 9. What information differs between tiers

### Tier 1 — Full emergency summary

* allergies
* all current meds
* conditions
* alerts
* emergency contact
* recent discharge summary
* shareable emergency docs

### Tier 2 — Limited emergency summary

* allergies
* all current meds
* key conditions
* key alerts
* emergency contact
* optionally marked docs

### Tier 3 — Critical-only break-glass view

* allergies
* critical meds only, e.g. warfarin, insulin
* major conditions only, e.g. diabetes, epilepsy
* implants / anticoagulants / critical alerts
* emergency contact

This difference must be obvious in the UI.

UI requirements for clarity:

* tier badge at top of session
* `Released in this tier` list
* `Withheld in this tier` list
* expiry countdown
* glossary / translation panel for translated terms
* `Agent action trace` panel showing verification, tier decision, approval request, summary fetch, translation, token issuance, and HCS log status

---

## 10. Agent tools — exact contracts

```ts
// 1. verifyRequester
verifyRequester({ requesterId, presentedCredential }) =>
  {
    verified: boolean,
    issuerLabel: string,
    requesterLabel: string,
    reason: string
  }

// 2. decideTier
decideTier({
  verified,
  patientPolicy,
  patientApprovalPresent,
  emergencyMode
}) =>
  {
    tier: 1 | 2 | 3,
    ttlSeconds: number,
    fieldsAllowed: string[],
    justification: string
  }

// 3. requestPatientApproval
requestPatientApproval({
  patientId,
  requesterLabel,
  issuerLabel,
  requestedFields
}) =>
  {
    sent: boolean,
    method: "push" | "email",
    approvalToken?: string
  }

// 4. fetchSummary
fetchSummary({ patientId, fieldsAllowed }) =>
  {
    summarySubset: object,
    fieldsHash: string
  }

// 5. translateTerms
translateTerms({ summarySubset, targetLocale }) =>
  {
    translated: object,
    glossary: { original: string, translated: string }[]
  }

// 6. issueSessionToken
issueSessionToken({ requesterId, patientId, tier, fieldsAllowed, ttlSeconds }) =>
  {
    sessionId: string,
    jwt: string,
    expiresAt: string
  }

// 7. logToHCS
logToHCS({ patientTopicId, message }) =>
  {
    topicId: string,
    sequenceNumber: number,
    consensusTimestamp: string
  }
```

---

## 11. MedAgent system prompt

```text
You are MedAgent, an autonomous access-control agent for emergency medical data.

Your job is to decide whether and how much of a patient's emergency medical
summary a requester may see, then release exactly that subset and log the
decision.

You MUST follow this flow on every access request:
  1. Call verifyRequester.
  2. Call decideTier using the requester result, patient policy, approval state,
     and emergency mode.
  3. If tier is 1, proceed only if patient auto emergency access is enabled.
  4. If tier is 2, call requestPatientApproval unless approval is already present.
     If approval is denied or missing, deny access.
  5. If tier is 3, proceed only if break-glass is allowed.
  6. Call fetchSummary with ONLY the fields allowed for the chosen tier.
  7. Call translateTerms to localise to the clinician's language.
  8. Call issueSessionToken.
  9. Call logToHCS. This step is mandatory, even for denials.

You must never reveal fields beyond those authorised for the chosen tier.
You must never skip the HCS log.
You must explain your decision in plain language at the end.
```

### Agentic implementation rules

To count as an agentic product in the demo:

* use `@langchain/langgraph` to model the access flow as a graph or visibly tool-driven workflow
* show at least one live branch where the agent changes path based on tool output
* show at least one live HITL step where the agent waits for patient approval before continuing
* store a concise off-chain trace for the UI while writing the final decision record to HCS
* do not let the LLM decide the tier policy itself; the agent is orchestrating, not inventing access rules

---

## 12. Build phases (in order)

### Phase 1 — Foundations

1. Scaffold Next.js app, install deps, init shadcn.
2. Create Hedera testnet client, patient / issuer demo account creation helper, and smoke-test topic submission.
3. Build mirror-node fetch helper for reading topic messages.
4. Build SQLite DB and AES encryption helpers.
5. Build emergency summary schema and seed 3 demo patients plus Hedera-linked demo identities.
6. Build trusted issuer registry with one verified Barcelona clinic issuer.
7. Create `docs/pitch-outline.md`, `docs/network-impact.md`, `docs/market-feedback.md`, `docs/lean-canvas.md`, `docs/market-sizing.md`, `docs/competitive-landscape.md`, `docs/agentic-design.md`, and `docs/judge-evidence-matrix.md` as submission assets to fill during the build.

### Phase 2 — Agent core

1. Stub all tools and run a full mocked flow.
2. Implement `verifyRequester` and `decideTier`.
3. Implement `requestPatientApproval`.
4. Implement `fetchSummary`, `translateTerms`, `issueSessionToken`, `logToHCS`.
5. Implement an off-chain agent trace that can be rendered in the UI.
6. Add `test-agent.ts` that runs all 3 tiers plus at least one denial path.
7. Assert in tests that denials are logged to HCS too and that the allowed-field set differs correctly per tier.

### Phase 3 — UI

1. Patient registration + emergency summary form
2. Policy toggles
3. Clinician page with three personas and natural-language request input
4. Approval flow for Tier 2
5. Auditor page from mirror node, including consensus timestamp, sequence number, topic ID, and HashScan links
6. Session page polish: tier badge, expiry timer, fields released vs withheld, glossary, agent trace
7. Landing page polish: explain problem, why Hedera, and 3-tier model in plain language
8. Add a compact `Why this is agentic` explainer to the landing page or clinician flow
9. Add screenshots / GIF-ready states for the README and pitch assets

### Phase 4 — Demo prep

1. `demo-reset.ts`
2. Fill `docs/network-impact.md` with demo counts and one simple scale projection for accounts, MAA, and HCS writes
3. Gather at least 5 external feedback snippets across 3 stakeholder types and save them to `docs/market-feedback.md`
4. Capture a second feedback cycle with at least 2 follow-ups after improvements
5. Add one soft pilot / partner / advisor signal to `docs/market-feedback.md` or `docs/partner-notes.md`
6. Finalise `docs/pitch-outline.md`, `docs/demo-script.md`, `docs/lean-canvas.md`, and `docs/agentic-design.md`
7. Add cited problem / market numbers to `docs/market-sizing.md`
8. Fill `docs/judge-evidence-matrix.md` with one proof point per rubric criterion
9. Rehearse the 90-second flow plus a 3-minute Q&A version
10. Record backup video
11. Deploy to Vercel

---

## 13. Demo personas

Use exactly these three:

1. **Dr. Garcia**
   Issuer: **Hospital Clinic Barcelona**
   Result: **Tier 1**

2. **Dr. Patel**
   Unverified / generic clinic identity
   Patient receives approval request by push/email
   Result: **Tier 2**

3. **Emergency Doctor / Unknown Clinician**
   Patient unconscious, break-glass mode
   Result: **Tier 3**

---

## 14. Demo script (90 seconds)

> "Meet Sarah, a British tourist in Barcelona. She pre-registered with MedAgent before travelling. Her emergency summary is encrypted on our backend. She has a penicillin allergy and is taking warfarin.
>
> Sarah collapses. A doctor at Hospital Clinic Barcelona opens MedAgent and presents a recognised clinic credential.
>
> The agent verifies the requester, checks Sarah's policy, and grants Tier 1 access. The doctor sees the full emergency summary: allergies, medications, conditions, alerts, emergency contact, and recent discharge context. The medical terms are translated into Spanish for the clinician.
>
> Every decision is logged to Hedera Consensus Service. Here is the immutable audit trail, and here is the same event visible through the mirror node, with the consensus timestamp and HashScan link.
>
> Now take a weaker case. A clinician from an unverified clinic requests access. The system cannot strongly verify them, so it falls back to Tier 2. Sarah receives a push/email approval request and taps approve. The requester now gets only a limited emergency summary.
>
> Finally, if Sarah is unconscious and cannot approve, MedAgent can use Tier 3 break-glass access to reveal only the critical life-saving data: allergies, critical meds, major conditions, implants, and emergency contact.
>
> Hedera matters here because the audit trail is not just stored by our app. It is independently verifiable through HCS and mirror nodes without putting any medical data on-chain.
>
> MedAgent is a patient-controlled emergency access layer, built on Hedera with cryptographically auditable logs."

### Pitch emphasis

Always say these lines explicitly in the live demo:

* `PHI never goes on-chain`
* `Hedera is the shared trust and audit layer`
* `mirror nodes let auditors verify our app's decisions independently`
* `Tier 1, Tier 2, and Tier 3 release visibly different datasets`
* `this is an autonomous, tool-using medical access agent with human-in-the-loop safeguards`
* `the agent decides the workflow, while deterministic policy rules enforce safety boundaries`

---

## 15. Validation and GTM assets

These are required for maximising marks even though they are not product features.

### Validation

Capture short feedback from at least 5 external people:

* one clinician or medically trained person
* two frequent travellers or expats
* one privacy / compliance / health admin contact
* one travel insurer / travel-assistance / clinic operator / advisor if possible

Store in `docs/market-feedback.md`:

* who they are
* what problem resonated
* what they liked
* what they challenged
* one change you made based on feedback
* whether you followed up after the change

To push toward top validation marks:

* run at least 2 feedback cycles, not just one
* get at least 1 written statement of pilot interest, advisor support, or soft introduction to a potential deployment partner
* include timestamps so the feedback feels real and recent

### GTM and business framing

Keep the market story narrow and believable:

* beachhead: travel clinics, expat health services, and travel insurers
* initial user: traveller who pre-registers before travel
* buyer / partner story: travel-assistance companies, private clinic groups, insurers
* core value: faster emergency access with patient-controlled rules and independently auditable logs

Create these supporting docs:

* `docs/lean-canvas.md`
* `docs/market-sizing.md`
* `docs/competitive-landscape.md`
* `docs/partner-notes.md`

Each should be concise but concrete.

### Why Web3 instead of Web2

Use this framing:

* a normal SaaS audit log can be altered, disputed, or hidden by the operator
* emergency access across countries involves parties that may not share one system of record
* Hedera provides a neutral audit substrate for cross-institution access decisions
* the chain stores proofs and timestamps, not PHI

### Agentic proof asset

Create `docs/agentic-design.md` containing:

* the LangGraph or workflow diagram
* the exact tools used by MedAgent
* where human-in-the-loop enters the flow
* what the LLM is allowed to do vs what the deterministic rules control
* at least one example trace for Tier 1, Tier 2, Tier 3, and a denial

### Pitch proof assets

Create:

* `docs/demo-script.md`
* `docs/q-and-a.md`
* `docs/judge-evidence-matrix.md`

These should make it easy to answer why this is innovative, why Hedera is essential, why it is agentic, and how it can grow beyond the hackathon.

---

## 16. Scope discipline — do NOT build these

* ❌ real W3C VC cryptography
* ❌ real FHIR parsing
* ❌ full NHS integration
* ❌ native mobile app
* ❌ OAuth / full auth stack
* ❌ multilingual UI
* ❌ smart contracts / Solidity
* ❌ micropayments
* ❌ selective disclosure / ZK
* ❌ production-grade infra
* ❌ fake agentic UX where the agent does not actually use tools or branch workflows

Also do **not** add HTS, NFTs, or tokens unless the user explicitly asks.
For this project, a strong HCS + mirror-node + Hedera identity story is better than shallow use of multiple Hedera services.

---

## 17. Acceptance criteria

* [ ] `setup-hedera.ts` creates test topics and prints HashScan URLs
* [ ] demo patient and issuer Hedera identities are created or seeded successfully
* [ ] `test-agent.ts` runs all 3 tiers successfully plus at least one denial path
* [ ] denial flow is also logged to HCS
* [ ] HCS messages are visible through the mirror node
* [ ] auditor view uses mirror node data, not local DB
* [ ] auditor view shows topic ID, sequence number, consensus timestamp, and HashScan deep links
* [ ] Tier 1, Tier 2, and Tier 3 clearly show different released fields
* [ ] clinician session UI shows `released` and `withheld` fields for the chosen tier
* [ ] Tier 2 approval works through mocked push/email flow
* [ ] clinician flow shows a visible `Agent action trace`
* [ ] at least one live branch demonstrates the agent changing path based on tool output
* [ ] demo can run end-to-end without terminal interaction
* [ ] `docs/network-impact.md` contains demo counts and a simple scale projection for accounts, MAA, and HCS writes
* [ ] `docs/market-feedback.md` contains at least 5 external feedback notes and 2 feedback cycles
* [ ] `docs/lean-canvas.md` contains a credible business model
* [ ] `docs/market-sizing.md` contains cited problem / market numbers
* [ ] `docs/agentic-design.md` proves the product is genuinely agentic
* [ ] `docs/pitch-outline.md` explains problem, why Hedera, why agentic, network impact, and future path
* [ ] `docs/judge-evidence-matrix.md` maps every rubric criterion to evidence in the repo or demo

---

## 18. Submission checklist for highest marks

Before submitting, make sure the repo contains:

* a concise README with screenshots and architecture
* a clear explanation of **why Hedera is essential**
* a clear explanation of **why the product is truly agentic**
* a visible demo of mirror-node-backed audit verification
* a believable network impact section with account, MAA, and HCS-write numbers
* multiple pieces of external validation evidence
* a compact Lean Canvas and market-sizing note
* a judge-evidence matrix that makes scoring easy
* a polished 90-second pitch and backup video

If time is limited, prefer improving these over adding extra product features:

1. visible agent trace and clinician chat flow
2. mirror-node auditor page polish
3. clearer tier-difference UI
4. denial-path audit logging
5. pitch / network-impact / validation / market docs
6. demo stability and rehearsal

---

## 19. How to use this with Claude Code / Cursor / Codex

Paste this into a file called `MEDAGENT_BUILD_SPEC.md`, then start with:

```text
Read MEDAGENT_BUILD_SPEC.md. Confirm you understand the scope, the 3 trust tiers, the difference in released medical data at each tier, the agent tool contracts, the score-max priorities, the AI/agentic requirements, and the do-not-build list. Then begin Phase 1, step 1. Stop after each numbered step and show me what you've built before continuing.
```

If you want, this can also be turned into:

* a shorter Claude Code-optimised version
* a `HACKATHON-PRD.md` aligned to the judging rubric
* a judge-facing README / pitch outline
