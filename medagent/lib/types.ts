import { z } from "zod";

export const EMERGENCY_ALERTS = [
  "pregnancy",
  "epilepsy",
  "diabetes",
  "anticoagulants",
  "implanted-device",
  "DNR",
  "immunocompromised",
] as const;

export const EmergencySummary = z.object({
  patientId: z.string(),
  demographics: z.object({
    name: z.string(),
    dob: z.string(),
    sex: z.enum(["male", "female", "other"]),
    bloodType: z.string().optional(),
    languages: z.array(z.string()),
    homeCountry: z.string(),
    homeJurisdiction: z.string().optional(),
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
  alerts: z.array(z.enum(EMERGENCY_ALERTS)),
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

export const PatientPolicy = z.object({
  emergencyAutoAccess: z.boolean(),
  allowPatientApprovalRequests: z.boolean(),
  breakGlassAllowed: z.boolean(),
  shareableDocumentIds: z.array(z.string()),
});

export const ReleasedFieldSchema = z.enum([
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencyContact",
  "recentDischarge",
  "documents",
]);

export const ClinicianPersonaSchema = z.object({
  id: z.string(),
  requesterId: z.string(),
  requesterLabel: z.string(),
  issuerId: z.string(),
  issuerLabel: z.string(),
  locale: z.string(),
  stronglyVerified: z.boolean(),
});

export const VerificationTrustLevelSchema = z.enum([
  "trusted_requester",
  "trusted_issuer_unrecognized_requester",
  "known_untrusted_issuer",
  "credential_presented_untrusted",
  "unknown_requester",
]);

export const RequestIntentSchema = z.object({
  intentSummary: z.string(),
  priorityTopics: z.array(z.string()),
  matchedAuthorizedFields: z.array(ReleasedFieldSchema),
  withheldRequestedFields: z.array(ReleasedFieldSchema),
  suggestedQuestions: z.array(z.string()),
});

export const AuditEventTypeSchema = z.enum([
  "access_requested",
  "access_decision",
  "token_issued",
  "token_expired",
  "record_shared",
  "record_accessed",
  "share_revoked",
]);

export const AuditEventSchema = z.object({
  event_type: AuditEventTypeSchema,
  request_id: z.string(),
  doctor_hash: z.string(),
  patient_hash: z.string(),
  jurisdiction: z.string(),
  decision: z.enum(["allow", "deny"]).nullable(),
  token_expiry: z.string().nullable(),
  timestamp: z.string(),
  interaction_type: z.string().optional(),
  summary_hash: z.string().optional(),
  fields_accessed: z.string().optional(),
  duration_seconds: z.number().optional(),
  source_message_id: z.string().optional(),
});

export type EmergencySummary = z.infer<typeof EmergencySummary>;
export type PatientPolicy = z.infer<typeof PatientPolicy>;
export type ClinicianPersona = z.infer<typeof ClinicianPersonaSchema>;
export type ReleasedField = z.infer<typeof ReleasedFieldSchema>;
export type VerificationTrustLevel = z.infer<
  typeof VerificationTrustLevelSchema
>;
export type RequestIntent = z.infer<typeof RequestIntentSchema>;
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export type AgentTraceStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_human";

export type AgentTraceTool =
  | "verifyRequester"
  | "decideTier"
  | "analyzeRequestIntent"
  | "requestPatientApproval"
  | "fetchSummary"
  | "validateAuthorizedEvidence"
  | "ragRetrieve"
  | "rerankChunks"
  | "translateTerms"
  | "composeClinicianBrief"
  | "issueSessionToken"
  | "logAuditOnChain";

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
  requesterLabel?: string | null;
  issuerLabel?: string | null;
  finalDecision?: "granted" | "denied";
  steps: AgentTraceStep[];
}

export interface TierDecision {
  decision: "granted" | "denied" | "awaiting_human";
  tier: 1 | 2 | 3 | null;
  ttlSeconds: number;
  fieldsAllowed: ReleasedField[];
  justification: string;
}

export interface VerificationResult {
  verified: boolean;
  issuerLabel: string;
  requesterLabel: string;
  trustLevel: VerificationTrustLevel;
  verificationMode: string;
  verificationReason: string;
  registryAnchored: boolean;
  registryAccountId: string | null;
  presentedCredential: boolean;
  reason: string;
}

export interface PatientApprovalResult {
  sent: boolean;
  method: "push" | "email";
  approvalToken?: string;
}

export interface SessionTokenResult {
  sessionId: string;
  jwt: string;
  expiresAt: string;
}

export interface AuditWriteResult {
  chainRef: string;
  chainSequence: number | null;
  chainTimestamp: string | null;
  status: "submitted" | "skipped_missing_config" | "failed";
  chainFeeLamports?: number;
  estimatedCostUsd?: number;
  error?: string;
}

export interface AuditEventRow {
  patientId: string;
  requestId: string;
  eventType: AuditEventType;
  decision: "allow" | "deny" | null;
  chainRef: string;
  chainSequence: number | null;
  chainTimestamp: string | null;
  payload: AuditEvent;
}

export interface AuditReadinessCheck {
  key: "credentials" | "rpc" | "write";
  passed: boolean;
  detail: string;
}

export interface AuditReadinessResult {
  ready: boolean;
  mode: "live" | "fallback";
  cluster: string;
  checks: AuditReadinessCheck[];
}

export interface TranslationResult {
  translated: Record<string, unknown>;
  glossary: { original: string; translated: string }[];
  brief: string;
  mode: "llm" | "fallback";
}

export interface AccessWorkflowInput {
  patientId: string;
  requesterId: string;
  naturalLanguageRequest: string;
  targetLocale: string;
  emergencyMode: boolean;
  patientApprovalPresent?: boolean;
  presentedCredential?: string;
  sourceMessageId?: string;
}

export interface MedAgentOutcome {
  requestId: string;
  patientId: string;
  requesterId: string;
  decision: "granted" | "denied" | "awaiting_human";
  tier: 1 | 2 | 3 | null;
  ttlSeconds: number;
  sessionId?: string;
  jwt?: string;
  expiresAt?: string;
  fieldsAllowed: ReleasedField[];
  summarySubset?: Record<string, unknown>;
  translatedSummary?: Record<string, unknown>;
  glossary?: { original: string; translated: string }[];
  brief?: string;
  clarificationQuestion?: string;
  requestIntent?: RequestIntent;
  verification?: VerificationResult;
  justification: string;
  trace: AgentTrace;
  approvalToken?: string;
  approvalMethod?: "push" | "email";
  auditLog?: AuditWriteResult;
  sourceMessageId?: string;
}

export interface PatientDocumentSeed {
  id: string;
  title: string;
  mimeType: string;
  content: string;
  patientApprovedForTier1Or2: boolean;
}

export interface PatientSeed {
  patientId: string;
  localIdentity: string;
  summary: EmergencySummary;
  policy: PatientPolicy;
  docs: PatientDocumentSeed[];
}

export interface FollowUpAnswer {
  answer: string;
  mode: "llm" | "fallback";
  citedFields: string[];
}

export interface AccessRequestStatusSnapshot {
  requestId: string;
  status:
    | "pending"
    | "awaiting_approval"
    | "approved_resuming"
    | "granted"
    | "denied"
    | "expired";
  decision: "granted" | "denied" | "awaiting_human" | null;
  tier: 1 | 2 | 3 | null;
  justification: string | null;
  approvalMethod: "push" | "email" | null;
  approvalStatus: "pending" | "approved" | "denied" | "expired" | null;
  approvalExpiresAt: string | null;
  sessionId: string | null;
}

export const KEY_ALERTS = [...EMERGENCY_ALERTS];
export const CRITICAL_ALERTS = [
  "anticoagulants",
  "implanted-device",
  "DNR",
  "epilepsy",
  "diabetes",
] as const;

export const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3",
};

export const WITHHELD_FIELD_LABELS: Record<ReleasedField, string> = {
  allergies: "Allergies",
  medications: "Medications",
  conditions: "Conditions",
  alerts: "Alerts",
  emergencyContact: "Emergency contact",
  recentDischarge: "Recent discharge summary",
  documents: "Supporting documents",
};
