import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

import { encryptBuffer, encryptJson, sha256Hash } from "@/lib/crypto";
import {
  savePatientDocumentMetadata,
  savePatientPolicy,
  upsertPatient,
  writeEncryptedDocument,
} from "@/lib/db";
import type { InboundAttachment } from "@/lib/imessage/inbound";
import { indexPatientDocument } from "@/lib/rag/ragClient";
import { EMERGENCY_ALERTS, EmergencySummary, PatientPolicy } from "@/lib/types";

const execFileAsync = promisify(execFile);
const OCR_MIN_TEXT_LENGTH = 40;
const SECTION_BOUNDARY_PATTERN =
  "allergies?|known allergies?|adverse reactions?|current medications?|medications?|medicines|active conditions?|major conditions?|conditions?|diagnoses|problems|emergency contact|next of kin|blood type|recent discharge|emergency alerts?|alerts?";

type ExtractionResult = { text: string; method: string };
type PdfTextExtractor = (filePath: string) => Promise<ExtractionResult>;

let pdfTextExtractor: PdfTextExtractor = extractTextWithNativeMacToolsTracked;

export type MedicalReportProfile = {
  patientId: string;
  summary: EmergencySummary;
  documentId: string;
};

export function isPdfAttachment(attachment: InboundAttachment) {
  const candidates = [
    attachment.mimeType,
    attachment.uti,
    attachment.filename,
    attachment.path,
    attachment.transferName,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  return candidates.some(
    (value) =>
      value.includes("pdf") ||
      value.includes("com.adobe.pdf") ||
      value.endsWith(".pdf"),
  );
}

export async function processMedicalReportPdfOnboarding(input: {
  attachment: InboundAttachment;
  fullName?: string;
  dob?: string;
  handle: string;
}): Promise<MedicalReportProfile> {
  if (!isPdfAttachment(input.attachment)) {
    throw new Error("The uploaded attachment is not a PDF.");
  }

  const pdfPath = resolveAttachmentPath(input.attachment);
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    throw new Error("The uploaded PDF is not available on this Mac yet.");
  }

  const extraction = await pdfTextExtractor(pdfPath);
  const rawText = extraction.text;
  const extractionMethod = extraction.method;
  const pdfMeta = await extractPdfMetadata(pdfPath);

  // Extract name/DOB from PDF text if not provided
  let fullName = input.fullName || "";
  let dob = input.dob || "";
  if (!fullName || !dob) {
    const extracted = extractNameDobFromReport(rawText);
    if (extracted.name && !fullName) fullName = extracted.name;
    if (extracted.dob && !dob) dob = extracted.dob;
  }

  if (!fullName || !dob) {
    throw new Error("Could not extract name and date of birth from the PDF. Please ensure the report contains a patient name and DOB.");
  }

  const summary = buildEmergencySummaryFromReport({
    patientId: buildPatientId(fullName, dob, input.handle),
    fullName,
    dob,
    reportText: rawText,
  });
  const patientHash = sha256Hash(
    `${summary.patientId}:${summary.demographics.email}`,
  );
  const documentId = `${summary.patientId}-medical-report-pdf`;
  const documentTitle = buildDocumentTitle(input.attachment);
  const storagePath = writeEncryptedDocument(
    summary.patientId,
    documentId,
    encryptBuffer(fs.readFileSync(pdfPath)),
  );

  upsertPatient({
    patientId: summary.patientId,
    localIdentity: `imessage:${input.handle}`,
    encryptedSummary: encryptJson(summary),
    patientHash,
  });
  savePatientPolicy(
    summary.patientId,
    PatientPolicy.parse({
      emergencyAutoAccess: true,
      allowPatientApprovalRequests: true,
      breakGlassAllowed: true,
      shareableDocumentIds: [documentId],
    }),
  );
  savePatientDocumentMetadata({
    id: documentId,
    patientId: summary.patientId,
    title: documentTitle,
    mimeType: "application/pdf",
    storagePath,
    patientApproved: true,
    fileSizeBytes: pdfMeta.fileSizeBytes,
    pageCount: pdfMeta.pageCount,
    pdfAuthor: pdfMeta.pdfAuthor,
    pdfCreationDate: pdfMeta.pdfCreationDate,
    pdfProducer: pdfMeta.pdfProducer,
    pdfKeywords: pdfMeta.pdfKeywords,
    extractionMethod,
    extractedTextLength: rawText.length,
  });

  // Index extracted text into the RAG system so the patient can query their record
  indexPatientDocument({
    patientHash,
    rawText,
    patientId: summary.patientId,
    documentId,
  });

  return { patientId: summary.patientId, summary, documentId };
}

