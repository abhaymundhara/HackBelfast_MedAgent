# MedAgent — Execution Prompt for Coding Agent

Use this prompt to implement MedAgent end-to-end.

This prompt is execution-ready and decision-complete. Do not reinterpret it as a brainstorming brief. Build the product described here in one pass, with normal progress updates, and do not stop after each numbered step unless you hit a real blocker.

If this prompt conflicts with earlier MedAgent planning notes, follow this file.

## 1. Objective

Build **MedAgent** as a fresh Next.js application in `medagent/` inside the current repository.

MedAgent is an **AI/agentic emergency medical access product** for the Hedera hackathon. It grants **tiered, time-boxed, cryptographically auditable access** to a traveler's emergency medical summary.

Optimize for:

* AI/agentic track fit first
* general Hedera judging rubric second
* demo stability
* visible Hedera integration
* visible agent autonomy
* judge-facing evidence assets in the repo

Do not rewrite the concept. Implement it.

## 2. Hard Constraints

Follow these exactly:

* Build a brand-new app in `medagent/`
* Use **Next.js 14 App Router** with TypeScript
* Use **Tailwind** and **shadcn/ui**
* Use **SQLite via `better-sqlite3`**, with raw SQL or lightweight direct queries only
* Use **Node `crypto`** with **AES-256-GCM** for encrypted-at-rest patient data
* Use **`@hashgraph/sdk`** for concrete Hedera testnet operations
* Use **`hedera-agent-kit`**, **`@langchain/openai`**, and **`@langchain/langgraph`** for the MedAgent layer
* Use **`gpt-4o-mini`** as the model
* Use **`zod`** for schema validation
* Use **JWT signed with `JWT_SECRET`** for session tokens
* Keep all PHI off-chain
* Put only hashes, access decisions, requester metadata, timestamps, and session metadata on HCS
* Use **mirror node data** for the auditor page, not local DB event history
* Keep scope narrow: **HCS + mirror node + demo Hedera identities only**

Do not add:

* HTS
* NFTs
* smart contracts / Solidity
* FHIR
* real W3C VC crypto
* OAuth
* a native mobile app
* multilingual UI chrome
* production infra
* fake agentic UX where no real tool-driven branching exists

## 3. Required Stack and Setup

Scaffold the app with these exact commands:

```bash
npx create-next-app@latest medagent --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd medagent
npm install hedera-agent-kit @langchain/core @langchain/openai @langchain/langgraph langchain @hashgraph/sdk dotenv better-sqlite3 qrcode html5-qrcode zod jsonwebtoken
npm install -D @types/better-sqlite3 @types/qrcode @types/jsonwebtoken vitest @vitest/coverage-v8 tsx
npx shadcn@latest init -d
npx shadcn@latest add button card input textarea badge dialog tabs toast switch table separator alert
```

Create `.env.local.example` and code against these environment variables:

```env
OPERATOR_ID=0.0.xxxxx
OPERATOR_KEY=302e0201...
OPENAI_API_KEY=sk-...
HEDERA_NETWORK=testnet
ENCRYPTION_PEPPER=<random-32-bytes-hex>
JWT_SECRET=<random-32-bytes-hex>
MIRROR_NODE_BASE_URL=https://testnet.mirrornode.hedera.com
APP_BASE_URL=http://localhost:3000
```

Implementation defaults:

* Build real Hedera integration code, not stubs
* If env vars are missing locally, keep the code runnable where possible and clearly isolate the live-network dependency behind config checks
* Do not remove or dilute live HCS integration because credentials might be absent at development time

## 4. Product Scope

Build three user surfaces:

1. **Patient app**
   Used for registration, summary entry, policy configuration, QR display, and Tier 2 approval responses.
2. **Clinician app**
   Used for persona selection, patient lookup, natural-language emergency request, and time-boxed viewing of the authorized emergency summary.
3. **Auditor view**
   Read-only mirror-node-backed view of HCS audit records for a patient.

