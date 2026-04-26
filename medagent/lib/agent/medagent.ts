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
import { getSession, getPatientSummary } from "@/lib/db";
import { sha256Hash } from "@/lib/crypto";
import { retrieve } from "@/lib/rag/ragClient";
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

const patientQuerySchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
});

/**
 * Answer a patient's question about their own medical record using RAG retrieval + LLM synthesis.
 */
export async function answerPatientRecordQuery(
  patientId: string,
  question: string,
): Promise<{ answer: string; sources: string[] }> {
  const summary = getPatientSummary(patientId);
  if (!summary) {
    return {
      answer: "I don't have a medical record on file for you yet. Please upload your medical report PDF first.",
      sources: [],
    };
  }

  const patientHash = sha256Hash(
    `${patientId}:${summary.demographics.email}`,
  );

  // Retrieve relevant chunks from RAG
  const results = await retrieve(patientHash, question, 5);

  // Build context from RAG results + structured summary
  const ragContext = results.length > 0
    ? results.map((r, i) => `[${i + 1}] ${r.chunk.content}`).join("\n\n")
    : "";

  const structuredContext = JSON.stringify({
    demographics: summary.demographics,
    allergies: summary.allergies,
    medications: summary.medications,
    conditions: summary.conditions,
    alerts: summary.alerts,
    emergencyContact: summary.emergencyContact,
    recentDischarge: summary.recentDischarge,
  }, null, 2);

  const combinedContext = [
    "=== Structured Medical Summary ===",
    structuredContext,
    ragContext ? "\n=== Retrieved Document Excerpts ===" : "",
    ragContext,
  ].filter(Boolean).join("\n");

  if (!process.env.OPENAI_API_KEY) {
    // Deterministic fallback: search the structured summary for relevant info
    const lower = question.toLowerCase();
    const parts: string[] = [];

    if (/allerg/i.test(lower) && summary.allergies.length > 0) {
      parts.push("Allergies: " + summary.allergies.map(a => `${a.substance} (${a.severity})`).join(", "));
    }
    if (/medication|medicine|drug|prescription/i.test(lower) && summary.medications.length > 0) {
      parts.push("Medications: " + summary.medications.map(m => `${m.name} ${m.dose} ${m.frequency}`).join(", "));
    }
    if (/condition|diagnosis|diagnoses/i.test(lower) && summary.conditions.length > 0) {
      parts.push("Conditions: " + summary.conditions.map(c => c.label).join(", "));
    }
    if (/blood type/i.test(lower) && summary.demographics.bloodType) {
      parts.push(`Blood type: ${summary.demographics.bloodType}`);
    }
    if (/emergency contact|next of kin/i.test(lower) && summary.emergencyContact) {
      parts.push(`Emergency contact: ${summary.emergencyContact.name} (${summary.emergencyContact.relation}) ${summary.emergencyContact.phone}`);
    }
    if (/discharge/i.test(lower) && summary.recentDischarge) {
      parts.push(`Recent discharge: ${summary.recentDischarge}`);
    }

    if (parts.length === 0) {
      // General summary
      parts.push(`Name: ${summary.demographics.name}, DOB: ${summary.demographics.dob}`);
      if (summary.allergies.length) parts.push("Allergies: " + summary.allergies.map(a => a.substance).join(", "));
      if (summary.medications.length) parts.push("Medications: " + summary.medications.map(m => m.name).join(", "));
      if (summary.conditions.length) parts.push("Conditions: " + summary.conditions.map(c => c.label).join(", "));
    }

    return {
      answer: parts.join("\n"),
      sources: results.map(r => r.chunk.noteType ?? "document"),
    };
  }

  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
    temperature: 0.1,
  }).withStructuredOutput(patientQuerySchema);

  const response = await llm.invoke([
    [
      "system",
      `You are MedAgent, a secure medical record assistant. The patient is asking about their own medical record. Answer ONLY from the provided medical context below. Be accurate, concise, and clinical. If the information is not in the context, say so clearly. Never fabricate medical information.

${combinedContext}`,
    ],
    [
      "human",
      question,
    ],
  ]);

  return {
    answer: response.answer,
    sources: response.sources,
  };
}
