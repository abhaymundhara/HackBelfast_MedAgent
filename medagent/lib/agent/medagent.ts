/**
 * medagent.ts — Backward-compatible re-export shim
 *
 * The workflow implementation now lives in supervisor.ts (hierarchical
 * supervisor + sub-agent pattern). This file re-exports all public symbols
 * so existing call-sites (API routes, scripts, tests) work without changes.
 *
 * answerFollowUpQuestion is kept here because it is session-scoped and does
 * not require a LangGraph sub-agent.
 */

export {
  runMedAgentWorkflow,
  createPendingRequest,
  resumeApprovedRequest,
  denyApprovedRequest,
} from "@/lib/agent/supervisor";

import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { getSession } from "@/lib/db";
import { FollowUpAnswer } from "@/lib/types";

const followUpSchema = z.object({
  answer: z.string(),
  citedFields: z.array(z.string()),
});


export async function answerFollowUpQuestion(
  sessionId: string,
  question: string,
): Promise<FollowUpAnswer> {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const payload = {
    brief: session.brief,
    translatedSummary: session.translatedSummary,
    fieldsAllowed: session.fieldsAllowed,
  };

  if (!process.env.OPENAI_API_KEY) {
    const serialized = JSON.stringify(payload).toLowerCase();
    const citedFields = session.fieldsAllowed.filter((field) =>
      question.toLowerCase().includes(field.toLowerCase()),
    );
    return {
      answer: serialized.includes("allerg")
        ? "Authorized data confirms allergy information is present in this session payload. Review the allergy section and emergency contact before acting."
        : "Authorized session data is limited to the released fields shown on screen. No broader history is available in this session.",
      citedFields,
      mode: "fallback",
    };
  }

  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
    temperature: 0.1,
  }).withStructuredOutput(followUpSchema);

  const answer = await llm.invoke([
    [
      "system",
      "You are MedAgent. Answer only from the authorized session payload. If the answer is not in the payload, say it is unavailable in this tier. Never widen access.",
    ],
    [
      "human",
      `Authorized payload JSON:\n${JSON.stringify(payload, null, 2)}\n\nQuestion: ${question}`,
    ],
  ]);

  return {
    answer: answer.answer,
    citedFields: answer.citedFields,
    mode: "llm",
  };
}
