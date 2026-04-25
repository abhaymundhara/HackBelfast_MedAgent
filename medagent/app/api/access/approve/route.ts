import { NextResponse } from "next/server";

import { denyApprovedRequest, resumeApprovedRequest } from "@/lib/agent/medagent";
import { getApprovalByToken, updateApprovalStatus } from "@/lib/db";
import { ApprovalActionSchema } from "@/lib/ips/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = ApprovalActionSchema.parse(await request.json());
    const approval = getApprovalByToken(payload.approvalToken);

    if (!approval || approval.request_id !== payload.requestId) {
      return NextResponse.json({ error: "Approval token not found" }, { status: 404 });
    }

    if (approval.status !== "pending") {
      return NextResponse.json(
        { error: `Approval request is already ${approval.status}.` },
        { status: 409 },
      );
    }

    if (payload.approved) {
      updateApprovalStatus(payload.approvalToken, "approved");
      const outcome = await resumeApprovedRequest(payload.requestId);
      return NextResponse.json(outcome);
    }

    const outcome = await denyApprovedRequest(payload.requestId, payload.approvalToken);
    return NextResponse.json(outcome);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process approval" },
      { status: 500 },
    );
  }
}
