import crypto from "crypto";
import path from "path";
import { END, START, StateGraph } from "@langchain/langgraph";

import { runDeterministicPolicyEngine } from "@/lib/agent/policy/deterministicEngine";
import { runRequestUnderstanding } from "@/lib/agent/agents/requestUnderstanding";
import { runRetrievalPlanner } from "@/lib/agent/agents/retrievalPlanner";
import { runEvidenceFilter } from "@/lib/agent/policy/evidenceFilter";
import { runEvidenceReviewer } from "@/lib/agent/agents/evidenceReviewer";
import { runMedicalSynthesizer } from "@/lib/agent/agents/medicalSynthesizer";
import { runSessionIssuer } from "@/lib/agent/policy/issuer";
import { runAuditAgent } from "@/lib/agent/agents/auditAgent";
import {
  getMaxRetrievalRetries,
  getWorkflowTimeoutMs,
} from "@/lib/agent/policy/runtimeLimits";

import {
  AgentState,
  AgentStateType,
  CanonicalEvidenceItem,
} from "@/lib/agent/state";
import { AccessWorkflowInput, MedAgentOutcome } from "@/lib/types";
import { FileCheckpointSaver } from "@/lib/agent/fileCheckpointSaver";

import {
  createAccessRequest,
  getAccessRequest,
  getAgentTrace,
  saveAgentTrace,
  updateAccessRequest,
  updateApprovalStatus,
} from "@/lib/db";
import { getDemoClinician } from "@/lib/ips/seed";

// ---------------------------------------------------------------------------
// Routing logic — deterministic and auditable
// ---------------------------------------------------------------------------

function getCurrentRetrievalMode(state: AgentStateType) {
  const plans = state.retrievalContext.queryPlans as Array<
    { mode?: "balanced" | "broad" | "exact" } | string
  >;
  if (!plans?.length) return undefined;

  const currentPlan = plans[plans.length - 1];
  if (typeof currentPlan === "string") {
    const legacy = currentPlan.toLowerCase();
    if (legacy.includes("exact")) return "exact";
    if (legacy.includes("broad")) return "broad";
    return "balanced";
  }

  return currentPlan.mode;
}

function canRetryRetrieval(state: AgentStateType) {
  const review = state.evidenceContext.reviewJudgement;
  if (!review) return false;

  // Deterministic retry gate from hardened evidence review + retry logic.
  if (!review.worthAnotherRetrievalPass) return false;
  if (review.clarificationIsBetter) return false;
  if (review.retrievalGapType === "policy_blocked") return false;

  const maxRetries = getMaxRetrievalRetries();

  // Explicit progression by retrieval mode:
  // balanced (initial) -> broad -> exact
  const mode = getCurrentRetrievalMode(state);
  if (mode === "exact") return false;

  const retryCount = state.retrievalContext.retryCount || 0;
  // Allow one final exact pass after broad when retry budget is reached.
  if (retryCount >= maxRetries && mode !== "broad") return false;

  return true;
}

