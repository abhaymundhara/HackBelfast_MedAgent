import {
  AgentTrace,
  PatientPolicy,
  RequestIntent,
  SessionTokenResult,
  TierDecision,
  VerificationResult,
} from "@/lib/types";

const REDACTED = "[REDACTED]";

export type RedactedLegacySupervisorState = Omit<
  LegacySupervisorStateType,
  | "patientId"
  | "requesterId"
  | "naturalLanguageRequest"
  | "presentedCredential"
  | "approvalToken"
  | "patientPolicy"
  | "verification"
  | "requestIntent"
  | "summarySubset"
  | "session"
  | "translatedSummary"
  | "glossary"
  | "brief"
  | "trace"
> & {
  patientId: string;
  requesterId: string;
  naturalLanguageRequest: string;
  presentedCredential?: string;
  approvalToken?: string;
  patientPolicy: string;
  verification?: string;
  requestIntent?: string;
  summarySubset?: string;
  session?: string;
  translatedSummary?: string;
  glossary?: string;
  brief?: string;
  trace: AgentTrace;
};

export function redactAgentTrace(trace: AgentTrace): AgentTrace {
  return {
    ...trace,
    patientId: REDACTED,
    requesterId: REDACTED,
  };
}

export function redactSupervisorState(
  state: LegacySupervisorStateType,
): RedactedLegacySupervisorState {
  return {
    ...state,
    patientId: REDACTED,
    requesterId: REDACTED,
    naturalLanguageRequest: REDACTED,
    presentedCredential:
      state.presentedCredential !== undefined ? REDACTED : undefined,
    approvalToken: state.approvalToken !== undefined ? REDACTED : undefined,
    patientPolicy: REDACTED,
    verification: state.verification ? REDACTED : undefined,
    requestIntent: state.requestIntent ? REDACTED : undefined,
    summarySubset: state.summarySubset ? REDACTED : undefined,
    session: state.session ? REDACTED : undefined,
    translatedSummary: state.translatedSummary ? REDACTED : undefined,
    glossary: state.glossary ? REDACTED : undefined,
    brief: state.brief !== undefined ? REDACTED : undefined,
    trace: redactAgentTrace(state.trace),
  };
}

export type LegacySupervisorStateType = {
  requestId: string;
  patientId: string;
  requesterId: string;
  requesterLabel: string;
  issuerLabel: string;
  naturalLanguageRequest: string;
  targetLocale: string;
  emergencyMode: boolean;
  patientApprovalPresent: boolean;
  presentedCredential?: string;
  patientPolicy: PatientPolicy;
  verification?: VerificationResult & {
    solanaOnChainVerified?: boolean;
    solanaDetail?: string;
  };
  tierDecision?: TierDecision;
  approvalToken?: string;
  approvalMethod?: "push" | "email";
  requestIntent?: RequestIntent;
  summarySubset?: Record<string, unknown>;
  fieldsHash?: string;
  translatedSummary?: Record<string, unknown>;
  glossary?: { original: string; translated: string }[];
  brief?: string;
  session?: SessionTokenResult;
  trace: AgentTrace;
};
