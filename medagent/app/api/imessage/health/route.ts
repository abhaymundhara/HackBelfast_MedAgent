import { NextResponse } from "next/server";
import { getBridge } from "@/lib/imessage/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.IMESSAGE_WEBHOOK_SECRET;
  if (secret) {
    const authorizationHeader = request.headers.get("authorization");
    const webhookHeader = request.headers.get("x-webhook-secret");
    const bearerSecret = `Bearer ${secret}`;
    const isAuthorized =
      authorizationHeader === secret ||
      authorizationHeader === bearerSecret ||
      webhookHeader === secret ||
      webhookHeader === bearerSecret;
    if (!isAuthorized) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const bridge = getBridge();
    const health = await bridge.isHealthy();
    if (!health.healthy) {
      return NextResponse.json(health, { status: 503 });
    }
    return NextResponse.json(health);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ healthy: false, detail: message }, { status: 500 });
  }
}
