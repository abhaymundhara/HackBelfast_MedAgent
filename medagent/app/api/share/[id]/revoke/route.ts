import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { validatePatientJwt } from "@/lib/auth/patientAuth";
import { sha256Hash } from "@/lib/crypto";
import { getSharedRecord } from "@/lib/db";
import { revokeShareRecord } from "@/lib/sharing/revokeShare";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: shareId } = await params;

    // Try JWT auth first (dashboard flow)
    const token = (await cookies()).get("patient_token")?.value;
    if (token) {
      const session = validatePatientJwt(token);
      if (session.valid && session.patientId) {
        const result = await revokeShareRecord({
          shareId,
          patientId: session.patientId,
        });
        return NextResponse.json(result);
      }
    }

    // Fall back to revoke token auth (iMessage flow)
    let revokeToken: string | undefined;
    try {
      const body = await request.json();
      revokeToken = body.token;
    } catch {
      // No body or invalid JSON
    }

    if (!revokeToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const share = getSharedRecord(shareId);
    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    const revokeTokenHash = sha256Hash(revokeToken);
    if (
      !(share as Record<string, unknown>).revoke_token_hash ||
      revokeTokenHash !== (share as Record<string, unknown>).revoke_token_hash
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Token is valid — revoke using the share's patient_id
    const result = await revokeShareRecord({
      shareId,
      patientId: share.patient_id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    if (status === 500) console.error("Share revoke error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
