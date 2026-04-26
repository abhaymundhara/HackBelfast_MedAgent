import { NextRequest, NextResponse } from "next/server";

import { decryptJson } from "@/lib/crypto";
import { getAppointment, getPatientRow, getSharedRecord } from "@/lib/db";
import { getPublicAppBaseUrl } from "@/lib/appUrl";
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const share = getSharedRecord(id);

  if (!share) {
    return NextResponse.json(
      { message: "Share link not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const fieldsShared: string[] = JSON.parse(share.fields_shared);
  const isFullRecord = share.share_scope === "full_record";
  const fieldsText = isFullRecord
    ? "Full medical record"
    : fieldsShared.map((f) => f.charAt(0).toUpperCase() + f.slice(1)).join(", ");
  const appointment = share.appointment_id ? getAppointment(share.appointment_id) : null;

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
    statusText = "Status: Access Revoked";
  } else if (new Date(share.expires_at) <= new Date()) {
    statusText = "Status: Expired";
  } else {
    const remaining = new Date(share.expires_at).getTime() - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    statusText = `Expires in ${hours}h ${minutes}m`;
  }

  const chainLine = share.share_chain_ref && !share.share_chain_ref.startsWith("local-solana:")
    ? `Verified on Solana: ${getSolscanTxUrl(share.share_chain_ref)}`
    : "Audit logged locally";

  const isDisabled =
    share.status === "revoked" ||
    new Date(share.expires_at) <= new Date() ||
    share.access_count >= share.max_access_count;

  const appBaseUrl = getPublicAppBaseUrl();

  const response = {
    type: "action",
    icon: "https://raw.githubusercontent.com/nicecatch/medagent-assets/main/medical-record-blink.png",
    title: `MedAgent — ${patientName}'s Record`,
    description: [
      `Scope: ${fieldsText}`,
      appointment
        ? `Appointment: ${appointment.doctorName} at ${appointment.clinic}`
        : `Shared with: ${share.doctor_name}`,
      statusText,
      chainLine,
    ].join("\n"),
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
          href: `${appBaseUrl}/s/${share.short_code ?? id}`,
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
