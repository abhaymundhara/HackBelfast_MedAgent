import { NextResponse } from "next/server";

import {
  getAccessRequest,
  getApprovalByRequestId,
  getSessionByRequestId,
} from "@/lib/db";
import { AccessRequestStatusSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const accessRequest = getAccessRequest(params.id);
  if (!accessRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const approval = getApprovalByRequestId(params.id);
  const session = getSessionByRequestId(params.id);

  let status: AccessRequestStatusSnapshot["status"] = "pending";

  if (session) {
    status = "granted";
  } else if (approval?.status === "expired" || accessRequest.status === "expired") {
    status = "expired";
  } else if (approval?.status === "denied" || accessRequest.status === "denied") {
    status = "denied";
  } else if (
    accessRequest.status === "approved_resuming" ||
    (approval?.status === "approved" && !session) ||
    (accessRequest.status === "granted" && !session)
  ) {
    status = "approved_resuming";
  } else if (accessRequest.status === "awaiting_approval") {
    status = "awaiting_approval";
  }

  return NextResponse.json({
    requestId: accessRequest.id,
    status,
    decision: accessRequest.decision as AccessRequestStatusSnapshot["decision"],
    tier: accessRequest.tier as AccessRequestStatusSnapshot["tier"],
    justification: accessRequest.justification,
    approvalMethod:
      (accessRequest.approval_method ?? approval?.method ?? null) as AccessRequestStatusSnapshot["approvalMethod"],
    approvalStatus:
      (approval?.status ?? null) as AccessRequestStatusSnapshot["approvalStatus"],
    approvalExpiresAt: approval?.expires_at ?? null,
    sessionId: session?.id ?? null,
  } satisfies AccessRequestStatusSnapshot);
}