export function buildEmergencySummaryFromReport(input: {
  patientId: string;
  fullName: string;
  dob: string;
  reportText: string;
}): EmergencySummary {
  const normalizedText = normalizeText(input.reportText);
  if (normalizedText.length < OCR_MIN_TEXT_LENGTH) {
    throw new Error("The PDF did not contain enough readable medical text.");
  }

  const allergies = collapseContinuationEntries(
    extractList(normalizedText, [
      "allergies",
      "known allergies",
      "allergy",
      "adverse reactions",
    ]),
  )
    .map((substance) => sanitizeAllergySubstance(substance))
    .filter((substance) => substance.length > 0)
    .map((substance) => ({
      substance,
      severity: inferAllergySeverity(substance, normalizedText),
      reaction: extractReactionFor(substance, normalizedText),
    }))
    .filter((entry) => !isNarrativeAllergyEntry(entry.substance));

  const medications = collapseContinuationEntries(
    extractList(normalizedText, [
      "current medications",
      "medications",
      "medicines",
    ]),
  )
    .map((entry) => parseMedication(entry))
    .filter((medication) => isLikelyMedication(medication));

  const conditions = extractList(normalizedText, [
    "active conditions",
    "major conditions",
    "conditions",
    "diagnoses",
    "problems",
  ])
    .map((label) => parseCondition(label))
    .filter((value): value is { label: string; major: boolean } =>
      Boolean(value),
    );
  const emergencyContact = parseEmergencyContact(normalizedText);
  const bloodType = matchFirst(
    normalizedText,
    /\bblood\s*type[:\s]+([ABO]{1,2}[+-])/i,
  );

  return EmergencySummary.parse({
    patientId: input.patientId,
    demographics: {
      name: input.fullName,
      dob: input.dob,
      sex: "other",
      bloodType: bloodType ?? undefined,
      languages: ["English"],
      homeCountry: "United Kingdom",
      homeJurisdiction: "NI",
      email: `${input.patientId}@imessage.medagent.dev`,
    },
    allergies,
    medications,
    conditions,
    alerts: inferAlerts(normalizedText, medications, conditions),
    emergencyContact,
    recentDischarge:
      matchFirst(normalizedText, /\brecent\s+discharge[:\s]+([^\n]+)/i) ??
      undefined,
    documents: [
      {
        id: `${input.patientId}-medical-report-pdf`,
        title: "Medical report PDF",
        patientApprovedForTier1Or2: true,
      },
    ],
  });
}

export function buildPatientId(fullName: string, dob: string, handle: string) {
  const nameSlug = fullName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const dobSlug = dob.replace(/[^0-9]/g, "");
  if (nameSlug && dobSlug) {
    return `${nameSlug}-${dobSlug}`;
  }
  return `imessage-${sha256Hash(handle).slice(0, 12)}`;
}

/**
 * Extract patient name and DOB directly from the PDF report text.
 * Looks for patterns like "Name: Ciara Byrne" and "Date of Birth: 1994-02-17".
 */
export function extractNameDobFromReport(reportText: string): {
  name: string | null;
  dob: string | null;
} {
  const namePatterns = [
    /\bname[:\s]+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)/m,
    /\bpatient[:\s]+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)/m,
  ];

  const dobPatterns = [
    /\b(?:date of birth|dob|d\.o\.b\.?)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /\b(?:date of birth|dob|d\.o\.b\.?)[:\s]+(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i,
  ];

  let name: string | null = null;
  for (const pattern of namePatterns) {
    const match = pattern.exec(reportText);
    if (match?.[1]) {
      name = match[1].trim();
      break;
    }
  }

  let dob: string | null = null;
  for (const pattern of dobPatterns) {
    const match = pattern.exec(reportText);
    if (match?.[1]) {
      let raw = match[1].trim();
      // Normalize DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
      const dmyMatch = raw.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);
      if (dmyMatch) {
        raw = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
      }
      dob = raw;
      break;
    }
  }

  return { name, dob };
}

function resolveAttachmentPath(attachment: InboundAttachment) {
  const rawPath = attachment.path ?? attachment.filename ?? "";
  if (!rawPath) return "";
  if (rawPath.startsWith("~/")) {
    return path.join(os.homedir(), rawPath.slice(2));
  }
  return rawPath;
}

