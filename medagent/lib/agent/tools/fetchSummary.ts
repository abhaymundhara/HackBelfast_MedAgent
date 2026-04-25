import crypto from "crypto";
import { decryptBuffer, sha256Json } from "@/lib/crypto";
import {
  getPatientPolicy,
  getPatientSummary,
  listPatientDocuments,
  readEncryptedDocument,
  getPatientRow,
} from "@/lib/db";
import { CRITICAL_ALERTS, EmergencySummary, PatientPolicy } from "@/lib/types";
import { CanonicalEvidenceItem } from "@/lib/agent/state";

function buildDemographicsItem(
  patientHash: string,
  data: any,
): CanonicalEvidenceItem {
  return {
    id: crypto.randomUUID(),
    patientHash,
    content: JSON.stringify(data),
    authorization: {
      fieldKey: "demographics",
      allowedForTiers: [1, 2, 3],
      sensitivityClass: "standard",
      requiresExplicitApproval: false,
    },
    sourceType: "structured_ips",
    noteType: "demographics",
    extractionMode: "structured",
    sensitivityTags: [],
    clinicalTags: [],
    recencyBucket: "historical",
    language: "en",
    provenance: { timestamp: new Date().toISOString() },
  };
}

function buildAllergyItems(
  patientHash: string,
  allergies: any[],
): CanonicalEvidenceItem[] {
  return allergies.map((a) => ({
    id: crypto.randomUUID(),
    patientHash,
    content: JSON.stringify(a),
    authorization: {
      fieldKey: "allergies",
      allowedForTiers: [1, 2, 3],
      sensitivityClass: "standard",
      requiresExplicitApproval: false,
    },
    sourceType: "structured_ips",
    noteType: "allergy_record",
    extractionMode: "structured",
    sensitivityTags: [],
    clinicalTags: ["allergy"],
    recencyBucket: "historical",
    language: "en",
    provenance: { timestamp: new Date().toISOString() },
  }));
}

function buildMedicationItems(
  patientHash: string,
  meds: any[],
): CanonicalEvidenceItem[] {
  return meds.map((m) => ({
    id: crypto.randomUUID(),
    patientHash,
    content: `Medication record for prescribing safety and contraindication review: ${JSON.stringify(m)}`,
    authorization: {
      fieldKey: "medications",
      allowedForTiers: m.critical ? [1, 2, 3] : [1, 2],
      sensitivityClass: m.critical ? "critical_only" : "standard",
      requiresExplicitApproval: false,
    },
    sourceType: "structured_ips",
    noteType: "medication_record",
    extractionMode: "structured",
    sensitivityTags: [],
    clinicalTags: ["medication"],
    recencyBucket: "current_admission",
    language: "en",
    provenance: { timestamp: new Date().toISOString() },
  }));
}

function buildConditionItems(
  patientHash: string,
  conditions: any[],
): CanonicalEvidenceItem[] {
  return conditions.map((c) => ({
    id: crypto.randomUUID(),
    patientHash,
    content: `Condition history record for clinical risk and trend context: ${JSON.stringify(c)}`,
    authorization: {
      fieldKey: "conditions",
      allowedForTiers: c.major ? [1, 2, 3] : [1, 2],
      sensitivityClass: c.major ? "critical_only" : "standard",
      requiresExplicitApproval: false,
    },
    sourceType: "structured_ips",
    noteType: "condition_record",
    extractionMode: "structured",
    sensitivityTags: [],
    clinicalTags: ["condition"],
    recencyBucket: "historical",
    language: "en",
    provenance: { timestamp: new Date().toISOString() },
  }));
}

function buildLabTrendItems(
  patientHash: string,
  conditions: any[],
  medications: any[],
): CanonicalEvidenceItem[] {
  if (!conditions.length && !medications.length) return [];

  const conditionLabels = conditions
    .map((condition) => condition?.label)
    .filter(Boolean)
    .join(", ");
  const medicationNames = medications
    .map((medication) => medication?.name)
    .filter(Boolean)
    .join(", ");

  return [
    {
      id: crypto.randomUUID(),
      patientHash,
      content: `Lab trend context derived from active conditions (${conditionLabels || "none"}) and medications (${medicationNames || "none"}).`,
      authorization: {
        fieldKey: "conditions",
        allowedForTiers: [1, 2],
        sensitivityClass: "standard",
        requiresExplicitApproval: false,
      },
      sourceType: "structured_ips",
      noteType: "lab_trend",
      extractionMode: "derived",
      sensitivityTags: [],
      clinicalTags: ["lab", "trend"],
      recencyBucket: "last_year",
      language: "en",
      provenance: { timestamp: new Date().toISOString() },
    },
  ];
}

