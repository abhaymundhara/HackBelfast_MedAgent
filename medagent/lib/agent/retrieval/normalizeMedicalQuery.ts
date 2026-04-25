import { NormalizedMedicalQuery } from "@/lib/agent/retrieval/retrievalTypes";

type NormalizeMedicalQueryInput = {
  query: string;
  focusAreas?: string[];
};

const KNOWN_FIELD_HINTS = new Set([
  "demographics",
  "allergies",
  "medications",
  "conditions",
  "alerts",
  "emergencycontact",
  "recentdischarge",
  "documents",
]);

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "need",
  "check",
  "pull",
  "show",
  "before",
  "after",
  "about",
  "this",
  "that",
  "current",
  "context",
  "details",
  "relevant",
  "immediate",
]);

const QUERY_EXPANSIONS: Array<{ test: RegExp; terms: string[] }> = [
  { test: /\b(anaphylaxis|allerg(y|ic)|reaction|intolerance)\b/i, terms: ["allergy", "anaphylaxis", "reaction"] },
  { test: /\b(medication|medications|drug|dose|anticoag|insulin)\b/i, terms: ["medication", "drug", "dose", "contraindication"] },
  { test: /\b(condition|history|chronic|lab|trend|diagnosis)\b/i, terms: ["condition", "history", "lab", "trend"] },
  { test: /\b(alert|risk|contraindication|red flag|warning)\b/i, terms: ["alert", "risk", "contraindication"] },
  { test: /\b(emergency contact|next of kin|consent|guardian|family)\b/i, terms: ["contact", "phone", "relationship", "emergency"] },
  { test: /\b(discharge|follow[\s-]?up|hospitali[sz]ation|disposition)\b/i, terms: ["discharge", "followup", "hospitalization"] },
  { test: /\b(document|documents|report|upload|procedure|care plan|social history)\b/i, terms: ["document", "report", "procedure", "care", "plan"] },
];

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeWhitespace(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanKeywordToken(token: string) {
  return token
    .replace(/^[^a-z0-9%+\-/_.]+/g, "")
    .replace(/[^a-z0-9%+\-/_.]+$/g, "");
}

function extractPhraseTerms(query: string) {
  const phrases: string[] = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  for (const match of query.matchAll(re)) {
    const phrase = normalizeWhitespace(match[1] ?? "");
    if (phrase.length > 1) {
      phrases.push(phrase);
    }
  }
  return dedupe(phrases);
}

function extractKeywordTerms(normalizedQuery: string, phraseTerms: string[]) {
  const removedPhrases = phraseTerms.reduce(
    (acc, phrase) => acc.split(phrase).join(" "),
    normalizedQuery,
  );

  const terms = removedPhrases
    .split(/\s+/)
    .map(cleanKeywordToken)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));

  for (const expansion of QUERY_EXPANSIONS) {
    if (!expansion.test.test(normalizedQuery)) continue;
    for (const term of expansion.terms) {
      terms.push(term);
    }
  }

  return dedupe(terms);
}

function normalizeFieldHint(value: string) {
  const compact = value.toLowerCase().replace(/[^a-z]/g, "");
  return compact === "emergencycontact"
    ? "emergencyContact"
    : compact === "recentdischarge"
      ? "recentDischarge"
      : compact;
}

function inferFieldHints(
  normalizedQuery: string,
  focusAreas: string[] | undefined,
): string[] {
  const hints = dedupe(
    (focusAreas ?? []).map((value) => value.trim()).filter(Boolean),
  );

  for (const match of normalizedQuery.matchAll(/\bfield:([a-zA-Z_]+)\b/g)) {
    if (match[1]) {
      hints.push(match[1]);
    }
  }

  if (/\b(anaphylaxis|allerg(y|ic)|reaction|intolerance)\b/i.test(normalizedQuery)) {
    hints.push("allergies");
  }
  if (/\b(medication|medications|drug|dose|anticoag|insulin)\b/i.test(normalizedQuery)) {
    hints.push("medications");
  }
  if (/\b(condition|history|chronic|lab|trend|diagnosis)\b/i.test(normalizedQuery)) {
    hints.push("conditions");
  }
  if (/\b(alert|risk|contraindication|red flag|warning)\b/i.test(normalizedQuery)) {
    hints.push("alerts");
  }
  if (/\b(emergency contact|next of kin|consent|guardian|family)\b/i.test(normalizedQuery)) {
    hints.push("emergencyContact");
  }
  if (/\b(discharge|follow[\s-]?up|hospitali[sz]ation|disposition)\b/i.test(normalizedQuery)) {
    hints.push("recentDischarge");
  }
  if (/\b(document|documents|report|upload|procedure|care plan|social history)\b/i.test(normalizedQuery)) {
    hints.push("documents");
  }
  if (/\bcare plan\b/i.test(normalizedQuery)) {
    hints.push("alerts");
  }

  return dedupe(hints)
    .map(normalizeFieldHint)
    .filter((value) => KNOWN_FIELD_HINTS.has(value.toLowerCase()));
}

export function normalizeMedicalQuery(
  input: NormalizeMedicalQueryInput,
): NormalizedMedicalQuery {
  const rawQuery = input.query ?? "";
  const normalizedQuery = normalizeWhitespace(rawQuery);
  const phraseTerms = extractPhraseTerms(normalizedQuery);
  const keywordTerms = extractKeywordTerms(normalizedQuery, phraseTerms);
  const fieldHints = inferFieldHints(normalizedQuery, input.focusAreas);

  return {
    rawQuery,
    normalizedQuery,
    phraseTerms,
    keywordTerms,
    fieldHints: fieldHints.length ? fieldHints : undefined,
  };
}