function buildDocumentTitle(attachment: InboundAttachment) {
  const rawTitle =
    attachment.transferName ?? attachment.filename ?? attachment.path ?? "";
  const title = path.basename(rawTitle);
  return title || "Medical report PDF";
}

async function extractTextWithNativeMacToolsTracked(
  filePath: string,
): Promise<ExtractionResult> {
  const spotlightText = await extractTextWithSpotlight(filePath);
  if (spotlightText.trim().length >= OCR_MIN_TEXT_LENGTH) {
    return { text: spotlightText, method: "spotlight" };
  }
  const visionText = await extractTextWithVision(filePath);
  return { text: visionText, method: "vision-ocr" };
}

export type PdfMetadata = {
  fileSizeBytes: number;
  pageCount: number | null;
  pdfAuthor: string | null;
  pdfCreationDate: string | null;
  pdfProducer: string | null;
  pdfKeywords: string | null;
};

export async function extractPdfMetadata(
  filePath: string,
): Promise<PdfMetadata> {
  const fileSizeBytes = fs.statSync(filePath).size;

  if (process.platform !== "darwin") {
    return {
      fileSizeBytes,
      pageCount: null,
      pdfAuthor: null,
      pdfCreationDate: null,
      pdfProducer: null,
      pdfKeywords: null,
    };
  }

  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/mdls",
      [
        "-name", "kMDItemNumberOfPages",
        "-name", "kMDItemAuthors",
        "-name", "kMDItemCreator",
        "-name", "kMDItemKeywords",
        "-name", "kMDItemContentCreationDate",
        filePath,
      ],
      { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 },
    );

    const get = (key: string): string | null => {
      const match = stdout.match(new RegExp(`${key}\\s*=\\s*(.+)`));
      if (!match) return null;
      const val = match[1].trim();
      if (val === "(null)" || val === "") return null;
      return val.replace(/^"(.*)"$/, "$1");
    };

    const getArray = (key: string): string | null => {
      const match = stdout.match(
        new RegExp(`${key}\\s*=\\s*\\(([^)]*?)\\)`, "s"),
      );
      if (!match) return null;
      const items = match[1]
        .split(",")
        .map((s) => s.trim().replace(/^"(.*)"$/, "$1"))
        .filter(Boolean);
      return items.length > 0 ? items.join(", ") : null;
    };

    const pageCountRaw = get("kMDItemNumberOfPages");
    return {
      fileSizeBytes,
      pageCount: pageCountRaw ? parseInt(pageCountRaw, 10) || null : null,
      pdfAuthor: getArray("kMDItemAuthors"),
      pdfCreationDate: get("kMDItemContentCreationDate"),
      pdfProducer: get("kMDItemCreator"),
      pdfKeywords: getArray("kMDItemKeywords"),
    };
  } catch {
    return {
      fileSizeBytes,
      pageCount: null,
      pdfAuthor: null,
      pdfCreationDate: null,
      pdfProducer: null,
      pdfKeywords: null,
    };
  }
}

async function extractTextWithSpotlight(filePath: string) {
  if (process.platform !== "darwin") return "";
  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/mdls",
      ["-raw", "-name", "kMDItemTextContent", filePath],
      { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 * 4 },
    );
    const text = stdout.trim();
    return text === "(null)" ? "" : text;
  } catch {
    return "";
  }
}

async function extractTextWithVision(filePath: string) {
  if (process.platform !== "darwin") {
    throw new Error("macOS native OCR requires a Darwin host.");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "medagent-ocr-"));
  const scriptPath = path.join(tempDir, "ExtractPdfText.swift");
  fs.writeFileSync(scriptPath, SWIFT_PDF_OCR_SCRIPT, "utf8");

  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/xcrun",
      ["swift", scriptPath, filePath],
      { encoding: "utf8", timeout: 60_000, maxBuffer: 1024 * 1024 * 8 },
    );
    return stdout;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/([a-z])\n([a-z])/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extractList(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
      `(?:^|\\n)\\s*${escaped}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${SECTION_BOUNDARY_PATTERN})\\s*:?|$)`,
      "i",
    ).exec(text);
    if (!match?.[1]) continue;

    const values = match[1]
      .split(/\n|;|,/)
      .map((value) =>
        value
          .replace(/^[\s*•\-–—]+/, "")
          .replace(/^\d+[.)]\s*/, "")
          .trim(),
      )
      .filter((value) => value && !/^none( known)?$/i.test(value))
      .filter(
        (value) =>
          !new RegExp(`^&?\\s*(?:${SECTION_BOUNDARY_PATTERN})$`, "i").test(
            value,
          ),
      )
      .slice(0, 10);
    if (values.length > 0) return values;
  }
  return [];
}