The core product is the **MedAgent**. It must be visibly autonomous:

* the clinician starts with a natural-language request or guided chat
* MedAgent executes a multi-step tool-driven workflow
* MedAgent branches based on tool results
* Tier 2 pauses for human approval and then resumes
* the UI exposes an `Agent action trace`
* deterministic access rules remain outside the LLM

This is not a generic chatbot. It is an agentic access-control workflow with human-in-the-loop safeguards.

## 5. Exact 3-Tier Access Model

Implement exactly these tiers.

### Tier 1 — Verified clinician

Grant only if all are true:

* requester is recognized as a trusted demo clinician
* issuer matches trusted registry entry
* patient policy `emergencyAutoAccess` is `true`
* request is not using break-glass

TTL: `30 minutes`

Release:

* allergies
* all medications
* all conditions
* all alerts
* emergency contact
* recent discharge summary
* patient-approved docs

### Tier 2 — Patient-authorized access

Use only if all are true:

* requester could not be strongly verified
* patient approval is possible
* patient approval is received by mocked push or email-code flow

TTL: `15 minutes`

Release:

* allergies
* all medications
* key conditions only
* key alerts only
* emergency contact
* optionally patient-marked shareable docs

Do not release:

* recent discharge summary
* all documents by default
* broad history

### Tier 3 — Break-glass / unconscious

Use only if all are true:

* patient cannot respond
* emergency mode is triggered
* patient policy `breakGlassAllowed` is `true`

TTL: `20 minutes`

Release:

* allergies
* critical medications only
* major conditions only
* implants / critical alerts only
* emergency contact

Do not release:

* recent discharge summary
* documents
* non-critical medications
* broader history

### Denial path

Implement one explicit denial path and include it in tests and demo tooling.

If denied:

* release no summary data
* issue no session token
* still log the denial to HCS

## 6. Demo Personas and Demo Patients

Use these exact clinician personas:

1. `dr-garcia`
   Label: `Dr. Garcia`
   Issuer: `Hospital Clinic Barcelona`
   Locale: `es-ES`
   Result: Tier 1

2. `dr-patel`
   Label: `Dr. Patel`
   Issuer: `Generic City Clinic`
   Locale: `en-GB`
   Result: Tier 2

3. `unknown-emergency`
   Label: `Emergency Doctor / Unknown Clinician`
   Issuer: `Unverified Emergency Department`
   Locale: `es-ES`
   Result: Tier 3

Seed exactly these three patients:

1. `sarah-bennett`
   Primary demo patient
   UK traveler in Barcelona
   Penicillin allergy
   On warfarin
   Auto access enabled
   Patient approval enabled
   Break-glass enabled
   Has one recent discharge summary and two shareable docs

2. `omar-haddad`
   Denial-path patient
   Auto access disabled
   Patient approval disabled
   Break-glass disabled
   Used to prove denial behavior

3. `lucia-martin`
   Secondary patient for UI realism
   Has limited docs and different alert/condition mix

Assign each patient:

* a local app identity
* a demo Hedera identity
* a dedicated HCS topic for audit events

Assign each clinician persona:

* a stable requester ID
* a demo issuer ID
* a locale
* verification behavior in the trusted registry

## 7. Required File and Route Structure

Create this structure:

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
│   ├── types.ts
│   └── ips/
│       ├── schema.ts
│       └── seed.ts
├── docs/
│   ├── network-impact.md
│   ├── market-feedback.md
│   ├── lean-canvas.md
│   ├── market-sizing.md
│   ├── competitive-landscape.md
│   ├── agentic-design.md
│   ├── pitch-outline.md
│   ├── demo-script.md
│   ├── q-and-a.md
│   ├── judge-evidence-matrix.md
│   └── partner-notes.md
├── scripts/
│   ├── setup-hedera.ts
│   ├── seed-demo.ts
│   ├── test-agent.ts
│   └── demo-reset.ts
└── tests/
    ├── tier-logic.test.ts
    ├── field-filtering.test.ts
    ├── denial.test.ts
    └── hcs-payload.test.ts
