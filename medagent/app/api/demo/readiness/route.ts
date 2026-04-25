import { NextResponse } from "next/server";

import { runDemoReadinessCheck } from "@/lib/solana/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runDemoReadinessCheck();
    return NextResponse.json(result, {
      status: result.ready ? 200 : 503,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to run demo readiness check" },
      { status: 500 },
    );
  }
}
