# 90-Second Demo Script

## Preflight

Before the judged demo, run:

```bash
npm run demo:readiness
```

Expected result:

- credentials check passes
- RPC check passes
- Solana Anchor audit write is submitted

## 0:00 to 0:10

Open the landing page.

- “MedAgent is emergency medical access for travelers.”
- “This is not full-record sharing. It is tiered, time-boxed, auditable release of the minimum safe emergency subset.”
- If live Solana is configured, point to the status banner and mention the readiness check.

## 0:10 to 0:30

Open `/clinician`.

- Select `Dr. Garcia`.
- Choose `sarah-bennett`.
- Submit a request that mentions medication and allergy context.
- Explain that MedAgent verifies the requester, applies deterministic tier policy, and only then interprets the request focus.

## 0:30 to 0:48

Show the Tier 1 session.

- Point to the Tier 1 badge and countdown.
- Point to `Clinical intent` to show that the natural-language request affected emphasis.
- Point to `Verification basis` to show why Tier 1 was allowed.
- Point to `Released` versus `Withheld`.
- Point to `Workflow steps`.

## 0:48 to 1:05

Open `/patient/dashboard?patientId=sarah-bennett`.

- Explain that `Dr. Patel` is known but not trusted for Tier 1.
- Trigger the Tier 2 flow if needed.
- Show the pending approval and click `Approve`.
- Explain that the original request pauses and resumes on the same `requestId`.

## 1:05 to 1:20

Open the Tier 2 clinician session.

- Contrast it with Tier 1.
- Point out `Requested but withheld` if discharge or documents were requested.
- Highlight that the clinician request changed the focus panel and starter questions, but not the policy boundary.

## 1:20 to 1:30

Open `/audit/sarah-bennett`.

- Show timestamp, event type, slot, transaction signature, and the Solscan link.
- Example verifier URL: `https://solscan.io/tx/<signature>?cluster=devnet`
- Close with: “Solana is not decorative here. The audit view is backed by our Anchor audit program, and we verified live submission before the demo.”