function buildAlertItems(
  patientHash: string,
  alerts: string[],
): CanonicalEvidenceItem[] {
  return alerts.map((a) => {
    const isCritical = (CRITICAL_ALERTS as readonly string[]).includes(a);
    return {
      id: crypto.randomUUID(),
      patientHash,
      content: isCritical
        ? `Critical medical alert and contraindication risk: ${a}`
        : `Medical alert and contraindication risk: ${a}`,
      authorization: {
        fieldKey: "alerts",
        allowedForTiers: isCritical ? [1, 2, 3] : [1, 2],
        sensitivityClass: isCritical ? "critical_only" : "standard",
        requiresExplicitApproval: false,
      },
      sourceType: "structured_ips",
      noteType: "medical_alert",
      extractionMode: "structured",
      sensitivityTags: ["alert"],
      clinicalTags: ["alert"],
      recencyBucket: "historical",
      language: "en",
      provenance: { timestamp: new Date().toISOString() },
    };
  });
}

function buildContactItem(
  patientHash: string,
  contact: any,
): CanonicalEvidenceItem {
  return {
    id: crypto.randomUUID(),
    patientHash,
    content: `Emergency contact information for consent and care coordination: ${JSON.stringify(contact)}`,
    authorization: {
      fieldKey: "emergencyContact",
      allowedForTiers: [1, 2, 3],
      sensitivityClass: "standard",
      requiresExplicitApproval: false,
    },
    sourceType: "structured_ips",
    noteType: "contact_info",
    extractionMode: "structured",
    sensitivityTags: ["pii"],
    clinicalTags: [],
    recencyBucket: "historical",
    language: "en",
    provenance: { timestamp: new Date().toISOString() },
  };
}

function buildSocialHistoryItem(
  patientHash: string,
  contact: any,
): CanonicalEvidenceItem {
  return {
    id: crypto.randomUUID(),
    patientHash,
    content: `Social history for emergency contact, consent workflow, and care coordination: ${JSON.stringify(contact)}`,
    authorization: {
      fieldKey: "emergencyContact",
      allowedForTiers: [1, 2, 3],
      sensitivityClass: "standard",
      requiresExplicitApproval: false,
    },
    sourceType: "structured_ips",
    noteType: "social_history",
    extractionMode: "derived",
    sensitivityTags: ["pii"],
    clinicalTags: ["coordination"],
    recencyBucket: "historical",
    language: "en",
    provenance: { timestamp: new Date().toISOString() },
  };
}

function buildDischargeItem(
  patientHash: string,
  text: string,
): CanonicalEvidenceItem {
  return {
    id: crypto.randomUUID(),
    patientHash,
    content: `Discharge summary for follow-up and care-plan decisions: ${text}`,
    authorization: {
      fieldKey: "recentDischarge",
      allowedForTiers: [1],
      sensitivityClass: "sensitive",
      requiresExplicitApproval: false,
    },
    sourceType: "structured_ips",
    noteType: "discharge_summary",
    extractionMode: "narrative",
    sensitivityTags: ["clinical_notes"],
    clinicalTags: [],
    recencyBucket: "last_30_days",
    language: "en",
    provenance: { timestamp: new Date().toISOString() },
  };
}

