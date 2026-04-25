import { NextResponse } from "next/server";
import { getBridge } from "@/lib/imessage/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.IMESSAGE_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization") ?? request.headers.get("x-webhook-secret");
    if (authHeader !== secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const { chatGuid, text } = await request.json();
  if (!chatGuid || !text) {
    return NextResponse.json({ error: "chatGuid and text required" }, { status: 400 });
  }

  const bridge = getBridge();
  const result = await bridge.sendText({ chatGuid, text });
  return NextResponse.json(result);
}
