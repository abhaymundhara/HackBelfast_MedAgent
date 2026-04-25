"use strict";

export type ParsedIntent =
  | { kind: "slash"; command: string; args: string[] }
  | { kind: "approval"; decision: "approve" | "deny" }
  | { kind: "freeform_clinician"; patientHint: string | null; emergencyMode: boolean }
  | { kind: "unknown" };

export const DEFAULT_ACTIVATION_KEYWORD = "hey baymax!";

const PATIENT_CODE_MAP: Record<string, string> = {
  SARAHB: "sarah-bennett",
  OMARH: "omar-haddad",
  LUCIAM: "lucia-martin",
};

const EMERGENCY_KEYWORDS = [
  "break glass",
  "emergency mode",
  "unconscious",
  "code blue",
  "crash call",
];

const PATIENT_HINT_RE = /patient:\s*(\S+)/i;

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

export function getActivationKeyword(): string {
  return normalizeKeyword(
    process.env.IMESSAGE_ACTIVATION_KEYWORD ?? DEFAULT_ACTIVATION_KEYWORD,
  );
}

export function stripActivationKeyword(text: string): {
  activated: boolean;
  cleanedText: string;
  keyword: string;
} {
  const keyword = getActivationKeyword();
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith(keyword)) {
    return { activated: false, cleanedText: trimmed, keyword };
  }

  const cleanedText = trimmed
    .slice(keyword.length)
    .replace(/^[\s,:;.!?-]+/, "")
    .trim();
  return { activated: true, cleanedText, keyword };
}

export function classifyIntent(text: string, awaiting: string | null): ParsedIntent {
  if (awaiting === "approval_yes_no") {
    const normalized = text.replace(/^[^\w]+/, "").trim().toUpperCase();
    if (["YES", "Y", "APPROVE"].includes(normalized)) {
      return { kind: "approval", decision: "approve" };
    }
    if (["NO", "N", "DENY"].includes(normalized)) {
      return { kind: "approval", decision: "deny" };
    }
    return { kind: "unknown" };
  }

  if (text.startsWith("/")) {
    const tokens = text.trim().split(/\s+/);
    const command = tokens[0].slice(1).toLowerCase();
    const args = tokens.slice(1);
    return { kind: "slash", command, args };
  }

  // Freeform clinician
  let patientHint: string | null = null;

  const patientMatch = PATIENT_HINT_RE.exec(text);
  if (patientMatch) {
    patientHint = patientMatch[1];
  } else {
    const upper = text.toUpperCase();
    for (const [code, id] of Object.entries(PATIENT_CODE_MAP)) {
      if (upper.includes(code)) {
        patientHint = id;
        break;
      }
    }
  }

  const lower = text.toLowerCase();
  const emergencyMode = EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));

  return { kind: "freeform_clinician", patientHint, emergencyMode };
}
