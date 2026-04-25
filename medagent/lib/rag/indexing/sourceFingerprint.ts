import crypto from "crypto";

import { CanonicalEvidenceItem } from "@/lib/agent/state";

type FingerprintChunk = {
  fieldKey: string;
  allowedForTiers: Array<1 | 2 | 3>;
  sensitivityClass: "standard" | "sensitive" | "critical_only";
  requiresExplicitApproval: boolean;
  sourceType: "structured_ips" | "document" | "user_entered";
  noteType?: string;
  extractionMode: "structured" | "narrative" | "derived";
  sensitivityTags: string[];
  clinicalTags: string[];
  recencyBucket:
    | "current_admission"
    | "last_30_days"
    | "last_year"
    | "historical";
  language: string;
  content: string;
  documentId?: string;
  chunkIndex?: number;
};

function normalizeArray(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}

function toFingerprintChunk(item: CanonicalEvidenceItem): FingerprintChunk {
  return {
    fieldKey: item.authorization.fieldKey,
    allowedForTiers: [...item.authorization.allowedForTiers].sort(
      (a, b) => a - b,
    ),
    sensitivityClass: item.authorization.sensitivityClass,
    requiresExplicitApproval: item.authorization.requiresExplicitApproval,
    sourceType: item.sourceType,
    noteType: item.noteType,
    extractionMode: item.extractionMode,
    sensitivityTags: normalizeArray(item.sensitivityTags),
    clinicalTags: normalizeArray(item.clinicalTags),
    recencyBucket: item.recencyBucket,
    language: item.language,
    content: item.content,
    documentId: item.provenance.documentId,
    chunkIndex: item.provenance.chunkIndex,
  };
}

export function computeSourceFingerprint(items: CanonicalEvidenceItem[]) {
  const normalized = items
    .map((item) => toFingerprintChunk(item))
    .sort((left, right) => {
      if (left.fieldKey !== right.fieldKey) {
        return left.fieldKey < right.fieldKey ? -1 : 1;
      }
      if ((left.noteType ?? "") !== (right.noteType ?? "")) {
        const leftNoteType = left.noteType ?? "";
        const rightNoteType = right.noteType ?? "";
        return leftNoteType < rightNoteType ? -1 : 1;
      }
      if ((left.documentId ?? "") !== (right.documentId ?? "")) {
        const leftDocumentId = left.documentId ?? "";
        const rightDocumentId = right.documentId ?? "";
        return leftDocumentId < rightDocumentId ? -1 : 1;
      }
      if ((left.chunkIndex ?? -1) !== (right.chunkIndex ?? -1)) {
        return (left.chunkIndex ?? -1) - (right.chunkIndex ?? -1);
      }
      return left.content < right.content
        ? -1
        : left.content > right.content
          ? 1
          : 0;
    });

  const payload = JSON.stringify(normalized);
  return crypto.createHash("sha256").update(payload).digest("hex");
}
