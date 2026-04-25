import fs from "fs";
import path from "path";

import { getPatientRow, getPatientRowByHash } from "@/lib/db";
import {
  GoldRetrievalExample,
  RetrievalEvalDataset,
  RetrievalEvalDatasetSchema,
} from "@/lib/rag/eval/retrievalEvalTypes";

export const DEFAULT_DATASET_PATH = path.join(
  process.cwd(),
  "lib",
  "rag",
  "eval",
  "fixtures",
  "retrieval-eval-dataset.json",
);

export function loadRetrievalEvalDataset(
  filePath = DEFAULT_DATASET_PATH,
): RetrievalEvalDataset {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return RetrievalEvalDatasetSchema.parse(parsed);
}

export function saveRetrievalEvalDataset(
  dataset: RetrievalEvalDataset,
  filePath = DEFAULT_DATASET_PATH,
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2));
}

export function mapPatientHashToPatientId(patientHash: string) {
  const row = getPatientRowByHash(patientHash);
  return row?.id;
}

export function buildDefaultEvalDataset(
  examples?: GoldRetrievalExample[],
): RetrievalEvalDataset {
  const sarahHash = getPatientRow("sarah-bennett")?.patient_hash ?? "unknown";
  const omarHash = getPatientRow("omar-haddad")?.patient_hash ?? "unknown";

  return RetrievalEvalDatasetSchema.parse({
    name: "medagent-default-retrieval-eval",
    version: "1",
    metadata: {
      syntheticData: true,
      evidenceValidationMode: "aggregate_metrics_only",
      notes:
        "All patient references in this dataset are synthetic. expectedEvidenceIds remains empty because this evaluation focuses on aggregate retrieval metrics.",
    },
    examples: examples ?? [
      {
        id: "eval-patient-001-allergy-medication",
        naturalLanguageRequest:
          "Need allergy and medication safety context for emergency treatment.",
        patientHash: sarahHash,
        expectedFieldKeys: ["allergies", "medications", "alerts"],
        expectedNoteTypes: [
          "allergy_record",
          "medication_record",
          "medical_alert",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.7,
        metadataTags: ["emergency", "tiered"],
      },
      {
        id: "eval-patient-002-condition-alert",
        naturalLanguageRequest:
          "Need history and contraindication context before treatment.",
        patientHash: omarHash,
        expectedFieldKeys: ["conditions", "alerts", "medications"],
        expectedNoteTypes: [
          "condition_record",
          "medical_alert",
          "medication_record",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.7,
        metadataTags: ["emergency", "history"],
      },
      {
        id: "eval-patient-001-anaphylaxis-rapid-check",
        naturalLanguageRequest:
          "Possible anaphylaxis. Pull immediate allergy triggers, active meds, and critical alerts.",
        patientHash: sarahHash,
        expectedFieldKeys: ["allergies", "medications", "alerts"],
        expectedNoteTypes: [
          "allergy_record",
          "medication_record",
          "medical_alert",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.8,
        metadataTags: ["emergency", "allergy"],
      },
      {
        id: "eval-patient-001-discharge-followup",
        naturalLanguageRequest:
          "Summarize recent discharge and key follow up risks before prescribing.",
        patientHash: sarahHash,
        expectedFieldKeys: ["recentDischarge", "conditions", "medications"],
        expectedNoteTypes: [
          "discharge_summary",
          "procedure_history",
          "condition_record",
          "medication_record",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.3,
        metadataTags: ["recent_admission", "handoff"],
      },
      {
        id: "eval-patient-001-lab-trend-risk",
        naturalLanguageRequest:
          "Check relevant lab trends and condition risks affecting acute care choices.",
        patientHash: sarahHash,
        expectedFieldKeys: ["conditions", "alerts"],
        expectedNoteTypes: ["lab_trend", "condition_record", "medical_alert"],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.6,
        metadataTags: ["labs", "risk_screen"],
      },
      {
        id: "eval-patient-001-contact-and-care-plan",
        naturalLanguageRequest:
          "Need emergency contact details and current care plan context.",
        patientHash: sarahHash,
        expectedFieldKeys: ["emergencyContact", "alerts", "documents"],
        expectedNoteTypes: ["contact_info", "care_plan", "social_history"],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.25,
        metadataTags: ["emergency", "coordination"],
      },
      {
        id: "eval-patient-001-document-history",
        naturalLanguageRequest:
          "Retrieve prior clinical documents and procedural history relevant to this visit.",
        patientHash: sarahHash,
        expectedFieldKeys: ["documents", "conditions"],
        expectedNoteTypes: ["upload", "procedure_history", "condition_record"],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.25,
        metadataTags: ["documents", "history"],
      },
      {
        id: "eval-patient-002-anticoagulation-safety",
        naturalLanguageRequest:
          "Before treatment, retrieve anticoagulation medication safety and alert context.",
        patientHash: omarHash,
        expectedFieldKeys: ["medications", "alerts", "conditions"],
        expectedNoteTypes: [
          "medication_record",
          "medical_alert",
          "condition_record",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.65,
        metadataTags: ["medication_safety", "emergency"],
      },
      {
        id: "eval-patient-002-chronic-and-labs",
        naturalLanguageRequest:
          "Need chronic disease history plus meaningful lab trend context.",
        patientHash: omarHash,
        expectedFieldKeys: ["conditions", "medications"],
        expectedNoteTypes: [
          "condition_record",
          "lab_trend",
          "medication_record",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.3,
        metadataTags: ["chronic", "labs"],
      },
      {
        id: "eval-patient-002-post-discharge-redflags",
        naturalLanguageRequest:
          "Check recent hospitalization discharge guidance and red flag alerts.",
        patientHash: omarHash,
        expectedFieldKeys: ["recentDischarge", "alerts", "conditions"],
        expectedNoteTypes: [
          "discharge_summary",
          "procedure_history",
          "medical_alert",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.3,
        metadataTags: ["recent_admission", "alerts"],
      },
      {
        id: "eval-patient-002-acute-emergency-brief",
        naturalLanguageRequest:
          "Provide an emergency brief with contraindications, meds, and high risk condition context.",
        patientHash: omarHash,
        expectedFieldKeys: ["alerts", "medications", "conditions"],
        expectedNoteTypes: [
          "medical_alert",
          "medication_record",
          "condition_record",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.7,
        metadataTags: ["emergency", "brief"],
      },
      {
        id: "eval-patient-001-discharge-care-plan",
        naturalLanguageRequest:
          "Retrieve discharge summary and care plan details relevant to immediate follow up.",
        patientHash: sarahHash,
        expectedFieldKeys: ["recentDischarge", "documents", "alerts"],
        expectedNoteTypes: [
          "discharge_summary",
          "care_plan",
          "procedure_history",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.3,
        metadataTags: ["care_plan", "follow_up"],
      },
      {
        id: "eval-patient-002-contact-consent-context",
        naturalLanguageRequest:
          "Need emergency contact and social history context for urgent consent workflow.",
        patientHash: omarHash,
        expectedFieldKeys: ["emergencyContact", "documents"],
        expectedNoteTypes: ["contact_info", "social_history"],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.6,
        metadataTags: ["emergency_contact", "workflow", "emergency"],
      },
      {
        id: "eval-patient-001-contraindication-triage",
        naturalLanguageRequest:
          "Triage contraindications using allergies, active medications, and critical alerts.",
        patientHash: sarahHash,
        expectedFieldKeys: ["medications", "allergies", "alerts"],
        expectedNoteTypes: [
          "medication_record",
          "allergy_record",
          "medical_alert",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.4,
        metadataTags: ["triage", "contraindication"],
      },
      {
        id: "eval-patient-001-acronym-sob-rr",
        naturalLanguageRequest:
          "ED handoff: SOB and wheeze. Need RR and adverse reaction history, active meds, and urgent risk flags.",
        patientHash: sarahHash,
        expectedFieldKeys: ["allergies", "medications", "alerts"],
        expectedNoteTypes: [
          "allergy_record",
          "medication_record",
          "medical_alert",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.65,
        metadataTags: ["acronym", "abbreviation", "emergency", "triage"],
      },
      {
        id: "eval-patient-002-synonym-blood-thinner",
        naturalLanguageRequest:
          "Need blood thinner safety context (anticoagulant meds), contraindications, and condition background.",
        patientHash: omarHash,
        expectedFieldKeys: ["medications", "alerts", "conditions"],
        expectedNoteTypes: [
          "medication_record",
          "medical_alert",
          "condition_record",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.65,
        metadataTags: ["synonym", "medication_safety", "emergency"],
      },
      {
        id: "eval-patient-001-adversarial-ambiguity",
        naturalLanguageRequest:
          "Do NOT include allergy details unless critical, but give contraindication snapshot for immediate treatment.",
        patientHash: sarahHash,
        expectedFieldKeys: ["alerts", "medications", "allergies"],
        expectedNoteTypes: [
          "medical_alert",
          "medication_record",
          "allergy_record",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.5,
        metadataTags: ["adversarial", "ambiguity", "policy_sensitive"],
      },
      {
        id: "eval-patient-002-triage-code-language",
        naturalLanguageRequest:
          "Possible code situation: surface life-threatening alerts, high-risk meds, and latest discharge red flags now.",
        patientHash: omarHash,
        expectedFieldKeys: ["alerts", "medications", "recentDischarge"],
        expectedNoteTypes: [
          "medical_alert",
          "medication_record",
          "discharge_summary",
        ],
        expectedEvidenceIds: [],
        minAcceptableTopKRecall: 0.6,
        metadataTags: ["triage", "emergency_language", "adversarial"],
      },
    ],
  });
}

export function ensureEvalDataset(filePath = DEFAULT_DATASET_PATH) {
  if (fs.existsSync(filePath)) {
    const loaded = loadRetrievalEvalDataset(filePath);
    const hasUsableExample = loaded.examples.some(
      (example) => example.patientHash !== "unknown",
    );
    if (hasUsableExample) {
      return loaded;
    }
  }

  const dataset = buildDefaultEvalDataset();
  saveRetrievalEvalDataset(dataset, filePath);
  return dataset;
}
