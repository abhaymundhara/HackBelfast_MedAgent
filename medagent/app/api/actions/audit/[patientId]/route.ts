import { NextRequest, NextResponse } from "next/server";

import { decryptJson } from "@/lib/crypto";
import { getPatientRow, getPatientAccountByPatientId, listAuditEvents } from "@/lib/db";
import { getSolscanTxUrl } from "@/lib/solana/client";
import { EmergencySummary } from "@/lib/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const patient = getPatientRow(patientId);

  if (!patient) {
    return NextResponse.json(
      { message: "Patient not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  let patientName = "Patient";
  try {
    const summary = decryptJson<EmergencySummary>(patient.encrypted_summary);
    patientName = summary.demographics.name;
  } catch {
    // Use fallback name
  }

  const events = listAuditEvents(patientId);
  const onChainCount = events.filter(
    (e) => e.chainRef && !e.chainRef.startsWith("local-solana:"),
  ).length;

  const account = getPatientAccountByPatientId(patientId);
  const pda = account?.solana_log_pda ?? null;

  const latestOnChain = events.find(
    (e) => e.chainRef && !e.chainRef.startsWith("local-solana:"),
  );
  const latestProof = latestOnChain
    ? getSolscanTxUrl(latestOnChain.chainRef!)
    : null;

  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const description = [
    `${onChainCount} audit event${onChainCount !== 1 ? "s" : ""} verified on Solana`,
    `${events.length} total interactions logged`,
    pda ? `Solana audit PDA: ${pda.slice(0, 8)}...${pda.slice(-4)}` : null,
    latestProof ? `Latest proof: ${latestProof}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = {
    type: "action",
    icon: "https://raw.githubusercontent.com/nicecatch/medagent-assets/main/medical-record-blink.png",
    title: `MedAgent — ${patientName}'s Audit Trail`,
    description,
    label: "View Full Audit Trail",
    links: {
      actions: [
        {
          type: "external-link",
          href: `${appBaseUrl}/audit/${patientId}`,
          label: "View Full Audit Trail",
        },
      ],
    },
  };

  return NextResponse.json(response, {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
