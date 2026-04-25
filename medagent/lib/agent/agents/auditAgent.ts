import jwt from "jsonwebtoken";

import {
  buildAuditEvent,
  logAuditOnChain,
} from "@/lib/agent/tools/logAuditOnChain";
import { addTraceStep, completeTraceStep } from "@/lib/agent/traceHelpers";
import { sha256Hash } from "@/lib/crypto";
import { updateAccessRequest } from "@/lib/db";
import { AuditEventType } from "@/lib/types";
import { AgentStateType } from "@/lib/agent/state";

type NormalizedAuditLog = {
  chainRef: string | null;
  chainSequence: number | null;
  chainTimestamp: string | null;
  status: "submitted" | "skipped_missing_config" | "failed";
  chainFeeLamports?: number;
  estimatedCostUsd?: number;
  error?: string;
};

function normalizeAuditLog(result: unknown): NormalizedAuditLog {
  if (!result || typeof result !== "object") {
    return {
      chainRef: null,
      chainSequence: null,
      chainTimestamp: null,
      status: "failed",
      error: "malformed_audit_result",
    };
  }

  const candidate = result as {
    chainRef?: unknown;
    chainSequence?: unknown;
    chainTimestamp?: unknown;
    status?: unknown;
    chainFeeLamports?: unknown;
    estimatedCostUsd?: unknown;
    error?: unknown;
  };

  const status =
    candidate.status === "submitted" ||
    candidate.status === "skipped_missing_config" ||
    candidate.status === "failed"
      ? candidate.status
      : "failed";

  return {
    chainRef:
      typeof candidate.chainRef === "string" ? candidate.chainRef : null,
    chainSequence:
      typeof candidate.chainSequence === "number"
        ? candidate.chainSequence
        : null,
    chainTimestamp:
      typeof candidate.chainTimestamp === "string"
        ? candidate.chainTimestamp
        : null,
    status,
    chainFeeLamports:
      typeof candidate.chainFeeLamports === "number"
        ? candidate.chainFeeLamports
        : undefined,
    estimatedCostUsd:
      typeof candidate.estimatedCostUsd === "number"
        ? candidate.estimatedCostUsd
        : undefined,
    error:
      typeof candidate.error === "string"
        ? candidate.error
        : status === "failed"
          ? "malformed_audit_result"
          : undefined,
  };
}

function resolveAuditJurisdiction(targetLocale: string): string {
  const locale = targetLocale.toLowerCase();
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("en-gb")) return "uk";
  return "global";
}

export async function runAuditAgent(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const { requestContext, policyContext, responseContext } = state;
  let trace = state.trace;

  trace = addTraceStep(
    trace,
    "logAuditOnChain",
    "running",
    "AuditAgent: Submitting minimal non-PHI audit metadata to Solana via Anchor program.",
  );

  const eventType: AuditEventType = responseContext.sessionToken
    ? "token_issued"
    : "access_decision";

  let tokenExpiry: string | null = null;
  if (responseContext.sessionToken) {
    try {
      const dec = jwt.decode(responseContext.sessionToken);
      if (
        dec &&
        typeof dec === "object" &&
        "exp" in dec &&
        typeof dec.exp === "number"
      ) {
        tokenExpiry = new Date(dec.exp * 1000).toISOString();
      }
    } catch {
      tokenExpiry = null;
    }
  }

  const normalizedDecision =
    policyContext.decision === "pending" ? "denied" : policyContext.decision;

  let auditLog: NormalizedAuditLog;

  try {
    const fieldsAccessed = policyContext.fieldsAllowed?.join(",") || undefined;
    const summaryHash = responseContext.clinicianBrief
      ? sha256Hash(responseContext.clinicianBrief)
      : requestContext.naturalLanguageRequest
        ? sha256Hash(requestContext.naturalLanguageRequest)
      : undefined;

    const event = buildAuditEvent({
      eventType,
      requestId: requestContext.requestId,
      patientId: requestContext.patientId,
      requesterId: requestContext.requesterId,
      decision: normalizedDecision,
      tokenExpiry,
      jurisdiction: resolveAuditJurisdiction(requestContext.targetLocale),
      interactionType: "access",
      summaryHash,
      fieldsAccessed,
      durationSeconds: 0,
      sourceMessageId: requestContext.sourceMessageId,
    });

    const result = await logAuditOnChain({
      requestId: requestContext.requestId,
      patientId: requestContext.patientId,
      event,
    });

    auditLog = normalizeAuditLog(result);
  } catch (error) {
    auditLog = {
      chainRef: null,
      chainSequence: null,
      chainTimestamp: null,
      status: "failed",
      error: error instanceof Error ? error.message : "audit_write_failed",
    };
  }

  trace = completeTraceStep(
    trace,
    "logAuditOnChain",
    "completed",
    auditLog.status === "submitted"
      ? `AuditAgent: Audit event submitted with Solana signature ${auditLog.chainRef}.${typeof auditLog.estimatedCostUsd === "number" ? ` Estimated chain write cost $${auditLog.estimatedCostUsd.toFixed(6)}.` : ""}`
      : auditLog.status === "skipped_missing_config"
        ? "AuditAgent: Solana credentials missing locally — on-chain submission skipped."
        : `AuditAgent: Solana submission failed: ${auditLog.error ?? "unknown_error"}.`,
  );

  try {
    await updateAccessRequest(requestContext.requestId, {
      status: policyContext.decision,
      decision:
        policyContext.decision === "awaiting_human"
          ? null
          : policyContext.decision,
      chainRef: auditLog.chainRef,
      chainSequence: auditLog.chainSequence,
      chainTimestamp: auditLog.chainTimestamp,
    });
  } catch (error) {
    console.error("AuditAgent access request update failed", error);
    throw error;
  }

  return {
    trace,
    completedAgents: ["auditAgent"],
  };
}
