import path from "path";

import { NextResponse } from "next/server";

import {
  deletePatientDocuments,
  savePatientDocumentMetadata,
  savePatientPolicy,
  upsertPatient,
  writeEncryptedDocument,
} from "@/lib/db";
import { encryptBuffer, encryptJson, sha256Hash } from "@/lib/crypto";
import { EmergencySummary, PatientPolicy } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedMimeTypes = ["application/pdf", "text/plain"];

function isAllowedFileType(file: File) {
  return allowedMimeTypes.includes(file.type) || file.type.startsWith("image/");
}

function buildDocumentId(patientId: string, fileName: string) {
  return `${patientId}-${fileName.replace(/[^a-zA-Z0-9]/g, "-")}`.toLowerCase();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const patientId = String(formData.get("patientId") || "");
    const localIdentity = String(
      formData.get("localIdentity") || `patient:${patientId}`,
    );
    const summary = EmergencySummary.parse(
      JSON.parse(String(formData.get("summary") || "{}")),
    );
    const policy = PatientPolicy.parse(
      JSON.parse(String(formData.get("policy") || "{}")),
    );
    const files = formData.getAll("documents") as File[];

    if (files.length > 3) {
      return NextResponse.json(
        { error: "A maximum of 3 supporting documents is allowed." },
        { status: 400 },
      );
    }

    if (!patientId) {
      return NextResponse.json(
        { error: "patientId is required." },
        { status: 400 },
      );
    }

    if (files.some((file) => !isAllowedFileType(file))) {
      return NextResponse.json(
        { error: "Only PDF, image, and plain text files are supported." },
        { status: 400 },
      );
    }

    const patientHash = sha256Hash(
      `${patientId}:${summary.demographics.email}`,
    );

    upsertPatient({
      patientId,
      localIdentity,
      encryptedSummary: encryptJson(summary),
      patientHash,
      chainIdentity: null,
      registryAccountId: null,
      auditRef: null,
    });
    savePatientPolicy(patientId, policy);
    deletePatientDocuments(patientId);

    for (const file of files) {
      const documentId = buildDocumentId(patientId, file.name);
      const bytes = Buffer.from(await file.arrayBuffer());
      const storagePath = writeEncryptedDocument(
        patientId,
        documentId,
        encryptBuffer(bytes),
      );
      savePatientDocumentMetadata({
        id: documentId,
        patientId,
        title: path.basename(file.name),
        mimeType: file.type || "application/octet-stream",
        storagePath,
        patientApproved: true,
      });
    }

    return NextResponse.json({
      ok: true,
      patientId,
      solanaAuditEnabled: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create patient profile",
      },
      { status: 500 },
    );
  }
}