function collapseContinuationEntries(values: string[]) {
  const collapsed: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const cleaned = value.trim();
    if (!cleaned) continue;

    if (collapsed.length > 0 && isContinuationFragment(cleaned)) {
      collapsed[collapsed.length - 1] =
        `${collapsed[collapsed.length - 1]} ${cleaned}`
          .replace(/\s+/g, " ")
          .trim();
      continue;
    }

    collapsed.push(cleaned);
  }

  return collapsed;
}

function isContinuationFragment(value: string) {
  return /^(critical\b|history\b|documented\b|patient\b|all\b|beta-|review\b|reliever\b|gastric\b|for\b|on\b)/i.test(
    value,
  );
}

function parseMedication(entry: string) {
  const doseMatch = entry.match(
    /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?))\b/i,
  );
  const frequencyMatch = entry.match(
    /\b(once daily|twice daily|daily|nightly|weekly|bd|od|prn|as needed)\b/i,
  );
  const name = entry
    .replace(doseMatch?.[0] ?? "", "")
    .replace(frequencyMatch?.[0] ?? "", "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: name || entry,
    dose: doseMatch?.[0] ?? "",
    frequency: frequencyMatch?.[0] ?? "",
    critical:
      /warfarin|insulin|epipen|adrenaline|antiepileptic|anticoagulant/i.test(
        entry,
      ),
  };
}

function isLikelyMedication(medication: {
  name: string;
  dose: string;
  frequency: string;
  critical: boolean;
}) {
  if (medication.dose || medication.frequency || medication.critical) {
    return true;
  }

  const name = medication.name.trim();
  if (!name) return false;

  const knownMedicationTerms =
    /\b(tablet|capsule|inhaler|insulin|metformin|warfarin|apixaban|rivaroxaban|aspirin|epipen|paracetamol|acetaminophen|ibuprofen|amoxicillin|atorvastatin|simvastatin|omeprazole|lansoprazole|prednisolone|salbutamol|levothyroxine|lisinopril|losartan|amlodipine|metoprolol|bisoprolol)\b/i;
  if (knownMedicationTerms.test(name)) return true;

  const lowerName = name.toLowerCase();
  if (/(olol|pril|sartan|azole|cillin|statin|mab)\b/.test(lowerName)) {
    return true;
  }

  // Accept plain single-token names that look drug-like.
  // - Initial capital (e.g. "Metformin")
  // - Longer lowercase generic-style token
  if (/^[A-Z][A-Za-z0-9-]{2,}$/.test(name)) return true;
  if (/^[a-z][a-z0-9-]{5,}$/.test(name)) return true;

  // Accept long alphanumeric medication tokens (brand/coded names).
  if (/\b[A-Za-z]+\d+[A-Za-z0-9-]{2,}\b/.test(name)) return true;

  return false;
}

function parseCondition(label: string) {
  const cleaned = label
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\((major|minor)\)/gi, "")
    .replace(/\s*-\s*.*$/, "")
    .trim();
  const normalized = cleaned || label;
  if (/^(on|with|without|and|for)\b/i.test(normalized)) {
    return null;
  }
  if (/^(well|controlled|stable|minor|major)$/i.test(normalized)) {
    return null;
  }
  if (
    /\b(alert|warning|risk|do not|confirm inr|reversal agent)\b/i.test(
      normalized,
    )
  ) {
    return null;
  }
  return {
    label: normalized,
    major:
      /major|chronic|epilepsy|diabetes|heart|stroke|cancer|atrial fibrillation/i.test(
        label,
      ),
  };
}

function isNarrativeAllergyEntry(value: string) {
  return /^(history\b|documented\b|patient\b|all\b|beta-|review\b)/i.test(
    value,
  );
}

function sanitizeAllergySubstance(value: string) {
  return value
    .replace(/^&\s*/, "")
    .replace(/^(known\s+)?adverse reactions?$/i, "")
    .replace(/\b(history|documented)\b[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[-:,;]+$/g, "")
    .trim();
}

function parseEmergencyContact(text: string) {
  const raw =
    matchFirst(text, /\bemergency contact[:\s]+([^\n]+)/i) ??
    matchFirst(text, /\bnext of kin[:\s]+([^\n]+)/i) ??
    "";
  const phone = raw.match(/(?:\+?\d[\d\s().-]{6,}\d)/)?.[0]?.trim() ?? "";
  const withoutPhone = raw
    .replace(phone, "")
    .replace(/[(),-]+$/g, "")
    .trim();
  const relation =
    matchFirst(withoutPhone, /\(([^)]+)\)/) ?? "Emergency contact";
  const name =
    withoutPhone
      .replace(/\([^)]+\)/g, "")
      .replace(/[\s-]+$/g, "")
      .trim() || "Emergency contact";

  return { name, relation, phone };
}

