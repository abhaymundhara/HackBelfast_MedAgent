okay # Q and A

## Why is this better than a normal patient portal?

Because the problem is not normal portal access. It is emergency access under uncertainty, across organizational boundaries, with limited time and a need for an auditable minimum dataset.

## Why use AI at all?

The AI is used where it adds value:

- translating authorized medical terms
- producing a concise clinician brief
- answering follow-up questions from the released subset only

It does not decide the access policy.

## Why Solana instead of a database log?

The product needs an externally verifiable audit trail. Solana provides ordered, timestamped, immutable records, and the auditor UI proves that by linking each event to a transaction signature and slot.

## Why keep PHI off-chain?

Because the chain is for evidence, not for sensitive medical content. MedAgent writes hashes and access decisions to Solana, while patient summaries and documents stay encrypted off-chain.

## Is Tier 3 too risky?

Tier 3 is intentionally narrow. It exposes only the critical subset needed when the patient cannot respond, and it still creates an auditable record.

## Is this really agentic?

Yes. The graph branches on tool output, Tier 2 pauses for human approval and resumes later, and the UI exposes the agent trace. This is operational agent behavior, not a themed chatbot.

## What happens on denial?

No summary data is released, no session token is issued, and the denial is still logged to Solana.
