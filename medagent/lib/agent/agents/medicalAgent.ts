/**
 * MedicalAgent
 *
 * Responsibilities:
 *   1. Analyze the clinician's natural-language request intent (RAG triage)
 *   2. Decrypt and filter the IPS patient summary for the authorized tier
 *   3. Translate / summarize the dataset and produce a clinician-ready brief
 *   4. Issue a signed JWT session token for the clinician
 *
 * Uses SolanaAgentKit's langchain tool bindings when available to enable
 * future on-chain retrieval augmentation (e.g., federated IPS lookups).
 * The core pipeline always falls back to the deterministic in-process tools.
 */

import { analyzeRequestIntent } from "@/lib/agent/tools/analyzeRequestIntent";
import { fetchSummary } from "@/lib/agent/tools/fetchSummary";
import { translateTerms } from "@/lib/agent/tools/translateTerms";
import { issueSessionToken } from "@/lib/agent/tools/issueSessionToken";
import { addTraceStep, completeTraceStep } from "@/lib/agent/traceHelpers";
import { MEDICAL_AGENT_PROMPT } from "@/lib/agent/prompts";
import {
  createSession,
  deleteSession,
  getPatientRow,
  updateAccessRequest,
  updateSessionAudit,
} from "@/lib/db";
import { retrieve } from "@/lib/rag/ragClient";
import type { LegacySupervisorStateType } from "@/lib/agent/legacySupervisorTypes";

// ---------------------------------------------------------------------------
// Optional SolanaAgentKit tool bindings
// When solana-agent-kit is installed the createSolanaTools() helper returns
// an array of LangChain-compatible StructuredTool instances that can augment
// the medical agent's retrieval step.
// ---------------------------------------------------------------------------

async function loadSolanaTools(): Promise<unknown[]> {
  try {
    const sakModule = await import("solana-agent-kit").catch(() => null);
    // SAK v2 exports createSolanaTools(agent, options) for LangChain integration
    const toolsModule = await import("solana-agent-kit/langchain").catch(
      () => null,
    );
    if (!sakModule || !toolsModule) return [];

    const privateKey = process.env.SOLANA_PRIVATE_KEY;
    const rpc = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    if (!privateKey) return [];

    const agent = new sakModule.SolanaAgentKit(privateKey, rpc, {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
    });

    // createSolanaTools returns all registered SAK tools as LangChain StructuredTools
    const tools = toolsModule.createSolanaTools(agent);
    return Array.isArray(tools) ? tools : [];
  } catch {
    return [];
  }
}