async function withWorkflowTimeout<T>(promise: Promise<T>, requestId: string) {
  const timeoutMs = getWorkflowTimeoutMs();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new Error(
          `workflow_timeout requestId=${requestId} limitMs=${timeoutMs}`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function routeAfterDeterministicEngine(state: AgentStateType) {
  // Access not granted paths still get audited.
  if (state.policyContext.decision === "granted") {
    return "requestUnderstanding";
  }
  return "auditAgent";
}

function routeAfterEvidenceReviewer(state: AgentStateType) {
  return canRetryRetrieval(state) ? "retrievalPlanner" : "medicalSynthesizer";
}

async function medicalSynthesizerNode(state: AgentStateType) {
  // Supervisor-level perimeter: only accepted evidence is handed to synthesis.
  const acceptedIds = new Set(
    state.evidenceContext.reviewJudgement?.acceptedEvidenceIds ?? [],
  );
  const acceptedOnly = (state.evidenceContext.authorizedChunks ?? []).filter(
    (chunk) => acceptedIds.has(chunk.id),
  );

  const scopedState: AgentStateType = {
    ...state,
    evidenceContext: {
      ...state.evidenceContext,
      authorizedChunks: acceptedOnly as CanonicalEvidenceItem[],
    },
  };

  return runMedicalSynthesizer(scopedState);
}

const workflow = new StateGraph(AgentState)
  .addNode("deterministicEngine", runDeterministicPolicyEngine)
  .addNode("requestUnderstanding", runRequestUnderstanding)
  .addNode("retrievalPlanner", runRetrievalPlanner)
  .addNode("evidenceFilter", runEvidenceFilter)
  .addNode("evidenceReviewer", runEvidenceReviewer)
  .addNode("medicalSynthesizer", medicalSynthesizerNode)
  .addNode("sessionIssuer", runSessionIssuer)
  .addNode("auditAgent", runAuditAgent as any)
  .addEdge(START, "deterministicEngine")
  .addConditionalEdges("deterministicEngine", routeAfterDeterministicEngine)
  .addEdge("requestUnderstanding", "retrievalPlanner")
  .addEdge("retrievalPlanner", "evidenceFilter")
  .addEdge("evidenceFilter", "evidenceReviewer")
  .addConditionalEdges("evidenceReviewer", routeAfterEvidenceReviewer)
  .addEdge("medicalSynthesizer", "sessionIssuer")
  .addEdge("sessionIssuer", "auditAgent")
  .addEdge("auditAgent", END);

const checkpointer = new FileCheckpointSaver(
  path.join(process.cwd(), "data", "agent-checkpoints.json"),
);
export const medAgentApp = workflow.compile({ checkpointer });

function buildRequestContext(fields: {
  requestId: string;
  patientId: string;
  requesterId: string;
  naturalLanguageRequest: string;
  targetLocale: string;
  emergencyMode: boolean;
  patientApprovalPresent: boolean;
  requesterLabel?: string | null;
  issuerLabel?: string | null;
  presentedCredential?: string | null;
  sourceMessageId?: string | null;
}): AgentStateType["requestContext"] {
  return {
    requestId: fields.requestId,
    patientId: fields.patientId,
    requesterId: fields.requesterId,
    naturalLanguageRequest: fields.naturalLanguageRequest,
    targetLocale: fields.targetLocale,
    emergencyMode: fields.emergencyMode,
    patientApprovalPresent: fields.patientApprovalPresent,
    requesterLabel: fields.requesterLabel ?? undefined,
    issuerLabel: fields.issuerLabel ?? undefined,
    presentedCredential: fields.presentedCredential ?? undefined,
    sourceMessageId: fields.sourceMessageId ?? undefined,
  };
}

/**
 * Main application boundary. Maps frontend types to the state shape,
 * invokes the graph, and translates back to MedAgentOutcome.
 */
export async function runMedAgentWorkflow({
  input,
  resumeRequestId,
  clinicianHandle,
  clinicianChatGuid,
}: {
  input?: AccessWorkflowInput;
  resumeRequestId?: string;
  clinicianHandle?: string;
  clinicianChatGuid?: string;
}): Promise<MedAgentOutcome> {
  let requestId: string;

  if (resumeRequestId) {
    requestId = resumeRequestId;
    const req = getAccessRequest(requestId);
    if (!req) {
      throw new Error(
        `Cannot resume workflow. Request ${resumeRequestId} not found.`,
      );
    }
    const trace = getAgentTrace(requestId);
    if (!trace) {
      throw new Error(
        `Cannot resume workflow. Trace for ${resumeRequestId} not found.`,
      );
    }

    const persona = getDemoClinician(req.requester_id);

    // Resume state is reconstructed from the persisted request + trace.
    const initialResumeState: Partial<AgentStateType> = {
      requestContext: buildRequestContext({
        requestId,
        patientId: req.patient_id,
        requesterId: req.requester_id,
        naturalLanguageRequest: req.natural_language_request,
        targetLocale: persona?.locale ?? "en-GB",
        emergencyMode: req.emergency_mode,
        patientApprovalPresent: true,
        requesterLabel: persona?.requesterLabel,
        issuerLabel: persona?.issuerLabel,
        presentedCredential: req.presented_credential,
      }),
      trace,
    } as any;

    const result = await withWorkflowTimeout(
      medAgentApp.invoke(initialResumeState, {
        configurable: { thread_id: requestId },
      }),
      requestId,
    );
    return buildOutcomeFromState(result);
  }

  // Initial workflow invocation
  requestId = crypto.randomUUID();
  if (!input) throw new Error("Input required for initial run.");

  const persona = getDemoClinician(input.requesterId);
  const initialTrace = {
    requestId,
    patientId: input.patientId,
    requesterId: input.requesterId,
    requesterLabel: persona?.requesterLabel ?? "Unknown Requester",
    issuerLabel: persona?.issuerLabel ?? "Unknown Issuer",
    steps: [],
  };

  createAccessRequest({
    id: requestId,
    patientId: input.patientId,
    requesterId: input.requesterId,
    requesterLabel: persona?.requesterLabel,
    issuerLabel: persona?.issuerLabel,
    naturalLanguageRequest: input.naturalLanguageRequest,
    presentedCredential: input.presentedCredential,
    emergencyMode: input.emergencyMode,
    sourceMessageId: input.sourceMessageId,
    clinicianHandle: clinicianHandle,
    clinicianChatGuid: clinicianChatGuid,
  });

  saveAgentTrace(initialTrace);

  const initialState: Partial<AgentStateType> = {
    requestContext: buildRequestContext({
      requestId,
      patientId: input.patientId,
      requesterId: input.requesterId,
      naturalLanguageRequest: input.naturalLanguageRequest,
      targetLocale: input.targetLocale,
      emergencyMode: input.emergencyMode,
      presentedCredential: input.presentedCredential,
      patientApprovalPresent: input.patientApprovalPresent ?? false,
      requesterLabel: initialTrace.requesterLabel,
      issuerLabel: initialTrace.issuerLabel,
      sourceMessageId: input.sourceMessageId,
    }),
    trace: initialTrace,
  };

  const result = await withWorkflowTimeout(
    medAgentApp.invoke(initialState, {
      configurable: { thread_id: requestId },
    }),
    requestId,
  );

  return buildOutcomeFromState(result);
}

export function createPendingRequest(input: {
  patientId: string;
  requesterId: string;
  requesterLabel?: string | null;
  issuerLabel?: string | null;
  naturalLanguageRequest: string;
  targetLocale?: string;
  emergencyMode: boolean;
  patientApprovalPresent?: boolean;
  presentedCredential?: string;
}) {
  const requestId = crypto.randomUUID();

  createAccessRequest({
    id: requestId,
    patientId: input.patientId,
    requesterId: input.requesterId,
    requesterLabel: input.requesterLabel ?? null,
    issuerLabel: input.issuerLabel ?? null,
    naturalLanguageRequest: input.naturalLanguageRequest,
    presentedCredential: input.presentedCredential ?? null,
    emergencyMode: input.emergencyMode,
  });

  saveAgentTrace({
    requestId,
    patientId: input.patientId,
    requesterId: input.requesterId,
    requesterLabel: input.requesterLabel ?? null,
    issuerLabel: input.issuerLabel ?? null,
    steps: [],
  });

  return requestId;
}

export async function resumeApprovedRequest(requestId: string) {
  return runMedAgentWorkflow({ resumeRequestId: requestId });
}

export async function denyApprovedRequest(
  requestId: string,
  approvalToken?: string,
): Promise<MedAgentOutcome> {
  const req = getAccessRequest(requestId);
  if (!req) {
    throw new Error(`Cannot deny request. Request ${requestId} not found.`);
  }

  if (approvalToken) {
    updateApprovalStatus(approvalToken, "denied");
  }

  updateAccessRequest(requestId, {
    status: "denied",
    decision: "denied",
    tier: null,
    ttlSeconds: null,
    justification: "Patient denied the approval request. No data was released.",
    fieldsAllowed: [],
    fieldsReleased: [],
  });

  const trace = getAgentTrace(requestId) ?? {
    requestId,
    patientId: req.patient_id,
    requesterId: req.requester_id,
    requesterLabel: req.requester_label ?? null,
    issuerLabel: req.issuer_label ?? null,
    steps: [],
  };

  return {
    requestId,
    patientId: req.patient_id,
    requesterId: req.requester_id,
    decision: "denied",
    tier: null,
    ttlSeconds: 0,
    fieldsAllowed: [],
    justification: "Patient denied the approval request. No data was released.",
    trace,
  };
}

function buildOutcomeFromState(state: AgentStateType): MedAgentOutcome {
  const { policyContext, responseContext, requestContext } = state;
  if (policyContext.decision === "pending") {
    throw new Error("Workflow completed without a terminal policy decision.");
  }

  const ttlSeconds =
    policyContext.tier === 1
      ? 30 * 60
      : policyContext.tier === 2
        ? 15 * 60
        : policyContext.tier === 3
          ? 20 * 60
          : 0;

  let expiresAt: string | undefined;
  if (responseContext.sessionToken) {
    try {
      const decoded = JSON.parse(
        Buffer.from(
          responseContext.sessionToken.split(".")[1],
          "base64url",
        ).toString("utf8"),
      ) as { exp?: number };
      if (decoded.exp) {
        expiresAt = new Date(decoded.exp * 1000).toISOString();
      }
    } catch {
      expiresAt = undefined;
    }
  }

  return {
    requestId: requestContext.requestId,
    patientId: requestContext.patientId,
    requesterId: requestContext.requesterId,
    decision: policyContext.decision,
    tier: policyContext.tier as any,
    ttlSeconds,
    fieldsAllowed: policyContext.fieldsAllowed as any,
    jwt: responseContext.sessionToken,
    expiresAt,
    approvalMethod:
      policyContext.approvalStatus === "pending" ? "email" : undefined,
    brief: responseContext.clinicianBrief,
    justification:
      policyContext.decision === "granted"
        ? "Access granted by deterministic policy engine with bounded evidence synthesis."
        : policyContext.decision === "awaiting_human"
          ? "Awaiting patient approval for Tier 2 access."
          : "Access denied by deterministic policy engine.",
    trace: state.trace,
    clarificationQuestion: responseContext.clarificationQuestion,
    sourceMessageId: requestContext.sourceMessageId,
  };
}
