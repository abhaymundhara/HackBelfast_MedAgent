import { NextRequest, NextResponse } from "next/server";

import { accessSharedDocument } from "@/lib/sharing/accessShare";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } },
) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Access token is required" }, { status: 400 });
  }

  const result = await accessSharedDocument({
    shareId: params.id,
    documentId: params.documentId,
    accessToken: token,
  });

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      not_found: 404,
      revoked: 403,
      expired: 403,
      rate_limited: 429,
      invalid_token: 403,
    };
    return NextResponse.json(result.error, {
      status: statusMap[result.error.code] ?? 400,
    });
  }

  return new NextResponse(new Uint8Array(result.data.bytes), {
    headers: {
      "content-type": result.data.mimeType,
      "content-disposition": `attachment; filename="${encodeURIComponent(result.data.title)}"`,
    },
  });
}
