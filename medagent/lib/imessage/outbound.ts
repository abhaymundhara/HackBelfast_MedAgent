"use strict";

import type { MedAgentOutcome } from "@/lib/types";
import { DEFAULT_ACTIVATION_KEYWORD } from "./intents";

export interface OutboundContext {
  outcome: MedAgentOutcome;
  identityKind: "clinician" | "patient";
  requesterLabel?: string;
  patientLabel?: string;
  appBaseUrl?: string;
}

const MAX_MSG_LEN = 1000;

function splitMessages(text: string): string[] {
  if (text.length <= MAX_MSG_LEN) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_MSG_LEN) {
    // Try to split at a newline boundary near the limit
    let cutAt = remaining.lastIndexOf("\n", MAX_MSG_LEN);
    if (cutAt < MAX_MSG_LEN / 2) cutAt = MAX_MSG_LEN;
    parts.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function solscanLine(chainRef: string | null | undefined): string {
  if (!chainRef) return "";
  if (chainRef.startsWith("local-solana:")) return "• Audit logged locally";
  return `• Audit: https://solscan.io/tx/${chainRef}?cluster=devnet`;
}

function tier1Card(ctx: OutboundContext): string {
  const { outcome, requesterLabel, patientLabel } = ctx;
  const subset = outcome.summarySubset ?? {};
  const lines: string[] = [
    `✓ Access GRANTED — Tier 1`,
    patientLabel ? `• Patient: ${patientLabel}` : "",
    requesterLabel ? `• Clinician: ${requesterLabel}` : "",
    `• TTL: ${Math.round(outcome.ttlSeconds / 60)} min`,
    "",
  ];

  const demographics = subset.demographics as
    | Record<string, unknown>
    | undefined;
  if (demographics) {
    lines.push(`DEMOGRAPHICS`);
    if (demographics.name) lines.push(`• Name: ${String(demographics.name)}`);
    if (demographics.dob) lines.push(`• DOB: ${String(demographics.dob)}`);
    if (demographics.bloodType)
      lines.push(`• Blood: ${String(demographics.bloodType)}`);
    if (demographics.languages)
      lines.push(
        `• Languages: ${(demographics.languages as string[]).join(", ")}`,
      );
    lines.push("");
  }

  const allergies = subset.allergies as
    | Array<Record<string, unknown>>
    | undefined;
  if (allergies?.length) {
    lines.push("ALLERGIES");
    for (const a of allergies) {
      lines.push(
        `• ${String(a.substance)} (${String(a.severity)})${a.reaction ? " — " + String(a.reaction) : ""}`,
      );
    }
    lines.push("");
  }

  const alerts = subset.alerts as string[] | undefined;
  if (alerts?.length) {
    lines.push(`⚠️ ALERTS: ${alerts.join(", ")}`);
    lines.push("");
  }

  const auditLine = solscanLine(outcome.auditLog?.chainRef);
  if (auditLine) lines.push(auditLine);

  return lines
    .filter((l) => l !== undefined)
    .join("\n")
    .trim();
}

function tier2Card(ctx: OutboundContext): string {
  const { outcome, requesterLabel, patientLabel } = ctx;
  const subset = outcome.summarySubset ?? {};
  const lines: string[] = [
    `✓ Access GRANTED — Tier 2`,
    patientLabel ? `• Patient: ${patientLabel}` : "",
    requesterLabel ? `• Clinician: ${requesterLabel}` : "",
    `• TTL: ${Math.round(outcome.ttlSeconds / 60)} min`,
    "",
  ];

  const medications = subset.medications as
    | Array<Record<string, unknown>>
    | undefined;
  if (medications?.length) {
    lines.push("MEDICATIONS");
    for (const m of medications) {
      const crit = m.critical ? " ⚠️" : "";
      lines.push(
        `• ${String(m.name)} ${String(m.dose)} ${String(m.frequency)}${crit}`,
      );
    }
    lines.push("");
  }

  const conditions = subset.conditions as
    | Array<Record<string, unknown>>
    | undefined;
  if (conditions?.length) {
    lines.push("CONDITIONS");
    for (const c of conditions) {
      lines.push(`• ${String(c.label)}${c.major ? " (major)" : ""}`);
    }
    lines.push("");
  }

  lines.push("• Withheld in this tier: fields not authorized for Tier 2");

  const auditLine = solscanLine(outcome.auditLog?.chainRef);
  if (auditLine) lines.push(auditLine);

  return lines
    .filter((l) => l !== undefined)
    .join("\n")
    .trim();
}

function tier3Card(ctx: OutboundContext): string {
  const { outcome, requesterLabel, patientLabel } = ctx;
  const subset = outcome.summarySubset ?? {};
  const lines: string[] = [
    `⚠️ BREAK-GLASS — Tier 3 Emergency Access`,
    patientLabel ? `• Patient: ${patientLabel}` : "",
    requesterLabel ? `• Clinician: ${requesterLabel}` : "",
    `• TTL: ${Math.round(outcome.ttlSeconds / 60)} min`,
    "",
  ];

  const demographics = subset.demographics as
    | Record<string, unknown>
    | undefined;
  if (demographics) {
    if (demographics.name) lines.push(`• Name: ${String(demographics.name)}`);
    if (demographics.bloodType)
      lines.push(`• Blood: ${String(demographics.bloodType)}`);
    lines.push("");
  }

  const allergies = subset.allergies as
    | Array<Record<string, unknown>>
    | undefined;
  if (allergies?.length) {
    lines.push("ALLERGIES");
    for (const a of allergies) {
      lines.push(`• ${String(a.substance)} (${String(a.severity)})`);
    }
    lines.push("");
  }

  const medications = subset.medications as
    | Array<Record<string, unknown>>
    | undefined;
  if (medications?.length) {
    lines.push("MEDICATIONS");
    for (const m of medications) {
      if (m.critical) lines.push(`• ⚠️ ${String(m.name)} ${String(m.dose)}`);
      else lines.push(`• ${String(m.name)} ${String(m.dose)}`);
    }
    lines.push("");
  }

  const alerts = subset.alerts as string[] | undefined;
  if (alerts?.length) {
    lines.push(`⚠️ ALERTS: ${alerts.join(", ")}`);
    lines.push("");
  }

  const emergencyContact = subset.emergencyContact as
    | Record<string, unknown>
    | undefined;
  if (emergencyContact) {
    lines.push(
      `🔔 Emergency Contact: ${String(emergencyContact.name)} (${String(emergencyContact.relation)}) ${String(emergencyContact.phone)}`,
    );
    lines.push("");
  }

  const recentDischarge = subset.recentDischarge as string | undefined;
  if (recentDischarge) {
    lines.push(`• Recent discharge: ${recentDischarge}`);
    lines.push("");
  }

  lines.push("⚠️ This access is fully audited.");
  const auditLine = solscanLine(outcome.auditLog?.chainRef);
  if (auditLine) lines.push(auditLine);

  return lines
    .filter((l) => l !== undefined)
    .join("\n")
    .trim();
}

function denialMessage(ctx: OutboundContext): string {
  const lines = [
    `✗ Access DENIED`,
    `• Reason: ${ctx.outcome.justification}`,
    "",
    "If this is an emergency, reply BREAK GLASS to request emergency override.",
  ];
  return lines.join("\n");
}

function awaitingHumanMessage(ctx: OutboundContext): string {
  const lines = [
    `⏸ Access request is pending patient approval`,
    `• Reason: ${ctx.outcome.justification}`,
    "",
    "Awaiting patient or supervisor approval. You will be notified when a decision is made.",
  ];
  return lines.join("\n");
}

export function formatOutbound(ctx: OutboundContext): string[] {
  const { outcome } = ctx;
  let text: string;

  if (outcome.decision === "granted") {
    if (outcome.tier === 1) {
      text = tier1Card(ctx);
    } else if (outcome.tier === 2) {
      text = tier2Card(ctx);
    } else {
      text = tier3Card(ctx);
    }
  } else if (outcome.decision === "denied") {
    text = denialMessage(ctx);
  } else {
    text = awaitingHumanMessage(ctx);
  }

  return splitMessages(text);
}

export function formatApprovalPrompt(input: {
  requesterLabel: string;
  issuerLabel: string;
  fieldsRequested: string[];
  ttlMinutes: number;
  requestId: string;
}): string {
  return [
    `🔔 Approval needed: ${input.requesterLabel} (${input.issuerLabel}) is requesting access`,
    `• Fields: ${input.fieldsRequested.join(", ")}`,
    `• Valid for: ${input.ttlMinutes} min`,
    `• Request ID: ${input.requestId}`,
    "",
    "Reply YES to approve, NO to deny.",
  ].join("\n");
}

export function formatPatientConfirmation(input: {
  requesterLabel: string;
  ttlMinutes: number;
  patientId: string;
  appBaseUrl: string;
}): string {
  return [
    `✓ Approval recorded for ${input.requesterLabel}.`,
    `• Valid for: ${input.ttlMinutes} minutes`,
    `• View details: ${input.appBaseUrl}/audit/${input.patientId}`,
  ].join("\n");
}

export function formatHelp(): string {
  const activationKeyword =
    process.env.IMESSAGE_ACTIVATION_KEYWORD ?? DEFAULT_ACTIVATION_KEYWORD;
  return [
    "Hi — I’m MedAgent.",
    `To wake me up, say: ${activationKeyword}`,
    "",
    "You can also use these commands:",
    "• /access — request access to a patient record",
    "• /approve — approve a pending request",
    "• /deny — deny a pending request",
    "• /persona — view or set your clinician persona",
    "• /status — check your current request",
    "• /audit — open the recent audit log",
    "• /help — show this message again",
    "• /end — end the current session",
  ].join("\n");
}

export function formatAskPatientId(): string {
  return "Got it — which patient do you need? Reply with the patient ID (for example: SARAHB).";
}

export function formatAskApproval(): string {
  return "Please reply YES to approve, or NO to deny.";
}

export function formatAck(): string {
  return "Thanks — I’ve received your request and I’m checking this now.";
}

export function formatFollowUpAnswer(input: {
  sessionId: string;
  answer: string;
  citedFields: string[];
}): string {
  const lines = [input.answer];
  if (input.citedFields.length > 0) {
    lines.push("", `• Sources: ${input.citedFields.join(", ")}`);
  }
  return lines.join("\n");
}