function buildDischargeDerivedItems(
  patientHash: string,
  text: string,
): CanonicalEvidenceItem[] {
  return [
    {
      id: crypto.randomUUID(),
      patientHash,
      content: text,
      authorization: {
        fieldKey: "recentDischarge",
        allowedForTiers: [1],
        sensitivityClass: "sensitive",
        requiresExplicitApproval: false,
      },
      sourceType: "structured_ips",
      noteType: "procedure_history",
      extractionMode: "derived",
      sensitivityTags: ["clinical_notes"],
      clinicalTags: ["procedure_history"],
      recencyBucket: "last_30_days",
      language: "en",
      provenance: { timestamp: new Date().toISOString() },
    },
    {
      id: crypto.randomUUID(),
      patientHash,
      content: `Care plan context: ${text}`,
      authorization: {
        fieldKey: "alerts",
        allowedForTiers: [1, 2],
        sensitivityClass: "standard",
        requiresExplicitApproval: false,
      },
      sourceType: "structured_ips",
      noteType: "care_plan",
      extractionMode: "derived",
      sensitivityTags: ["clinical_notes"],
      clinicalTags: ["care_plan"],
      recencyBucket: "last_30_days",
      language: "en",
      provenance: { timestamp: new Date().toISOString() },
    },
  ];
}