```

Also create a repo-root `README.md` that explains:

* what MedAgent is
* why Hedera is essential
* why the product is genuinely agentic
* how to run the app
* where the app lives in the repo

## 8. Core Schemas and Interfaces

Use these exact schemas as the basis for the implementation.

### Emergency summary

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
  allergies: z.array(
    z.object({
      substance: z.string(),
      severity: z.enum(["mild", "moderate", "severe", "life-threatening"]),
      reaction: z.string().optional(),
    }),
  ),
  medications: z.array(
    z.object({
      name: z.string(),
      dose: z.string(),
      frequency: z.string(),
      critical: z.boolean().default(false),
    }),
  ),
  conditions: z.array(
    z.object({
      label: z.string(),
      major: z.boolean().default(false),
    }),
  ),
  alerts: z.array(
    z.enum([
      "pregnancy",
      "epilepsy",
      "diabetes",
      "anticoagulants",
      "implanted-device",
      "DNR",
      "immunocompromised",
    ]),
  ),
  emergencyContact: z.object({
    name: z.string(),
    relation: z.string(),
    phone: z.string(),
  }),
  recentDischarge: z.string().optional(),
  documents: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        patientApprovedForTier1Or2: z.boolean(),
      }),
    )
    .optional(),
});
```

### Patient policy

```ts
export const PatientPolicy = z.object({
  emergencyAutoAccess: z.boolean(),
  allowPatientApprovalRequests: z.boolean(),
  breakGlassAllowed: z.boolean(),
  shareableDocumentIds: z.array(z.string()),
});
```

### Agent trace

Add this explicit interface and persist it off-chain only:

```ts
export type AgentTraceStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_human";

export type AgentTraceTool =
  | "verifyRequester"
  | "decideTier"
  | "requestPatientApproval"
  | "fetchSummary"
  | "translateTerms"
  | "issueSessionToken"
  | "logToHCS";

export interface AgentTraceStep {
  order: number;
  tool: AgentTraceTool;
  status: AgentTraceStatus;
  summary: string;
  startedAt: string;
  completedAt?: string;
}

export interface AgentTrace {
  requestId: string;
  patientId: string;
  requesterId: string;
  finalDecision?: "granted" | "denied";
  steps: AgentTraceStep[];
}
```

### HCS audit message