function inferAllergySeverity(
  substance: string,
  text: string,
): "mild" | "moderate" | "severe" | "life-threatening" {
  const nearby =
    new RegExp(`${escapeRegex(substance)}[^\\n]{0,120}`, "i").exec(text)?.[0] ??
    substance;
  if (/anaphylaxis|life[-\s]?threatening/i.test(nearby))
    return "life-threatening";
  if (/severe/i.test(nearby)) return "severe";
  if (/mild/i.test(nearby)) return "mild";
  return "moderate";
}

function extractReactionFor(substance: string, text: string) {
  const nearby = new RegExp(`${escapeRegex(substance)}[^\\n]{0,120}`, "i").exec(
    text,
  )?.[0];
  return matchFirst(nearby ?? "", /\breaction[:\s]+([^;,\n]+)/i) ?? undefined;
}

function inferAlerts(
  text: string,
  medications: Array<{ name: string }>,
  conditions: Array<{ label: string }>,
) {
  const source = `${text}\n${medications.map((m) => m.name).join("\n")}\n${conditions.map((c) => c.label).join("\n")}`;
  const alerts = new Set<(typeof EMERGENCY_ALERTS)[number]>();
  if (/pregnan/i.test(source)) alerts.add("pregnancy");
  if (/epilep|seizure/i.test(source)) alerts.add("epilepsy");
  if (/diabetes|insulin/i.test(source)) alerts.add("diabetes");
  if (/warfarin|anticoag|apixaban|rivaroxaban/i.test(source)) {
    alerts.add("anticoagulants");
  }
  if (/pacemaker|implant|icd/i.test(source)) alerts.add("implanted-device");
  if (/\bDNR\b|do not resuscitate/i.test(source)) alerts.add("DNR");
  if (/immunocompromised|transplant|chemotherapy/i.test(source)) {
    alerts.add("immunocompromised");
  }
  return [...alerts];
}

function matchFirst(text: string, pattern: RegExp) {
  return pattern.exec(text)?.[1]?.trim() || null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SWIFT_PDF_OCR_SCRIPT = `
import AppKit
import Foundation
import PDFKit
import Vision

let args = CommandLine.arguments
guard args.count >= 2 else {
  fputs("missing pdf path", stderr)
  exit(2)
}

let url = URL(fileURLWithPath: args[1])
guard let document = PDFDocument(url: url) else {
  fputs("unable to open pdf", stderr)
  exit(3)
}

var allText: [String] = []
let pageCount = min(document.pageCount, 8)

for index in 0..<pageCount {
  guard let page = document.page(at: index) else { continue }
  if let pageText = page.string, pageText.trimmingCharacters(in: .whitespacesAndNewlines).count > 40 {
    allText.append(pageText)
    continue
  }

  let pageBounds = page.bounds(for: .mediaBox)
  let scale: CGFloat = 2.0
  let imageSize = NSSize(width: pageBounds.width * scale, height: pageBounds.height * scale)
  let image = NSImage(size: imageSize)
  image.lockFocus()
  NSColor.white.setFill()
  NSRect(origin: .zero, size: imageSize).fill()
  guard let context = NSGraphicsContext.current?.cgContext else {
    image.unlockFocus()
    continue
  }
  context.saveGState()
  context.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()
  image.unlockFocus()

  guard
    let tiff = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiff),
    let cgImage = bitmap.cgImage
  else { continue }

  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  try? handler.perform([request])
  let recognized = request.results?.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\\n") ?? ""
  if !recognized.isEmpty {
    allText.append(recognized)
  }
}

print(allText.joined(separator: "\\n\\n"))
`;

export function __setPdfTextExtractorForTests(
  extractor: PdfTextExtractor | ((filePath: string) => Promise<string>) | null,
) {
  if (!extractor) {
    pdfTextExtractor = extractTextWithNativeMacToolsTracked;
    return;
  }
  // Wrap legacy string-returning extractors for backward compatibility
  pdfTextExtractor = async (filePath: string) => {
    const result = await extractor(filePath);
    if (typeof result === "string") {
      return { text: result, method: "test" };
    }
    return result;
  };
}
