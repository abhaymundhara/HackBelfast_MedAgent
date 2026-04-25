import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AgentStateType } from "@/lib/agent/state";
import { addTraceStep } from "@/lib/agent/traceHelpers";

type Tier = 1 | 2 | 3;

type SessionIssuanceInput = {
  decisionGranted: boolean;
  statusValid: boolean;
  hasEvidence: boolean;
  hasBrief: boolean;
  hasCitations: boolean;
  jwtSecretPresent: boolean;
};

function hasNonEmptyText(value: string | undefined) {
  return Boolean(value?.trim());
}

function isTier(value: unknown): value is Tier {
  return value === 1 || value === 2 || value === 3;
}

export function getTierTtlSeconds(tier: Tier | null | undefined) {
  if (tier === 1) return 30 * 60;
  if (tier === 2) return 15 * 60;
  if (tier === 3) return 20 * 60;
  return 0;
}

export function buildIssuanceSkipReasons(input: SessionIssuanceInput) {
  const reasons: string[] = [];

  if (!input.decisionGranted) {
    reasons.push("decision_not_granted");
  }

  if (!input.statusValid) {
    reasons.push("invalid_status");
  }

  if (!input.hasBrief) {
    reasons.push("missing_brief");
  }

  if (!input.hasCitations) {
    reasons.push("missing_citations");
  }

  if (!input.hasEvidence) {
    reasons.push("no_authorized_evidence");
  }

  if (!input.jwtSecretPresent) {
    reasons.push("missing_jwt_secret");
  }

  return reasons;
}

export function canIssueSession(input: SessionIssuanceInput) {
  return buildIssuanceSkipReasons(input).length === 0;
}

export async function runSessionIssuer(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const {
    requestContext,
    policyContext,
    responseContext,
    evidenceContext,
    trace,
  } = state;

  const jwtSecret = process.env.JWT_SECRET;
  const jwtSecretPresent = Boolean(jwtSecret);
  const gateInput: SessionIssuanceInput = {
    decisionGranted: policyContext.decision === "granted",
    statusValid:
      responseContext.answerStatus === "complete" ||
      responseContext.answerStatus === "partial",
    hasEvidence: (evidenceContext.authorizedChunks?.length ?? 0) > 0,
    hasBrief: hasNonEmptyText(responseContext.clinicianBrief),
    hasCitations: Boolean(responseContext.citedEvidenceIds?.length),
    jwtSecretPresent,
  };
  const skipReasons = buildIssuanceSkipReasons(gateInput);

  if (!canIssueSession(gateInput) || !jwtSecret) {
    const stepSummary = `Session issuance skipped: ${skipReasons.join(", ")}`;
    return {
      trace: addTraceStep(trace, "issueSessionToken", "completed", stepSummary),
      completedAgents: ["sessionIssuer"],
    };
  }

  if (!isTier(policyContext.tier)) {
    throw new Error(
      "SessionIssuer cannot issue token: invalid or missing tier.",
    );
  }

  const tier = policyContext.tier;
  const ttlSeconds = getTierTtlSeconds(tier);
  if (ttlSeconds <= 0) {
    throw new Error("SessionIssuer cannot issue token: non-positive TTL.");
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const jwtToken = jwt.sign(
    {
      sub: sessionId,
      requesterId: requestContext.requesterId,
      patientId: requestContext.patientId,
      tier,
      fieldsAllowed: policyContext.fieldsAllowed,
    },
    jwtSecret,
    {
      expiresIn: ttlSeconds,
    },
  );

  const stepSummary = `Session issued. Tier ${tier}. Expires at ${expiresAt}.`;

  const updatedTrace = addTraceStep(
    trace,
    "issueSessionToken",
    "completed",
    stepSummary,
  );

  return {
    responseContext: {
      ...responseContext,
      sessionToken: jwtToken,
    },
    trace: updatedTrace,
    completedAgents: ["sessionIssuer"],
  };
}
