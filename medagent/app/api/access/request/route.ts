import { NextResponse } from "next/server";

import { runMedAgentWorkflow } from "@/lib/agent/medagent";
import { getDemoClinician } from "@/lib/ips/seed";
import { AccessRequestSchema } from "@/lib/ips/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = AccessRequestSchema.parse(await request.json());
    const persona = getDemoClinician(payload.requesterId);

    const result = await runMedAgentWorkflow({
      input: {
        patientId: payload.patientId,
        requesterId: payload.requesterId,
        naturalLanguageRequest: payload.naturalLanguageRequest,
        targetLocale: persona?.locale ?? "en-GB",
        emergencyMode: payload.emergencyMode,
        presentedCredential: payload.presentedCredential,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process request" },
      { status: 500 },
    );
  }
}