Use this shape:

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
  "fieldsReleased": [
    "allergies",
    "medications",
    "conditions",
    "alerts",
    "emergencyContact"
  ],
  "justification": "Verified clinician from trusted Barcelona clinic. Patient enabled emergency auto-access. Tier 1 granted.",
  "sessionId": "uuid"
}
```

The auditor page must visibly show:

* topic ID
* sequence number
* consensus timestamp
* decision
* tier
* requester label
* issuer label
* fields released
* fields hash
* HashScan deep link

## 9. Required Database Model

Use SQLite with direct SQL. Do not add an ORM.

Create tables for at least:

* `patients`
* `patient_documents`
* `patient_policies`
* `issuer_registry`
* `access_requests`
* `approvals`
* `sessions`
* `agent_traces`

Store:

* encrypted medical summary blob in `patients`
* encrypted doc bytes or encrypted doc payload plus metadata in `patient_documents`
* policy as structured columns or JSON in `patient_policies`
* one row per access request in `access_requests`
* one row per approval attempt in `approvals`
* one row per session in `sessions`
* off-chain trace JSON in `agent_traces`

Do not put PHI in audit tables that are intended for mirror-node display.

## 10. Document Upload Policy

Implement supporting-doc upload as real file upload, but keep it simple.

Requirements:

* allow up to 3 uploaded supporting docs per patient
* accept PDFs, images, and plain text files
* encrypt doc payloads before persisting
* store encrypted bytes outside `public/`
* store metadata in SQLite
* no OCR
* no document parsing beyond title and type
* only expose a document when the selected tier authorizes it

## 11. App and API Behavior

Implement these app routes:

* `/`
  * landing page
  * explains the product, the 3 tiers, why Hedera matters, and why it is agentic
* `/patient`
  * registration form
  * summary creation form
  * upload docs
  * policy toggles
* `/patient/dashboard`
  * shows patient ID / QR
  * shows approval requests
  * allows Tier 2 approval
* `/clinician`
  * persona selector
  * patient lookup by ID
  * natural-language request box
  * emergency mode toggle
* `/clinician/session/[id]`
  * session summary
  * released vs withheld view
  * tier badge
  * expiry countdown
  * glossary panel
  * agent trace panel
  * follow-up chat restricted to authorized subset only
* `/audit/[patientId]`
  * mirror-node-backed audit timeline

Implement these API routes:

* `POST /api/patients`
  * create patient profile, encrypted summary, policy, docs, demo Hedera identity, and topic
* `GET /api/patients/[id]`
  * fetch patient-safe profile/dashboard data
* `POST /api/access/request`
  * start MedAgent workflow
  * create request row
  * run verification
  * decide tier
  * request approval if needed
  * issue session if granted
  * log decision to HCS
* `POST /api/access/approve`
  * record approval and resume pending Tier 2 access flow
* `GET /api/audit/[patientId]`
  * fetch and normalize mirror-node topic messages for auditor view
* `POST /api/demo/send-approval`
  * mocked push/email endpoint for the demo

## 12. MedAgent Tool Contracts

Implement these exact tool contracts:

```ts
verifyRequester({ requesterId, presentedCredential }) => {
  verified: boolean,
  issuerLabel: string,
  requesterLabel: string,
  reason: string
}

decideTier({
  verified,
  patientPolicy,
  patientApprovalPresent,
  emergencyMode
}) => {
  tier: 1 | 2 | 3,
  ttlSeconds: number,
  fieldsAllowed: string[],
  justification: string
}

requestPatientApproval({
  patientId,
  requesterLabel,
  issuerLabel,
  requestedFields
}) => {
  sent: boolean,
  method: "push" | "email",
  approvalToken?: string
}

fetchSummary({ patientId, fieldsAllowed }) => {
  summarySubset: object,
  fieldsHash: string
}

translateTerms({ summarySubset, targetLocale }) => {
  translated: object,
  glossary: { original: string, translated: string }[]
}

issueSessionToken({ requesterId, patientId, tier, fieldsAllowed, ttlSeconds }) => {
  sessionId: string,
  jwt: string,
  expiresAt: string
}

