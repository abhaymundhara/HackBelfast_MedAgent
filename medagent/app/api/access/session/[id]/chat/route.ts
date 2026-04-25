import { NextResponse } from "next/server";

import { answerFollowUpQuestion } from "@/lib/agent/medagent";
import { FollowUpQuestionSchema } from "@/lib/ips/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const payload = FollowUpQuestionSchema.parse(await request.json());
    const answer = await answerFollowUpQuestion(params.id, payload.question);
    return NextResponse.json(answer);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to answer question" },
      { status: 500 },
    );
  }
}
