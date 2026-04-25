import crypto from "crypto";
import { sha256Hash } from "@/lib/crypto";
import { DEMO_PATIENTS } from "@/lib/ips/seed";
import { RagIndex } from "@/lib/rag/ragIndex";
import { IndexStats, RetrievalResult } from "@/lib/rag/ragTypes";
import { CanonicalEvidenceItem } from "@/lib/agent/state";

const index = new RagIndex();
let seeded = false;

const SENSITIVE_TYPES = new Set(["mental_health", "genetic"]);
const CRITICAL_TYPES = new Set([
  "allergy",
  "adverse_reaction",
  "risk_episode",
  "medication_safety",
  "chronic_condition",
  "lab_trend",
]);

function toCanonicalItem(
  patientHash: string,
  type: string,
  content: string,
  timestampIso: string,
): CanonicalEvidenceItem {
  const isSensitive = SENSITIVE_TYPES.has(type);
  const isCritical = CRITICAL_TYPES.has(type);

  // Set the structural properties according to your requested rules
  const allowedTiers: (1 | 2 | 3)[] = (
    isCritical ? [1, 2, 3] : isSensitive ? [1] : [1, 2]
  ) as any;
  const sensClass = isCritical
    ? "critical_only"
    : isSensitive
      ? "sensitive"
      : "standard";

  const fieldKeyByType: Record<string, string> = {
    allergy: "allergies",
    adverse_reaction: "allergies",
    medication_safety: "medications",
    lab_trend: "conditions",
    risk_episode: "alerts",
    chronic_condition: "conditions",
    procedure_history: "recentDischarge",
    care_plan: "alerts",
    social_history: "documents",
    mental_health: "conditions",
    genetic: "conditions",
  };

  return {
    id: crypto.randomUUID(),
    patientHash,
    content,

    authorization: {
      fieldKey: fieldKeyByType[type] ?? "documents",
      allowedForTiers: allowedTiers,
      sensitivityClass: sensClass,
      requiresExplicitApproval: false,
    },

    sourceType: "document",
    noteType: type,
    extractionMode: "narrative",
    sensitivityTags: isSensitive ? ["sensitive"] : [],
    clinicalTags: isCritical ? ["critical"] : [],
    recencyBucket: "historical",
    language: "en",

    provenance: {
      timestamp: timestampIso,
    },
  };
}