function buildDocumentItems(
  patientId: string,
  patientHash: string,
  summaryDocs: any[],
  policy: PatientPolicy,
): CanonicalEvidenceItem[] {
  const docRows = listPatientDocuments(patientId);
  const documentIndex = new Map(summaryDocs.map((doc) => [doc.id, doc]));

  const items: CanonicalEvidenceItem[] = [];

  for (const row of docRows) {
    if (!documentIndex.has(row.id)) {
      continue;
    }

    const docMeta = documentIndex.get(row.id)!;
    let content: string;
    try {
      const encrypted = readEncryptedDocument(row.storage_path);
      content = decryptBuffer(encrypted).toString("utf8");
    } catch (error) {
      console.error("Failed to decrypt patient document", {
        documentId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    // Explicit approval checks
    const approvedTiers: (1 | 2 | 3)[] = [];
    if (
      docMeta.patientApprovedForTier1Or2 ||
      policy.shareableDocumentIds.includes(row.id)
    ) {
      approvedTiers.push(1, 2);
    }

    if (approvedTiers.length > 0) {
      items.push({
        id: crypto.randomUUID(),
        patientHash,
        content: `Title: ${row.title}\nContent:\n${content}`,
        authorization: {
          fieldKey: "documents",
          allowedForTiers: approvedTiers,
          sensitivityClass: "sensitive",
          requiresExplicitApproval: true,
        },
        sourceType: "document",
        noteType: "upload",
        extractionMode: "narrative",
        sensitivityTags: [],
        clinicalTags: [],
        recencyBucket: "historical",
        language: "en",
        provenance: { documentId: row.id, timestamp: new Date().toISOString() },
      });
    }

    if (approvedTiers.length > 0) {
      items.push({
        id: crypto.randomUUID(),
        patientHash,
        content: `Procedure history context from document "${row.title}": ${content}`,
        authorization: {
          fieldKey: "documents",
          allowedForTiers: approvedTiers,
          sensitivityClass: "sensitive",
          requiresExplicitApproval: true,
        },
        sourceType: "document",
        noteType: "procedure_history",
        extractionMode: "derived",
        sensitivityTags: [],
        clinicalTags: ["procedure_history"],
        recencyBucket: "historical",
        language: "en",
        provenance: { documentId: row.id, timestamp: new Date().toISOString() },
      });
    }
  }

  return items;
}

function buildNoRecentDischargeItems(patientHash: string): CanonicalEvidenceItem[] {
  return [
    {
      id: crypto.randomUUID(),
      patientHash,
      content: "No recent discharge summary is currently on file for this patient.",
      authorization: {
        fieldKey: "recentDischarge",
        allowedForTiers: [1, 2],
        sensitivityClass: "standard",
        requiresExplicitApproval: false,
      },
      sourceType: "structured_ips",
      noteType: "discharge_summary",
      extractionMode: "derived",
      sensitivityTags: [],
      clinicalTags: ["discharge"],
      recencyBucket: "historical",
      language: "en",
      provenance: { timestamp: new Date().toISOString() },
    },
    {
      id: crypto.randomUUID(),
      patientHash,
      content: "No recent procedure history is currently on file for this patient.",
      authorization: {
        fieldKey: "recentDischarge",
        allowedForTiers: [1, 2],
        sensitivityClass: "standard",
        requiresExplicitApproval: false,
      },
      sourceType: "structured_ips",
      noteType: "procedure_history",
      extractionMode: "derived",
      sensitivityTags: [],
      clinicalTags: ["procedure_history"],
      recencyBucket: "historical",
      language: "en",
      provenance: { timestamp: new Date().toISOString() },
    },
  ];
}

export function filterSummaryForTier(
  _patientId: string,
  summary: EmergencySummary,
  policy: PatientPolicy,
  tier: 1 | 2 | 3,
) {
  if (tier === 1) {
    return {
      demographics: summary.demographics,
      allergies: summary.allergies,
      medications: summary.medications,
      conditions: summary.conditions,
      alerts: summary.alerts,
      emergencyContact: summary.emergencyContact,
      recentDischarge: summary.recentDischarge,
      documents: (summary.documents ?? []).filter(
        (doc) =>
          doc.patientApprovedForTier1Or2 ||
          policy.shareableDocumentIds.includes(doc.id),
      ),
    };
  }

  if (tier === 2) {
    return {
      demographics: summary.demographics,
      allergies: summary.allergies,
      medications: summary.medications,
      conditions: summary.conditions,
      alerts: summary.alerts,
      emergencyContact: summary.emergencyContact,
      documents: (summary.documents ?? []).filter(
        (doc) =>
          doc.patientApprovedForTier1Or2 ||
          policy.shareableDocumentIds.includes(doc.id),
      ),
    };
  }

  const criticalAlertSet = new Set<string>(
    CRITICAL_ALERTS as readonly string[],
  );
  return {
    demographics: summary.demographics,
    allergies: summary.allergies,
    medications: summary.medications.filter((item) => item.critical),
    conditions: summary.conditions.filter((item) => item.major),
    alerts: summary.alerts.filter((item) => criticalAlertSet.has(item)),
    emergencyContact: summary.emergencyContact,
  };
}

export async function fetchSummary(input: {
  patientId: string;
  fieldsAllowed?: string[];
}) {
  const summary = getPatientSummary(input.patientId);
  const policy = getPatientPolicy(input.patientId);
  const patientRow = getPatientRow(input.patientId);

  if (!summary || !policy || !patientRow) {
    throw new Error(`Patient ${input.patientId} not found`);
  }

  const pHash = patientRow.patient_hash;
  const items: CanonicalEvidenceItem[] = [
    ...buildAllergyItems(pHash, summary.allergies),
    ...buildMedicationItems(pHash, summary.medications),
    ...buildConditionItems(pHash, summary.conditions),
    ...buildLabTrendItems(pHash, summary.conditions, summary.medications),
    ...buildAlertItems(pHash, summary.alerts),
  ];

  if (summary.demographics) {
    items.push(buildDemographicsItem(pHash, summary.demographics));
  }

  if (summary.emergencyContact) {
    items.push(buildContactItem(pHash, summary.emergencyContact));
    items.push(buildSocialHistoryItem(pHash, summary.emergencyContact));
  }

  if (summary.recentDischarge) {
    items.push(buildDischargeItem(pHash, summary.recentDischarge));
    items.push(...buildDischargeDerivedItems(pHash, summary.recentDischarge));
  } else {
    items.push(...buildNoRecentDischargeItems(pHash));
  }

  if (summary.documents && summary.documents.length > 0) {
    items.push(
      ...buildDocumentItems(input.patientId, pHash, summary.documents, policy),
    );
  }

  const summarySubset =
    input.fieldsAllowed && input.fieldsAllowed.length
      ? Object.fromEntries(
          Object.entries({
            demographics: summary.demographics,
            allergies: summary.allergies,
            medications: summary.medications,
            conditions: summary.conditions,
            alerts: summary.alerts,
            emergencyContact: summary.emergencyContact,
            recentDischarge: summary.recentDischarge,
            documents: summary.documents,
          }).filter(([field]) => input.fieldsAllowed?.includes(field)),
        )
      : {
          demographics: summary.demographics,
          allergies: summary.allergies,
          medications: summary.medications,
          conditions: summary.conditions,
          alerts: summary.alerts,
          emergencyContact: summary.emergencyContact,
          recentDischarge: summary.recentDischarge,
          documents: summary.documents,
        };

  return {
    rawCandidates: items,
    summarySubset,
    fieldsHash: sha256Json(summarySubset),
  };
}
