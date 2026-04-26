import { NextResponse } from "next/server";
import { getSharedRecordByShortCode } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const share = getSharedRecordByShortCode(code);

  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (share.status === "revoked") {
    return NextResponse.json(
      { error: "This share has been revoked by the patient" },
      { status: 410 },
    );
  }

  if (new Date(share.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This share link has expired" },
      { status: 410 },
    );
  }

  const token = share.short_token ?? "";
  const fullUrl = `/share/${share.id}#token=${token}`;
  return NextResponse.redirect(new URL(fullUrl, _request.url));
}