function buildDemoChunks(): CanonicalEvidenceItem[] {
  const sarah = DEMO_PATIENTS.find(
    (patient) => patient.patientId === "sarah-bennett",
  );
  const omar = DEMO_PATIENTS.find(
    (patient) => patient.patientId === "omar-haddad",
  );
  const lucia = DEMO_PATIENTS.find(
    (patient) => patient.patientId === "lucia-mendes",
  );

  if (!sarah || !omar || !lucia) {
    throw new Error(
      "Demo seed integrity error: missing one or more required demo patients (sarah-bennett, omar-haddad, lucia-mendes).",
    );
  }

  const sarahHash = sha256Hash(
    `${sarah.patientId}:${sarah.summary.demographics.email}`,
  );
  const omarHash = sha256Hash(
    `${omar.patientId}:${omar.summary.demographics.email}`,
  );
  const luciaHash = sha256Hash(
    `${lucia.patientId}:${lucia.summary.demographics.email}`,
  );

  return [
    toCanonicalItem(
      sarahHash,
      "allergy",
      "Severe penicillin allergy with prior anaphylaxis in 2018. Strict beta-lactam avoidance recommended.",
      "2026-03-22T09:30:00.000Z",
    ),
    toCanonicalItem(
      sarahHash,
      "medication_safety",
      "Warfarin 5 mg nightly for atrial fibrillation. Confirm INR before invasive procedures or IM injection.",
      "2026-03-20T13:00:00.000Z",
    ),
    toCanonicalItem(
      sarahHash,
      "lab_trend",
      "INR trend over 10 days: 2.3, 2.4, 2.2. Therapeutic and stable.",
      "2026-03-18T10:15:00.000Z",
    ),
    toCanonicalItem(
      sarahHash,
      "risk_episode",
      "Minor head trauma episode while anticoagulated. CT negative, observed overnight.",
      "2026-03-14T16:40:00.000Z",
    ),
    toCanonicalItem(
      sarahHash,
      "chronic_condition",
      "Chronic atrial fibrillation with episodic palpitations.",
      "2026-02-28T08:00:00.000Z",
    ),
    toCanonicalItem(
      sarahHash,
      "adverse_reaction",
      "Developed urticaria and wheeze after amoxicillin challenge.",
      "2026-02-20T12:20:00.000Z",
    ),
    toCanonicalItem(
      sarahHash,
      "care_plan",
      "Emergency care plan: prioritize airway, avoid penicillin-class antibiotics.",
      "2026-02-11T11:11:00.000Z",
    ),
    toCanonicalItem(
      sarahHash,
      "procedure_history",
      "Recent discharge after AF observation. Follow-up INR checks completed.",
      "2026-01-19T14:00:00.000Z",
    ),
    toCanonicalItem(
      sarahHash,
      "mental_health",
      "Travel anxiety noted after prior emergency admission.",
      "2025-12-02T09:10:00.000Z",
    ),
    toCanonicalItem(
      sarahHash,
      "genetic",
      "Family history suggests inherited thrombophilia tendency.",
      "2025-10-03T09:10:00.000Z",
    ),

    // Omar
    toCanonicalItem(
      omarHash,
      "chronic_condition",
      "Type 2 diabetes with intermittent fasting hyperglycemia.",
      "2026-04-02T07:45:00.000Z",
    ),
    toCanonicalItem(
      omarHash,
      "lab_trend",
      "HbA1c trend: 8.2% to 7.6% over 4 months.",
      "2026-03-26T08:30:00.000Z",
    ),
    toCanonicalItem(
      omarHash,
      "risk_episode",
      "Near-syncope episode after prolonged fasting. Capillary glucose was 58 mg/dL.",
      "2026-03-22T17:40:00.000Z",
    ),
    toCanonicalItem(
      omarHash,
      "medication_safety",
      "Metformin tolerated. Hold metformin if acute kidney injury.",
      "2026-03-18T12:00:00.000Z",
    ),
    toCanonicalItem(
      omarHash,
      "allergy",
      "Sulfa allergy causes diffuse rash and pruritus.",
      "2026-03-05T09:20:00.000Z",
    ),
    toCanonicalItem(
      omarHash,
      "adverse_reaction",
      "Mild gastrointestinal intolerance after metformin dose escalation.",
      "2026-02-15T16:00:00.000Z",
    ),
    toCanonicalItem(
      omarHash,
      "care_plan",
      "Emergency plan: treat hypoglycemia rapidly.",
      "2026-01-30T10:00:00.000Z",
    ),
    toCanonicalItem(
      omarHash,
      "social_history",
      "Frequent business travel with irregular meal timing.",
      "2025-12-10T11:35:00.000Z",
    ),
    toCanonicalItem(
      omarHash,
      "mental_health",
      "Stress-related insomnia during work deadlines.",
      "2025-11-24T08:40:00.000Z",
    ),
    toCanonicalItem(
      omarHash,
      "genetic",
      "Family clustering of early-onset diabetes.",
      "2025-11-01T09:20:00.000Z",
    ),

    // Lucia
    toCanonicalItem(
      luciaHash,
      "chronic_condition",
      "Epilepsy currently controlled on levetiracetam.",
      "2026-04-05T06:50:00.000Z",
    ),
    toCanonicalItem(
      luciaHash,
      "medication_safety",
      "Levetiracetam. Missed doses associated with breakthrough seizure.",
      "2026-03-28T13:05:00.000Z",
    ),
    toCanonicalItem(
      luciaHash,
      "risk_episode",
      "Breakthrough seizure followed 24-hour medication gap.",
      "2026-03-17T15:00:00.000Z",
    ),
    toCanonicalItem(
      luciaHash,
      "allergy",
      "Severe latex allergy. Non-latex equipment mandatory.",
      "2026-03-01T09:40:00.000Z",
    ),
    toCanonicalItem(
      luciaHash,
      "adverse_reaction",
      "Prior postictal agitation after prolonged seizure episode.",
      "2026-02-24T08:20:00.000Z",
    ),
    toCanonicalItem(
      luciaHash,
      "lab_trend",
      "Therapeutic anticonvulsant level remained stable.",
      "2026-02-12T10:10:00.000Z",
    ),
    toCanonicalItem(
      luciaHash,
      "care_plan",
      "Emergency protocol: airway protection, avoid latex.",
      "2026-01-28T07:30:00.000Z",
    ),
    toCanonicalItem(
      luciaHash,
      "procedure_history",
      "Observed overnight after seizure in ED.",
      "2025-12-30T12:00:00.000Z",
    ),
    toCanonicalItem(
      luciaHash,
      "mental_health",
      "Post-seizure anticipatory anxiety noted.",
      "2025-11-25T09:55:00.000Z",
    ),
    toCanonicalItem(
      luciaHash,
      "genetic",
      "Family history includes first-degree relative with seizure disorder.",
      "2025-10-08T09:55:00.000Z",
    ),
  ];
}

