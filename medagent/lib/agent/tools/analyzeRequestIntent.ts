import {
  RequestIntent,
  RequestIntentSchema,
  ReleasedField,
} from "@/lib/types";

const FIELD_INTENT_MAP: Record<
  ReleasedField,
  { keywords: string[]; topic: string; question: string; label: string }
> = {
  allergies: {
    keywords: [
      "allergy",
      "allergies",
      "allergic",
      "anaphylaxis",
      "reaction",
      "rash",
    ],
    topic: "allergy safety",
    question:
      "What allergy risk is most clinically important in this authorized dataset?",
    label: "allergies",
  },
  medications: {
    keywords: [
      "medication",
      "medications",
      "medicine",
      "medicines",
      "meds",
      "drug",
      "dose",
      "dosing",
      "anticoagulant",
      "warfarin",
      "insulin",
    ],
    topic: "medication safety",
    question:
      "Which medications in this authorized dataset could change immediate treatment decisions?",
    label: "medications",
  },
  conditions: {
    keywords: [
      "condition",
      "conditions",
      "history",
      "diagnosis",
      "diagnoses",
      "seizure",
      "epilepsy",
      "diabetes",
      "asthma",
      "atrial fibrillation",
      "implant",
    ],
    topic: "relevant history",
    question:
      "Which recorded conditions are most relevant to this presentation?",
    label: "conditions",
  },
  alerts: {
    keywords: [
      "alert",
      "alerts",
      "risk",
      "contraindication",
      "critical",
      "warning",
      "bleeding",
      "implant",
      "dnr",
    ],
    topic: "critical alerts",
    question:
      "What critical alerts or contraindications should be considered first?",
    label: "alerts",
  },
  emergencyContact: {
    keywords: [
      "contact",
      "family",
      "next of kin",
      "relative",
      "call",
      "notify",
    ],
    topic: "family contact",
    question:
      "Who can be contacted from this authorized session if escalation is needed?",
    label: "emergency contact",
  },
  recentDischarge: {
    keywords: [
      "discharge",
      "discharged",
      "discharge summary",
      "recent discharge",
      "hospital",
      "admission",
      "admitted",
      "recent stay",
      "recent hospitalization",
    ],
    topic: "recent discharge context",
    question:
      "What recent discharge context is available in this tier?",
    label: "recent discharge summary",
  },
  documents: {
    keywords: [
      "document",
      "documents",
      "letter",
      "note",
      "report",
      "attachment",
      "attachments",
      "insurance",
      "card",
      "pdf",
    ],
    topic: "supporting documents",
    question:
      "Which supporting documents are available in this authorized session?",
    label: "supporting documents",
  },
};

const DEFAULT_FIELD_ORDER: ReleasedField[] = [
  "allergies",
  "medications",
  "alerts",
  "conditions",
  "emergencyContact",
  "recentDischarge",
  "documents",
];

function normalize(input: string) {
  return input.toLowerCase();
}

function findFirstKeywordIndex(text: string, keywords: string[]) {
  const indices = keywords
    .map((keyword) => text.indexOf(keyword))
    .filter((index) => index >= 0);
  return indices.length ? Math.min(...indices) : null;
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}

function formatFieldLabels(fields: ReleasedField[]) {
  return fields.map((field) => FIELD_INTENT_MAP[field].label).join(", ");
}

export function sortFieldsByIntent(
  fieldsAllowed: ReleasedField[],
  intent: RequestIntent,
) {
  const matchRank = new Map(
    intent.matchedAuthorizedFields.map((field, index) => [field, index]),
  );

  return [...fieldsAllowed].sort((left, right) => {
    const leftRank = matchRank.get(left);
    const rightRank = matchRank.get(right);

    if (leftRank !== undefined && rightRank !== undefined) {
      return leftRank - rightRank;
    }
    if (leftRank !== undefined) {
      return -1;
    }
    if (rightRank !== undefined) {
      return 1;
    }

    return DEFAULT_FIELD_ORDER.indexOf(left) - DEFAULT_FIELD_ORDER.indexOf(right);
  });
}

export function analyzeRequestIntent(input: {
  naturalLanguageRequest: string;
  fieldsAllowed: ReleasedField[];
}): RequestIntent {
  const request = normalize(input.naturalLanguageRequest);

  const requestedFields = dedupe(
    (Object.entries(FIELD_INTENT_MAP) as [
      ReleasedField,
      (typeof FIELD_INTENT_MAP)[ReleasedField],
    ][])
      .map(([field, config]) => ({
        field,
        index: findFirstKeywordIndex(request, config.keywords),
      }))
      .filter(
        (item): item is { field: ReleasedField; index: number } =>
          item.index !== null,
      )
      .sort((left, right) => left.index - right.index)
      .map((item) => item.field),
  );

  const fallbackRequestedFields = requestedFields.length
    ? requestedFields
    : input.fieldsAllowed.slice(0, Math.min(3, input.fieldsAllowed.length));

  const matchedAuthorizedFields = fallbackRequestedFields.filter((field) =>
    input.fieldsAllowed.includes(field),
  );
  const withheldRequestedFields = requestedFields.filter(
    (field) => !input.fieldsAllowed.includes(field),
  );

  const priorityTopics = dedupe(
    matchedAuthorizedFields.length
      ? matchedAuthorizedFields.map((field) => FIELD_INTENT_MAP[field].topic)
      : input.fieldsAllowed
          .slice(0, Math.min(2, input.fieldsAllowed.length))
          .map((field) => FIELD_INTENT_MAP[field].topic),
  );

  const intentSummaryParts = [];

  if (matchedAuthorizedFields.length) {
    intentSummaryParts.push(
      `The clinician emphasized ${formatFieldLabels(matchedAuthorizedFields)}.`,
    );
  } else {
    intentSummaryParts.push(
      "The request was broad, so MedAgent prioritized the highest-signal fields available in this tier.",
    );
  }

  if (withheldRequestedFields.length) {
    intentSummaryParts.push(
      `The request also asked for ${formatFieldLabels(withheldRequestedFields)}, but that remains withheld in this tier.`,
    );
  } else {
    intentSummaryParts.push(
      "MedAgent kept the response strictly within the already-authorized dataset.",
    );
  }

  const suggestedQuestions = dedupe(
    matchedAuthorizedFields.length
      ? matchedAuthorizedFields.map((field) => FIELD_INTENT_MAP[field].question)
      : input.fieldsAllowed
          .slice(0, Math.min(2, input.fieldsAllowed.length))
          .map((field) => FIELD_INTENT_MAP[field].question),
  ).slice(0, 3);

  return RequestIntentSchema.parse({
    intentSummary: intentSummaryParts.join(" "),
    priorityTopics,
    matchedAuthorizedFields,
    withheldRequestedFields,
    suggestedQuestions,
  });
}
