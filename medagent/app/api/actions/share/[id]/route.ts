import { NextRequest, NextResponse } from "next/server";

import { decryptJson } from "@/lib/crypto";
import { getPatientRow, getSharedRecord } from "@/lib/db";
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
  { params }: { params: { id: string } },
) {
  const share = getSharedRecord(params.id);

  if (!share) {
    return NextResponse.json(
      { message: "Share link not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const fieldsShared: string[] = JSON.parse(share.fields_shared);
  const fieldsText = fieldsShared
    .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
    .join(", ");

  let patientName = "Patient";
  const patient = getPatientRow(share.patient_id);
  if (patient) {
    try {
      const summary = decryptJson<EmergencySummary>(patient.encrypted_summary);
      patientName = summary.demographics.name;
    } catch {
      // Use fallback name
    }
  }

  let statusText = "";
  if (share.status === "revoked") {
    statusText = "\nStatus: Access Revoked";
  } else if (new Date(share.expires_at) <= new Date()) {
    statusText = "\nStatus: Expired";
  } else {
    const remaining = new Date(share.expires_at).getTime() - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    statusText = `\nExpires in ${hours}h ${minutes}m`;
  }

  const isDisabled =
    share.status === "revoked" ||
    new Date(share.expires_at) <= new Date() ||
    share.access_count >= share.max_access_count;

  const response = {
    type: "action",
    icon: "https://raw.githubusercontent.com/nicecatch/medagent-assets/main/medical-record-blink.png",
    title: `Medical Record — ${patientName}`,
    description: `Shared fields: ${fieldsText}${statusText}\nVerified on Solana`,
    label: "View Record",
    disabled: isDisabled,
    ...(isDisabled && {
      error: {
        message:
          share.status === "revoked"
            ? "Access has been revoked by the patient"
            : new Date(share.expires_at) <= new Date()
              ? "This share link has expired"
              : "Maximum view count reached",
      },
    }),
    links: {
      actions: [
        {
          type: "external-link",
          href: `/share/${params.id}`,
          label: "View Record",
        },
      ],
    },
  };

  return NextResponse.json(response, {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