function ensureSeeded() {
  if (seeded) {
    return;
  }
  seedDemoPatients();
}

/**
 * Seeds in-memory demo notes and rebuilds the index.
 */
export function seedDemoPatients() {
  const chunks = buildDemoChunks();
  index.buildIndex(chunks);
  seeded = true;
}

/**
 * Retrieve top-k chunks using hybrid lexical + trigram scoring.
 * (The deterministic evidence firewall enforces the actual redaction later).
 */
export async function retrieve(
  patientHash: string,
  query: string,
  topK = 5,
): Promise<RetrievalResult[]> {
  ensureSeeded();

  const raw = index.query(patientHash, query, topK);
  return raw;
}

export function getIndexStats(): IndexStats {
  ensureSeeded();
  return index.getStats();
}

export function resetRagForTests() {
  index.clear();
  seeded = false;
}

/**
 * Index a patient's uploaded document into the live RAG index.
 * Called after PDF onboarding to make the patient's record queryable.
 */
export function indexPatientDocument(input: {
  patientHash: string;
  rawText: string;
  patientId: string;
  documentId: string;
}) {
  ensureSeeded();

  const sections = chunkMedicalText(input.rawText, input.patientHash);
  for (const chunk of sections) {
    index.addChunk(chunk);
  }
}

/**
 * Split medical report text into typed RAG chunks by detected sections.
 */
function chunkMedicalText(
  rawText: string,
  patientHash: string,
): CanonicalEvidenceItem[] {
  const chunks: CanonicalEvidenceItem[] = [];
  const now = new Date().toISOString();

  const sectionMap: Array<{
    labels: RegExp;
    noteType: string;
  }> = [
    { labels: /\b(?:allerg(?:ies|y)|adverse reactions?)\b/i, noteType: "allergy" },
    { labels: /\b(?:current )?medications?\b|medicines\b/i, noteType: "medication_safety" },
    { labels: /\b(?:active |major )?conditions?\b|diagnoses|problems\b/i, noteType: "chronic_condition" },
    { labels: /\bemergency (?:contact|alerts?)\b/i, noteType: "care_plan" },
    { labels: /\brecent discharge\b/i, noteType: "procedure_history" },
    { labels: /\bblood type\b/i, noteType: "lab_trend" },
  ];

  // Extract sections by splitting on known headings
  const headingPattern =
    /\n\s*((?:allergies?|known allergies?|adverse reactions?|current medications?|medications?|medicines|active conditions?|major conditions?|conditions?|diagnoses|problems|emergency contact|next of kin|blood type|recent discharge|emergency alerts?|alerts?)\s*:?)/gi;

  const lines = rawText.split("\n");
  let currentSection = "general";
  let currentLines: string[] = [];
  const sectionChunks: Array<{ heading: string; text: string }> = [];

  for (const line of lines) {
    const match = headingPattern.exec(line);
    if (match) {
      if (currentLines.length > 0) {
        sectionChunks.push({
          heading: currentSection,
          text: currentLines.join("\n").trim(),
        });
      }
      currentSection = match[1].replace(/\s*:?\s*$/, "").trim().toLowerCase();
      currentLines = [line.replace(match[1], "").trim()].filter(Boolean);
      headingPattern.lastIndex = 0;
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    sectionChunks.push({
      heading: currentSection,
      text: currentLines.join("\n").trim(),
    });
  }

  for (const section of sectionChunks) {
    if (!section.text || section.text.length < 10) continue;

    let noteType = "care_plan";
    for (const mapping of sectionMap) {
      if (mapping.labels.test(section.heading)) {
        noteType = mapping.noteType;
        break;
      }
    }

    chunks.push(
      toCanonicalItem(patientHash, noteType, section.text, now),
    );
  }

  // If no sections were detected, index the whole text as a single chunk
  if (chunks.length === 0 && rawText.trim().length >= 40) {
    chunks.push(toCanonicalItem(patientHash, "care_plan", rawText.trim(), now));
  }

  return chunks;
}

if (process.env.NODE_ENV !== "test") {
  setImmediate(() => {
    if (!seeded) {
      seedDemoPatients();
    }
  });
}
