import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { validatePatientJwt } from "@/lib/auth/patientAuth";
import { revokeShareRecord } from "@/lib/sharing/revokeShare";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = cookies().get("patient_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = validatePatientJwt(token);
    if (!session.valid || !session.patientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await revokeShareRecord({
      shareId: params.id,
      patientId: session.patientId,
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