function buildEmergencyRagQuery(input: {
  naturalLanguageRequest: string;
  intentSummary: string;
  priorityTopics: string[];
}) {
  const topicQuery = input.priorityTopics.join(" ");
  return [
    input.naturalLanguageRequest,
    input.intentSummary,
    topicQuery,
    "allergy adverse reaction lab trend risk episode chronic condition emergency contraindication",
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Main sub-agent runner
// ---------------------------------------------------------------------------

export async function runMedicalAgent(
  state: LegacySupervisorStateType,
): Promise<Partial<LegacySupervisorStateType>> {
  // Load SAK tools in parallel with intent analysis (non-blocking)
  void MEDICAL_AGENT_PROMPT;
  const [, requestIntent] = await Promise.all([
    loadSolanaTools(), // available for future RAG augmentation
    Promise.resolve(
      analyzeRequestIntent({
        naturalLanguageRequest: state.naturalLanguageRequest,
        fieldsAllowed: state.tierDecision?.fieldsAllowed ?? [],
      }),
    ),
  ]);

  // ── Step 1: Analyze request intent ───────────────────────────────────────
  let trace = addTraceStep(
    state.trace,
    "analyzeRequestIntent",
    "running",
    "MedicalAgent: Analyzing clinician request to prioritize authorized dataset.",
  );

  const requestedFocus = requestIntent.matchedAuthorizedFields.length
    ? `Matched requested focus to ${requestIntent.matchedAuthorizedFields.join(", ")}.`
    : "No specific field match found; MedAgent prioritized default high-signal emergency fields.";
  const withheldFocus = requestIntent.withheldRequestedFields.length
    ? ` Requested but withheld: ${requestIntent.withheldRequestedFields.join(", ")}.`
    : "";

  trace = completeTraceStep(
    trace,
    "analyzeRequestIntent",
    "completed",
    `${requestedFocus}${withheldFocus}`,
  );

  // ── Step 2: Fetch and decrypt IPS summary ────────────────────────────────
  trace = addTraceStep(
    trace,
    "fetchSummary",
    "running",
    "MedicalAgent: Decrypting patient summary and filtering fields for the selected tier.",
  );

  const { summarySubset, fieldsHash } = await fetchSummary({
    patientId: state.patientId,
    fieldsAllowed: state.tierDecision?.fieldsAllowed ?? [],
  });

  trace = completeTraceStep(
    trace,
    "fetchSummary",
    "completed",
    `MedicalAgent: Prepared authorized dataset with hash ${fieldsHash}.`,
  );

  // ── Step 3: CodeDB-style local RAG retrieval (patient-scoped) ─────────────
  trace = addTraceStep(
    trace,
    "ragRetrieve",
    "running",
    "MedicalAgent: Retrieving patient-scoped emergency context with trigram + inverted indexes.",
  );

  const patient = getPatientRow(state.patientId);
  const ragResults = patient
    ? await retrieve(
        patient.patient_hash,
        buildEmergencyRagQuery({
          naturalLanguageRequest: state.naturalLanguageRequest,
          intentSummary: requestIntent.intentSummary,
          priorityTopics: requestIntent.priorityTopics,
        }),
        5,
      )
    : [];

  trace = completeTraceStep(
    trace,
    "ragRetrieve",
    "completed",
    `MedicalAgent: Retrieved ${ragResults.length} tier-filtered RAG chunks for summarization context.`,
  );

  // ── Step 4: Translate terms + generate brief ──────────────────────────────
  trace = addTraceStep(
    trace,
    "translateTerms",
    "running",
    "MedicalAgent: Translating authorized terms and generating a clinician-ready brief.",
  );

  const translation = await translateTerms({
    summarySubset,
    targetLocale: state.targetLocale,
    requestIntent,
    ragResults,
  });

  trace = completeTraceStep(
    trace,
    "translateTerms",
    "completed",
    `MedicalAgent: Generated ${translation.mode} translation output and clinician brief.`,
  );

  // ── Step 5: Issue session token ───────────────────────────────────────────
  if (!state.tierDecision?.tier) {
    return {
      requestIntent,
      summarySubset,
      fieldsHash,
      translatedSummary: translation.translated,
      glossary: translation.glossary,
      brief: translation.brief,
      trace,
    };
  }

  trace = addTraceStep(
    trace,
    "issueSessionToken",
    "running",
    "MedicalAgent: Signing JWT and opening a time-boxed clinician session.",
  );

  const session = await issueSessionToken({
    requesterId: state.requesterId,
    patientId: state.patientId,
    tier: state.tierDecision.tier,
    fieldsAllowed: state.tierDecision.fieldsAllowed,
    ttlSeconds: state.tierDecision.ttlSeconds,
  });

  let sessionPersisted = false;
  try {
    await createSession({
      id: session.sessionId,
      requestId: state.requestId,
      patientId: state.patientId,
      requesterId: state.requesterId,
      tier: state.tierDecision.tier,
      jwt: session.jwt,
      expiresAt: session.expiresAt,
      fieldsAllowed: state.tierDecision.fieldsAllowed,
      summarySubset,
      translatedSummary: translation.translated,
      glossary: translation.glossary,
      brief: translation.brief,
    });
    sessionPersisted = true;

    await updateAccessRequest(state.requestId, {
      status: "granted",
      decision: "granted",
      fieldsReleased: state.tierDecision.fieldsAllowed,
    });
  } catch (error) {
    if (sessionPersisted) {
      try {
        deleteSession(session.sessionId);
      } catch {
        // best effort cleanup for partially persisted sessions
      }
    }
    throw error;
  }

  trace = completeTraceStep(
    trace,
    "issueSessionToken",
    "completed",
    `MedicalAgent: Issued JWT-backed session ${session.sessionId} expiring at ${session.expiresAt}.`,
  );

  return {
    requestIntent,
    summarySubset,
    fieldsHash,
    translatedSummary: translation.translated,
    glossary: translation.glossary,
    brief: translation.brief,
    session,
    trace,
  };
}
