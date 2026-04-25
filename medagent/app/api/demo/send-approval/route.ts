import { NextResponse } from "next/server";

import { getAccessRequest, getApprovalByRequestId } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { requestId?: string };
  const requestId = body.requestId;

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  const approval = getApprovalByRequestId(requestId);
  const accessRequest = getAccessRequest(requestId);

  if (!approval || !accessRequest) {
    return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
  }

  return NextResponse.json({
    sent: true,
    method: approval.method,
    approvalToken: approval.token,
    preview: `Mocked ${approval.method} dispatch sent to patient ${approval.patient_id} for ${accessRequest.requester_label}.`,
  });
}
