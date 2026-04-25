import { NextRequest, NextResponse } from "next/server";

import { registerPatient } from "@/lib/auth/patientAuth";
import { encryptJson, sha256Hash } from "@/lib/crypto";
import {
  savePatientPolicy,
  setPatientAccountSolanaLogPda,
  upsertPatient,
} from "@/lib/db";
import { solanaAuditStore } from "@/lib/solana/auditStore";
import { EmergencySummary, PatientPolicy } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      phone,
      password,
      name,
      dob,
      bloodType,
      allergies,
      medications,
      conditions,
      emergencyContact,
    } = body;

    if (!email || !password || !name || !dob) {
      return NextResponse.json(
        { error: "email, password, name, and dob are required" },
        { status: 400 },
      );
    }

    const patientId = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const summary = EmergencySummary.parse({
      patientId,
      demographics: {
        name,
        dob,
        sex: body.sex ?? "other",
        bloodType: bloodType ?? undefined,
        languages: body.languages ?? ["English"],
        homeCountry: body.homeCountry ?? "United Kingdom",
        homeJurisdiction: body.homeJurisdiction ?? "NI",
        email,
      },
      allergies: (allergies ?? []).map((a: string) => ({
        substance: a,
        severity: "moderate" as const,
        reaction: "",
      })),
      medications: (medications ?? []).map((m: string) => ({
        name: m,
        dose: "",
        frequency: "",
        critical: false,
      })),
      conditions: (conditions ?? []).map((c: string) => ({
        label: c,
        major: false,
      })),
      alerts: [],
      emergencyContact: emergencyContact ?? {
        name: "Not provided",
        relation: "Unknown",
        phone: "",
      },
      documents: [],
    });

    const patientHash = sha256Hash(`${patientId}:${email}`);

    upsertPatient({
      patientId,
      localIdentity: `patient:${patientId}`,
      encryptedSummary: encryptJson(summary),
      patientHash,
    });

    savePatientPolicy(
      patientId,
      PatientPolicy.parse({
        emergencyAutoAccess: true,
        allowPatientApprovalRequests: true,
        breakGlassAllowed: true,
        shareableDocumentIds: [],
      }),
    );

    const result = await registerPatient({
      email,
      phone,
      password,
      patientId,
    });

    const solanaLog = await solanaAuditStore.initializePatientLog({
      patientHash,
    });
    if (solanaLog.pda) {
      setPatientAccountSolanaLogPda(patientId, solanaLog.pda);
    }

    return NextResponse.json({
      accountId: result.accountId,
      jwt: result.jwt,
      patientId,
      solanaLogPda: solanaLog.pda,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }
    console.error("Patient register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
