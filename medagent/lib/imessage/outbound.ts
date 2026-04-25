"use strict";

import type { MedAgentOutcome } from "@/lib/types";
import { getActivationKeyword } from "./intents";

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
  if (chainRef.startsWith("local-solana:")) return "Audit logged locally";
  return `Solana audit: https://solscan.io/tx/${chainRef}?cluster=devnet`;
}

function formatLanguages(value: unknown): string | null {
  if (Array.isArray(value)) {
    const languages = value.filter(
      (language): language is string => typeof language === "string",
    );
    return languages.length ? languages.join(", ") : null;
  }
  if (typeof value === "string") {
    const language = value.trim();
    return language || null;
  }
  return null;
}

function grantCard(ctx: OutboundContext): string {
  const { outcome } = ctx;
  const subset = outcome.summarySubset ?? {};
  const lines: string[] = ["✓ MedAgent · ACCESS GRANTED", ""];

  const demographics = subset.demographics as
    | Record<string, unknown>
    | undefined;
  if (demographics) {
    const parts = [
      demographics.name,
      demographics.dob,
      demographics.bloodType,
    ].filter(Boolean);
    if (parts.length) lines.push(`Patient: ${parts.join(", ")}`);
    if (demographics.homeCountry) {
      lines.push(`Home: ${String(demographics.homeCountry)}`);
    }
    const languages = formatLanguages(demographics.languages);
    if (languages) lines.push(`Languages: ${languages}`);
    lines.push("");
  }

  const allergies = subset.allergies as
    | Array<Record<string, unknown>>
    | undefined;
  if (allergies?.length) {
    lines.push("⚠️ ALLERGIES");
    for (const a of allergies) {
      lines.push(
        `• ${String(a.substance)} (${String(a.severity)})${a.reaction ? " — " + String(a.reaction) : ""}`,
      );
    }
    lines.push("");
  }

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
      `Emergency contact: ${String(emergencyContact.name)} (${String(emergencyContact.relation)}) ${String(emergencyContact.phone)}`,
    );
    lines.push("");
  }

  const recentDischarge = subset.recentDischarge as string | undefined;
  if (recentDischarge) {
    lines.push(`Recent discharge: ${recentDischarge}`);
    lines.push("");
  }

  const auditLine = solscanLine(outcome.auditLog?.chainRef);
  if (auditLine) lines.push(auditLine);

  if (outcome.expiresAt) {
    lines.push(`Session expires: ${outcome.expiresAt}`);
  }
  lines.push("Reply with a question to query fields. Reply /end to close.");

  return lines.join("\n").trim();
}

export function formatOutbound(ctx: OutboundContext): string[] {
  return splitMessages(grantCard(ctx));
}

export function formatApprovalPrompt(input: {
  requesterLabel: string;
  issuerLabel: string;
  fieldsRequested: string[];
  ttlMinutes: number;
  requestId: string;
}): string {
  return [
    `🔔 ${input.requesterLabel} (${input.issuerLabel}) is requesting access to your record.`,
    `Request ID: ${input.requestId}`,
  ].join("\n");
}

export function formatPatientConfirmation(input: {
  requesterLabel: string;
  ttlMinutes: number;
  patientId: string;
  appBaseUrl: string;
}): string {
  return [
    `✓ Access granted to ${input.requesterLabel}.`,
    `View audit: ${input.appBaseUrl}/audit/${input.patientId}`,
  ].join("\n");
}

export function formatHelp(): string {
  const activationKeyword = getActivationKeyword();
  return [
    "MedAgent commands:",
    `Wake word: ${activationKeyword}`,
    "",
    "• /access <patient> — request record access",
    "• /approve — approve a pending request",
    "• /deny — deny a pending request",
    "• /status — check active request",
    "• /audit <patient> — view audit log",
    "• /persona <id> — set clinician persona",
    "• /end — end session",
    "• /help — show this message",
  ].join("\n");
}

export function formatAskPatientId(): string {
  return "Got it — which patient do you need? Reply with the patient ID (for example: SARAHB).";
}

export function formatAskApproval(): string {
  return "Please reply YES to approve, or NO to deny.";
}

export function formatAck(): string {
  return "Thanks — I’ve received your request and I’m working on it now.";
}

export function formatAppointmentShareCreated(input: {
  doctorName: string;
  shareUrl: string;
  dashboardUrl: string;
}) {
  return [
    `Shared your full uploaded medical record with ${input.doctorName}.`,
    `Doctor access link: ${input.shareUrl}`,
    "",
    "You can revoke future live access from your dashboard.",
    input.dashboardUrl,
  ].join("\n");
}

export function formatFollowUpAnswer(input: {
  sessionId: string;
  answer: string;
  citedFields: string[];
}): string {
  const lines = [input.answer];
  if (input.citedFields.length > 0) {
    lines.push("", `Sources: ${input.citedFields.join(", ")}`);
  }
  return lines.join("\n");
}
