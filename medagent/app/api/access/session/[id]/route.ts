import { NextResponse } from "next/server";

import { getSession } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = getSession(params.id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      requestId: session.request_id,
      patientId: session.patient_id,
      requesterId: session.requester_id,
      tier: session.tier,
      expiresAt: session.expires_at,
      brief: session.brief,
      fieldsAllowed: session.fieldsAllowed,
      chainRef: session.chain_ref,
      chainSequence: session.chain_sequence,
      chainTimestamp: session.chain_timestamp,
      createdAt: session.created_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to fetch session",
      },
      { status: 500 },
    );
  }
}
