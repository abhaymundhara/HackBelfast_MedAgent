import { NextRequest, NextResponse } from "next/server";

import { accessSharedRecord } from "@/lib/sharing/accessShare";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Access token is required" },
        { status: 400 },
      );
    }

    const result = await accessSharedRecord({
      shareId: params.id,
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
      return NextResponse.json(
        result.error,
        { status: statusMap[result.error.code] ?? 400 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Share access error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
