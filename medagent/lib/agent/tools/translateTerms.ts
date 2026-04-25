import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import { RetrievalResult } from "@/lib/rag/ragTypes";
import { RequestIntent, TranslationResult } from "@/lib/types";

const translationSchema = z.object({
  translated: z.record(z.string(), z.any()),
  glossary: z.array(
    z.object({
      original: z.string(),
      translated: z.string(),
    }),
  ),
  brief: z.string(),
});

const esGlossary: Record<string, string> = {
  allergy: "alergia",
  allergies: "alergias",
  medication: "medicación",
  medications: "medicaciones",
  anticoagulants: "anticoagulantes",
  discharge: "alta médica",
  emergency: "emergencia",
  implant: "implante",
  epilepsy: "epilepsia",
  diabetes: "diabetes",
  warfarin: "warfarina",
  asthma: "asma",
  seizure: "convulsión",
};

function buildFallbackBrief(
  requestIntent: RequestIntent,
  targetLocale: string,
  ragResults: RetrievalResult[],
) {
  const focus = requestIntent.priorityTopics.join(", ");
  const ragHighlights = ragResults
    .slice(0, 3)
    .map((result) => result.chunk.content)
    .join(" ");

  if (targetLocale === "es-ES") {
    return [
      `Foco solicitado: ${focus || "riesgos clínicos inmediatos"}.`,
      "El agente mantuvo el acceso dentro del subconjunto autorizado y resaltó primero los elementos más relevantes para esta solicitud.",
      ragHighlights
        ? `Contexto adicional de riesgo: ${ragHighlights}`
        : "Sin contexto adicional de notas clínicas locales para esta solicitud.",
      requestIntent.withheldRequestedFields.length
        ? "Parte de la información solicitada sigue bloqueada por la política de este nivel."
        : "No se amplió el acceso más allá de este nivel autorizado.",
    ].join(" ");
  }

  return [
    requestIntent.intentSummary,
    focus
      ? `Prioritize ${focus} when reviewing this session.`
      : "Prioritize the highest-signal emergency data available in this tier.",
    ragHighlights
      ? `Additional local emergency context: ${ragHighlights}`
      : "No additional local emergency note context was available for this request.",
  ].join(" ");
}

function getFallbackTranslation(
  summarySubset: Record<string, unknown>,
  targetLocale: string,
  requestIntent: RequestIntent,
  ragResults: RetrievalResult[],
) {
  const serialized = JSON.stringify(summarySubset, null, 2);
  if (targetLocale !== "es-ES") {
    return {
      translated: summarySubset,
      glossary: [] as { original: string; translated: string }[],
      brief: buildFallbackBrief(requestIntent, targetLocale, ragResults),
      mode: "fallback" as const,
    };
  }

  const glossary = Object.entries(esGlossary)
    .filter(([term]) => serialized.toLowerCase().includes(term))
    .map(([original, translated]) => ({ original, translated }));

  return {
    translated: {
      ...summarySubset,
      translationNotice:
        "Resumen traducido al español con fallback local porque no hay acceso activo al modelo.",
    },
    glossary,
    brief: buildFallbackBrief(requestIntent, targetLocale, ragResults),
    mode: "fallback" as const,
  };
}

export async function translateTerms(input: {
  summarySubset: Record<string, unknown>;
  targetLocale: string;
  requestIntent: RequestIntent;
  ragResults?: RetrievalResult[];
}): Promise<TranslationResult> {
  const ragResults = input.ragResults ?? [];

  if (!process.env.OPENAI_API_KEY) {
    return getFallbackTranslation(
      input.summarySubset,
      input.targetLocale,
      input.requestIntent,
      ragResults,
    );
  }

  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
    temperature: 0.1,
  }).withStructuredOutput(translationSchema);

  try {
    const result = await llm.invoke([
      [
        "system",
        "You are MedAgent. Translate only when useful for the target locale, do not invent facts, do not widen the authorized dataset, and return a concise clinician-ready brief limited to the provided authorized JSON payload and tier-compliant RAG snippets. The brief must visibly reflect the clinician request focus while acknowledging any requested areas withheld by policy.",
      ],
      [
        "human",
        `Target locale: ${input.targetLocale}
Request focus summary: ${input.requestIntent.intentSummary}
Priority topics: ${input.requestIntent.priorityTopics.join(", ") || "none"}
Matched authorized fields: ${input.requestIntent.matchedAuthorizedFields.join(", ") || "none"}
Requested but withheld in this tier: ${input.requestIntent.withheldRequestedFields.join(", ") || "none"}

Authorized summary subset JSON:
${JSON.stringify(input.summarySubset, null, 2)}

Tier-filtered local emergency RAG snippets (already policy/redaction filtered):
${JSON.stringify(
  ragResults.map((result) => ({
    date: result.chunk?.provenance?.timestamp ?? null,
    type: result.chunk?.noteType ?? "",
    content: result.chunk?.content ?? "",
    score:
      typeof result.score === "number" && Number.isFinite(result.score)
        ? Number(result.score.toFixed(4))
        : null,
    relevance: result.relevanceExplanation,
  })),
  null,
  2,
)}`,
      ],
    ]);

    return {
      translated: result.translated,
      glossary: result.glossary,
      brief: result.brief,
      mode: "llm",
    };
  } catch {
    return getFallbackTranslation(
      input.summarySubset,
      input.targetLocale,
      input.requestIntent,
      ragResults,
    );
  }
}
