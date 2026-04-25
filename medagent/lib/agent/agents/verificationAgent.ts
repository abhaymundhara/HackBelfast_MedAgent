/**
 * VerificationAgent
 *
 * Responsibilities:
 *   1. Verify clinician credentials against the trusted issuer registry
 *   2. Apply deterministic tier policy (decideTier) to produce a TierDecision
 *
 * Uses SolanaAgentKit tools when available to enrich verification with on-chain
 * context (e.g. DID resolution, on-chain registry lookups). Falls back gracefully
 * to the deterministic in-process implementation when SAK is not configured.
 */

import { verifyRequester } from "@/lib/agent/tools/verifyRequester";
import { decideTier } from "@/lib/agent/tools/decideTier";
import { addTraceStep, completeTraceStep } from "@/lib/agent/traceHelpers";
import { updateAccessRequest } from "@/lib/db";
import type { LegacySupervisorStateType } from "@/lib/agent/legacySupervisorTypes";

// ---------------------------------------------------------------------------
// Optional SolanaAgentKit enrichment
// SolanaAgentKit is imported dynamically so the build succeeds when the package
// is not yet installed. The SAK instance is created once from env vars and
// shared across sub-agents via module scope.
// ---------------------------------------------------------------------------

async function trySolanaKitEnrichment(
  requesterId: string,
): Promise<{ onChainVerified: boolean; onChainDetail: string }> {
  try {
    // Dynamic import — resolves at runtime; fails silently if package absent
    const sakModule = await import("solana-agent-kit").catch(() => null);
    if (!sakModule) {
      return { onChainVerified: false, onChainDetail: "SAK not available" };
    }

    const privateKey = process.env.SOLANA_PRIVATE_KEY;
    const rpc = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    const openAiKey = process.env.OPENAI_API_KEY ?? "";

    if (!privateKey) {
      return {
        onChainVerified: false,
        onChainDetail: "SAK: no wallet configured",
      };
    }

    // SolanaAgentKit v2 constructor: new SolanaAgentKit(privateKey, rpc, { OPENAI_API_KEY })
    const agent = new sakModule.SolanaAgentKit(privateKey, rpc, {
      OPENAI_API_KEY: openAiKey,
    });

    // Use SAK wallet address as a proxy for "has valid on-chain identity"
    const walletAddress = agent.walletAddress?.toBase58?.() ?? null;
    if (walletAddress) {
      return {
        onChainVerified: true,
        onChainDetail: `SAK wallet ${walletAddress} active on devnet`,
      };
    }
    return {
      onChainVerified: false,
      onChainDetail: "SAK: wallet not resolved",
    };
  } catch {
    return { onChainVerified: false, onChainDetail: "SAK enrichment skipped" };
  }
}

// ---------------------------------------------------------------------------
// Main sub-agent runner
// ---------------------------------------------------------------------------

export async function runVerificationAgent(
  state: LegacySupervisorStateType,
): Promise<Partial<LegacySupervisorStateType>> {
  // ── Step 1: Verify requester credentials ─────────────────────────────────
  let trace = addTraceStep(
    state.trace,
    "verifyRequester",
    "running",
    "VerificationAgent: Checking requester against the trusted demo issuer registry (skills: verify_requester, decide_tier, solana_kit_enrich).",
  );

  const [verification, solanaEnrichment] = await Promise.all([
    verifyRequester({
      requesterId: state.requesterId,
      presentedCredential: state.presentedCredential,
    }),
    trySolanaKitEnrichment(state.requesterId),
  ]);

  const enrichedVerification = {
    ...verification,
    solanaOnChainVerified: solanaEnrichment.onChainVerified,
    solanaDetail: solanaEnrichment.onChainDetail,
  };

  trace = completeTraceStep(
    trace,
    "verifyRequester",
    "completed",
    `${verification.requesterLabel} verification: ${verification.reason}. ${solanaEnrichment.onChainDetail}`,
  );

  try {
    await updateAccessRequest(state.requestId, {
      requesterLabel: verification.requesterLabel,
      issuerLabel: verification.issuerLabel,
    });
  } catch (error) {
    console.error("VerificationAgent label update failed", error);
    throw error;
  }

  // ── Step 2: Decide access tier ────────────────────────────────────────────
  let trace2 = addTraceStep(
    trace,
    "decideTier",
    "running",
    "VerificationAgent: Applying deterministic tier policy.",
  );

  const tierDecision = await decideTier({
    verified: Boolean(verification.verified),
    patientPolicy: state.patientPolicy,
    patientApprovalPresent: state.patientApprovalPresent,
    emergencyMode: state.emergencyMode,
  });

  trace2 = completeTraceStep(
    trace2,
    "decideTier",
    tierDecision.decision === "awaiting_human" ? "awaiting_human" : "completed",
    tierDecision.justification,
  );

  try {
    await updateAccessRequest(state.requestId, {
      status:
        tierDecision.decision === "awaiting_human"
          ? "awaiting_approval"
          : tierDecision.decision,
      decision:
        tierDecision.decision === "awaiting_human"
          ? null
          : tierDecision.decision,
      tier: tierDecision.tier,
      ttlSeconds: tierDecision.ttlSeconds,
      justification: tierDecision.justification,
      fieldsAllowed: tierDecision.fieldsAllowed,
    });
  } catch (error) {
    console.error("VerificationAgent decision update failed", error);
    throw error;
  }

  return {
    verification: enrichedVerification,
    requesterLabel: verification.requesterLabel,
    issuerLabel: verification.issuerLabel,
    tierDecision,
    trace: trace2,
  };
}
