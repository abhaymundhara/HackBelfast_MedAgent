"use strict";

export type ParsedNameDob = {
  name: string;
  dob: string; // YYYY-MM-DD
};

function isDebugEnabled(): boolean {
  const raw = (process.env.IMESSAGE_DEBUG ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

function debugLog(message: string, data?: unknown) {
  if (!isDebugEnabled()) return;
  if (data === undefined) {
    console.log(`[imessage/onboarding-nlp] ${message}`);
    return;
  }
  console.log(`[imessage/onboarding-nlp] ${message}`, data);
}

function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  )
    return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function formatIsoDate(
  year: number,
  month: number,
  day: number,
): string | null {
  if (!isValidDateParts(year, month, day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthNameToNumber(input: string): number | null {
  const key = input.trim().toLowerCase().replace(/\.$/, "");
  const months: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  return months[key] ?? null;
}

function toIsoDob(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return formatIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // DD/MM/YYYY or D/M/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return formatIsoDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  // D-M-YYYY / DD-MM-YYYY (preferred for this locale)
  const dmyDash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDash) {
    const day = Number(dmyDash[1]);
    const month = Number(dmyDash[2]);
    const year = Number(dmyDash[3]);

    // If ambiguous, default to D-M-Y. If clearly M-D-Y (first > 12 impossible for month),
    // fallback to that interpretation.
    const dmyIso = formatIsoDate(year, month, day);
    if (dmyIso) return dmyIso;

    return formatIsoDate(year, day, month);
  }

  // D Mon YYYY / DMonthYYYY / D-Mon-YYYY / D Mon, YYYY
  const dMonY = raw.match(/^(\d{1,2})[\s\-]*([A-Za-z]{3,9})[\s,\-]*(\d{4})$/);
  if (dMonY) {
    const day = Number(dMonY[1]);
    const month = monthNameToNumber(dMonY[2]);
    const year = Number(dMonY[3]);
    if (!month) return null;
    return formatIsoDate(year, month, day);
  }

  // Mon D YYYY / Month D, YYYY
  const monDY = raw.match(/^([A-Za-z]{3,9})[\s\-]*(\d{1,2})[\s,\-]*(\d{4})$/);
  if (monDY) {
    const month = monthNameToNumber(monDY[1]);
    const day = Number(monDY[2]);
    const year = Number(monDY[3]);
    if (!month) return null;
    return formatIsoDate(year, month, day);
  }

  return null;
}

function parseDeterministic(input: string): ParsedNameDob | null {
  const text = input.trim();
  if (!text) return null;

  const dateToken = text.match(
    /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4}|\d{1,2}[\s\-]*[A-Za-z]{3,9}[\s,\-]*\d{4}|[A-Za-z]{3,9}[\s\-]*\d{1,2}[\s,\-]*\d{4})\b/,
  );
  if (!dateToken) return null;

  const dob = toIsoDob(dateToken[1]);
  if (!dob) return null;

  const name = text
    .replace(dateToken[1], "")
    .replace(/^(name|patient|dob)[:\s-]*/gi, "")
    .replace(/[,\-]+/g, " ")
    .trim();
  if (!name) return null;

  return { name, dob };
}

type OllamaExtraction = {
  name?: string;
  dob?: string;
  confidence?: number;
};

function parseFirstJsonObject(raw: string): OllamaExtraction | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as OllamaExtraction;
  } catch {
    return null;
  }
}

async function parseWithOllama(input: string): Promise<ParsedNameDob | null> {
  const enabled = (process.env.IMESSAGE_OLLAMA_PARSE_ENABLED ?? "true")
    .trim()
    .toLowerCase();
  if (enabled === "false" || enabled === "0" || enabled === "no") {
    debugLog("ollama parse disabled by env");
    return null;
  }

  const host = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").trim();
  const model = (process.env.OLLAMA_MODEL ?? "").trim();
  if (!model) {
    debugLog("ollama parse skipped: OLLAMA_MODEL missing");
    return null;
  }
  debugLog("ollama parse request", { host, model });

  const prompt = [
    "Extract a person's full name and date of birth from the user text.",
    "Return ONLY compact JSON with keys: name, dob, confidence.",
    "dob must be YYYY-MM-DD when possible.",
    "If unavailable, return empty strings.",
    `User text: "${input}"`,
  ].join("\n");

  const response = await fetch(`${host.replace(/\/+$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0,
      },
    }),
  });
  if (!response.ok) {
    debugLog("ollama parse failed: non-OK response", {
      status: response.status,
    });
    return null;
  }

  const payload = (await response.json()) as { response?: string };
  const parsed = parseFirstJsonObject(payload.response ?? "");
  if (!parsed?.name || !parsed?.dob) {
    debugLog("ollama parse failed: missing name/dob in model response", {
      responsePreview: (payload.response ?? "").slice(0, 240),
    });
    return null;
  }

  const dob = toIsoDob(parsed.dob);
  if (!dob) {
    debugLog("ollama parse failed: could not normalize dob", {
      dob: parsed.dob,
    });
    return null;
  }

  debugLog("ollama parse success", { name: parsed.name, dob });
  return {
    name: parsed.name.trim(),
    dob,
  };
}

export async function parseNameDobInput(
  input: string,
): Promise<ParsedNameDob | null> {
  debugLog("parse input", { input });
  const deterministic = parseDeterministic(input);
  if (deterministic) {
    debugLog("deterministic parse success", deterministic);
    return deterministic;
  }
  debugLog("deterministic parse failed; falling back to ollama");

  try {
    const parsed = await parseWithOllama(input);
    if (!parsed) {
      debugLog("ollama parse returned null");
    }
    return parsed;
  } catch (err) {
    debugLog(
      "ollama parse exception",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