logToHCS({ patientTopicId, message }) => {
  topicId: string,
  sequenceNumber: number,
  consensusTimestamp: string
}
```

Also implement MedAgent orchestration in `lib/agent/medagent.ts` with LangGraph.

Use the following execution order on every access request:

1. `verifyRequester`
2. `decideTier`
3. if Tier 2 and approval missing, `requestPatientApproval` and pause
4. if granted, `fetchSummary`
5. `translateTerms`
6. create clinician-ready brief from authorized data only
7. `issueSessionToken`
8. `logToHCS`

Even denials must log to HCS.

Do not let the LLM decide the tier policy itself.

## 13. Verification and Tier Logic Defaults

Implement deterministic requester verification as follows:

* `dr-garcia` from `Hospital Clinic Barcelona` is verified
* all other clinician personas are not strongly verified

Implement locale defaults:

* `dr-garcia` -> `es-ES`
* `dr-patel` -> `en-GB`
* `unknown-emergency` -> `es-ES`

Implement field selection exactly:

* Tier 1 -> `allergies`, `medications`, `conditions`, `alerts`, `emergencyContact`, `recentDischarge`, approved docs
* Tier 2 -> `allergies`, `medications`, key conditions, key alerts, `emergencyContact`, shareable docs only
* Tier 3 -> `allergies`, critical medications only, major conditions only, implant and critical alerts only, `emergencyContact`

Use these defaults for tier filtering:

* key conditions = `major === true`
* key alerts = all alerts present
* critical alerts = `anticoagulants`, `implanted-device`, `DNR`, `epilepsy`, `diabetes`
* critical medications = medications where `critical === true`

## 14. Hedera Integration Requirements

Implement real testnet-compatible Hedera code for:

* creating demo patient identities
* creating demo issuer identities where needed for seed/demo tracking
* creating per-patient HCS topics
* writing audit events to HCS
* reading topic messages from mirror node

Implementation rules:

* use `@hashgraph/sdk` for topic creation and message submission
* use a helper in `lib/hedera/mirror.ts` for mirror-node reads
* generate HashScan links in the auditor UI and setup script
* anchor the trusted issuer registry in a dedicated Hedera topic as part of setup

Do not store PHI on Hedera.

## 15. Crypto Requirements

Implement AES-256-GCM helpers in `lib/crypto.ts`.

Requirements:

* derive a stable symmetric key using `ENCRYPTION_PEPPER`
* encrypt emergency summary payloads before storing
* encrypt uploaded document payloads before storing
* compute SHA-256 hashes for:
  * patient identity hash in HCS messages
  * released-field payload hash
* keep HCS payloads limited to metadata, hashes, and decisions

## 16. UI Requirements

The UI must make the three tiers visibly different.

On clinician session pages, show:

* tier badge
* requester identity
* issuer label
* translated emergency summary
* `Released in this tier`
* `Withheld in this tier`
* expiry countdown
* glossary panel
* `Agent action trace`
* HCS log status
* session token metadata

The `Agent action trace` must show at least:

* verification
* tier decision
* approval request
* summary fetch
* translation
* token issuance
* HCS log submission

The patient dashboard must show:

* patient ID
* QR code
* current policy settings
* incoming approval requests
* approve / deny controls for Tier 2

The auditor page must show:

* mirror-node-derived rows
* consensus timestamp
* topic ID
* sequence number
* request outcome
* fields released
* fields hash
* HashScan link

## 17. Agentic Behavior Requirements

This product must clearly qualify as agentic in the demo and code.

Therefore:

* use LangGraph or a visibly tool-driven graph to model the workflow
* make at least one branch depend on tool output
* make Tier 2 a clear human-in-the-loop pause/resume
* expose agent trace state in the UI
* allow follow-up clinician questions inside the session, but answer only from authorized fields
* include one concise clinician-ready brief generated from the authorized summary subset

The LLM is allowed to:

* translate terms
* produce a clinician-ready brief
* answer follow-up questions from authorized data only
* write plain-language decision justification

The LLM is not allowed to:

* widen the allowed dataset
* override deterministic tier logic
* skip audit logging

## 18. Required Scripts and Commands

Create npm scripts for at least:

* `dev`
* `build`
* `test`
* `test:agent`
* `seed:demo`
* `setup:hedera`
* `demo:reset`

Back them with:

* `scripts/setup-hedera.ts`
* `scripts/seed-demo.ts`
* `scripts/test-agent.ts`
* `scripts/demo-reset.ts`

Behavior:

* `setup-hedera.ts` creates topics and prints HashScan URLs
* `seed-demo.ts` seeds patients, policies, documents, identities, and trusted issuers
* `test-agent.ts` runs all 3 tiers plus denial and prints outcomes
* `demo-reset.ts` resets DB/demo state for rehearsals

## 19. Documentation Assets to Create

Create these docs during implementation, not as placeholders only:

* `docs/network-impact.md`
  * include demo counts for accounts, topics, HCS writes, and mirror reads
  * include a scale model for 1k travelers and 100 daily emergency lookups
* `docs/market-feedback.md`
  * include at least 5 external feedback notes across 2 feedback cycles
* `docs/lean-canvas.md`
  * include problem, users, UVP, solution, channels, costs, revenue, unfair advantage
* `docs/market-sizing.md`
  * include cited market/problem numbers
* `docs/competitive-landscape.md`
  * explain why this is not a generic medical records app or generic chatbot
* `docs/agentic-design.md`
  * include workflow diagram, tool list, HITL insertion point, and example traces for Tier 1, Tier 2, Tier 3, and denial
* `docs/pitch-outline.md`
  * include problem, why Hedera, why agentic, network impact, future path
* `docs/demo-script.md`
  * include a 90-second live demo script
* `docs/q-and-a.md`
  * include likely judge questions and crisp answers
* `docs/judge-evidence-matrix.md`
  * map each rubric criterion to concrete proof in the repo/demo
* `docs/partner-notes.md`
  * include at least one soft pilot, partner, advisor, or deployment-interest note if available

## 20. Testing Requirements

Use `vitest`.

Implement these tests:

### Unit tests

* deterministic tier decision matrix
* field filtering per tier
* denial path yields no released data and no session token
* HCS payload contains hashes only and no PHI values

### Integration script coverage

`scripts/test-agent.ts` must exercise:

* Tier 1 happy path
* Tier 2 approval path
* Tier 3 break-glass path
* denial path
* mirror-node readback normalization

### Manual/demo verification standards

The final app must make it obvious that:

* Tier 1, Tier 2, and Tier 3 release different datasets
* the agent is visibly doing work
* the auditor page is mirror-node-backed
* approval actually pauses and resumes the agent flow

## 21. Acceptance Criteria

All of these must be satisfied:

* `medagent/` exists and runs as a Next.js app
* `setup-hedera.ts` creates test topics and prints HashScan URLs
* demo patient and issuer Hedera identities are created or seeded successfully
* `test-agent.ts` runs all 3 tiers successfully plus at least one denial path
* denial flow is logged to HCS
* HCS messages are visible through mirror node reads
* auditor view uses mirror-node data, not local DB audit history
* auditor view shows topic ID, sequence number, consensus timestamp, and HashScan deep links
* Tier 1, Tier 2, and Tier 3 clearly show different released fields
* clinician session UI shows released and withheld fields
* Tier 2 approval works through mocked push/email flow
* clinician flow shows a visible `Agent action trace`
* at least one live branch demonstrates the agent changing path based on tool output
* the demo runs end-to-end without terminal interaction once seeded
* `docs/network-impact.md` contains demo counts and a scale projection
* `docs/market-feedback.md` contains at least 5 external feedback notes across 2 cycles
* `docs/lean-canvas.md` contains a credible business model
* `docs/market-sizing.md` contains cited problem / market numbers
* `docs/agentic-design.md` proves the product is genuinely agentic
* `docs/pitch-outline.md` explains problem, why Hedera, why agentic, network impact, and future path
* `docs/judge-evidence-matrix.md` maps every rubric criterion to evidence
* root `README.md` clearly explains how to run and judge the project

## 22. Final Execution Instructions

Implement the entire MVP in one pass.

While implementing:

* do not stop after each numbered phase
* do not ask to re-plan the product
* do not broaden scope
* do not replace Hedera integration with fake local-only logging
* do not weaken the agentic behavior into a static form workflow

At the end:

* run the relevant tests and scripts that are possible in the environment
* state what passed
* state what could not be fully verified due to missing env or live network constraints
* summarize the main files and user-facing outcomes

## 23. Paste-Ready Instruction

When feeding this back to a coding agent, use exactly this lead-in:

```text
Read MEDAGENT_IMPLEMENTATION_PROMPT.md and implement it fully. Build the app in medagent/ inside this repo. Do not stop after each phase. Keep the scope narrow, preserve the exact 3-tier access model, keep deterministic policy logic outside the LLM, make the agent behavior visible in the UI, use real HCS + mirror-node integration, create the required docs and tests, and verify as much as the current environment allows before finishing.
```
