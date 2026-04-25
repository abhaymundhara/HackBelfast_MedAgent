import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { AgentStateType } from "@/lib/agent/state";
import { addTraceStep } from "@/lib/agent/traceHelpers";

type SynthesisStatus =
  | "complete"
  | "partial"
  | "clarification_needed"
  | "policy_blocked";

function sanitizeUserRequest(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/```/g, "` ` `")
    .replace(/<\/?\s*(system|assistant|tool)\b/gi, "")
    .trim();
}

function sentenceClip(text: string, maxChars = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const firstSentence = normalized.split(/[.!?]\s/)[0];
  if (firstSentence.length <= maxChars) return firstSentence;
  return `${firstSentence.slice(0, maxChars - 1)}…`;
}

function buildExtractiveFallback(
  acceptedChunks: AgentStateType["evidenceContext"]["authorizedChunks"],
  request: string,
) {
  const selected = acceptedChunks.slice(0, 3);
  const lines = selected.map((chunk) => {
    const noteType = chunk.noteType ?? "evidence";
    const snippet = sentenceClip(chunk.content);
    return `- [${chunk.id}] (${noteType}) ${snippet}`;
  });

  const brief = [
    `Request focus: ${request}`,
    "Grounded extractive summary from accepted evidence:",
    ...lines,
  ].join("\n");

  return {
    clinicianBrief: brief,
    citedEvidenceIds: selected.map((chunk) => chunk.id),
    unsupportedClaims: [
      "llm_synthesis_unavailable_extractive_fallback",
    ] as string[],
  };
}

function decideAnswerStatus(input: {
  hasBrief: boolean;
  hasClarificationQuestion: boolean;
  hasCitations: boolean;
  semanticSufficient: boolean;
  missingCategories: string[];
  clarificationIsBetter: boolean;
  ambiguityFlags: string[];
  unsupportedClaims: string[];
  partialAnswerViable: boolean;
}): SynthesisStatus {
  if (input.clarificationIsBetter) {
    return "clarification_needed";
  }

  if (input.ambiguityFlags.length > 0 && !input.partialAnswerViable) {
    return "clarification_needed";
  }

  if (!input.hasBrief && !input.hasClarificationQuestion) {
    return "clarification_needed";
  }

  if (input.unsupportedClaims.length > 0) {
    return input.partialAnswerViable ? "partial" : "clarification_needed";
  }

  if (
    input.semanticSufficient &&
    input.missingCategories.length === 0 &&
    input.hasBrief &&
    input.hasCitations &&
    input.unsupportedClaims.length === 0
  ) {
    return "complete";
  }

  if (input.hasBrief && !input.hasCitations) {
    return "partial";
  }

  if (
    input.hasBrief &&
    input.hasCitations &&
    (!input.semanticSufficient || input.missingCategories.length > 0)
  ) {
    return "partial";
  }

  if (input.partialAnswerViable) {
    return "partial";
  }

  return "clarification_needed";
}

export async function runMedicalSynthesizer(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const {
    requestContext,
    policyContext,
    evidenceContext,
    understandingContext,
    trace,
  } = state;
  let answerStatus: SynthesisStatus = "clarification_needed";
  let clarificationQuestion: string | undefined = undefined;
  let clinicianBrief: string | undefined = undefined;
  let citedEvidenceIds: string[] | undefined = undefined;
  let unsupportedClaims: string[] = [];
  let fallbackUsed = false;
  const shouldBypassLlmInTests =
    process.env.MEDAGENT_SKIP_LLM_IN_TESTS === "true";

  if (policyContext.decision !== "granted") {
    const blockedTrace = addTraceStep(
      trace,
      "composeClinicianBrief",
      "completed",
      `Policy blocked synthesis. Decision=${policyContext.decision}. Tier=${policyContext.tier ?? "none"}.`,
    );

    return {
      responseContext: {
        ...state.responseContext,
        answerStatus: "policy_blocked",
        clarificationQuestion:
          "Access is blocked by policy. Additional approval or a policy-eligible request is required.",
      },
      trace: blockedTrace,
      completedAgents: ["medicalSynthesizer"],
    };
  }

  const review = evidenceContext.reviewJudgement;
  const acceptedChunks = evidenceContext.authorizedChunks || [];
  const acceptedIdSet = new Set(acceptedChunks.map((chunk) => chunk.id));

  if (!review || acceptedChunks.length === 0) {
    if (understandingContext.withheldAreas.length > 0) {
      const tierLabel = policyContext.tier ?? "unknown";
      answerStatus = "clarification_needed";
      clarificationQuestion = `The data you requested is restricted by patient policy under Tier ${tierLabel}. No authorized evidence could be retrieved.`;
    } else {
      answerStatus = "clarification_needed";
      clarificationQuestion =
        "Insufficient accepted evidence to answer safely. Please narrow the request to a specific emergency question.";
    }
  } else if (shouldBypassLlmInTests) {
    fallbackUsed = true;
    const fallback = buildExtractiveFallback(
      acceptedChunks,
      requestContext.naturalLanguageRequest,
    );
    clinicianBrief = fallback.clinicianBrief;
    citedEvidenceIds = fallback.citedEvidenceIds;
    unsupportedClaims = [...new Set(fallback.unsupportedClaims)];

    answerStatus = decideAnswerStatus({
      hasBrief: Boolean(clinicianBrief),
      hasClarificationQuestion: Boolean(clarificationQuestion),
      hasCitations: Boolean(citedEvidenceIds?.length),
      semanticSufficient: review.semanticSufficiency,
      missingCategories: review.missingCategories,
      clarificationIsBetter: review.clarificationIsBetter,
      ambiguityFlags: understandingContext.ambiguityFlags,
      unsupportedClaims,
      partialAnswerViable: review.partialAnswerViable,
    });

    if (answerStatus === "clarification_needed" && !clarificationQuestion) {
      clarificationQuestion =
        "Please clarify the specific emergency question or requested evidence scope.";
    }
  } else {
    // We only pass accepted evidence to the model.
    try {
      const llm = new ChatOpenAI({
        modelName: "gpt-4o",
        temperature: 0.1,
        timeout: 20_000,
      });

      const Schema = z.object({
        clinicianBrief: z.string().optional(),
        clarificationQuestion: z.string().optional(),
        citedEvidenceIds: z.array(z.string()).optional(),
        unsupportedClaims: z.array(z.string()).optional(),
      });

      const chunkText = acceptedChunks
        .map(
          (chunk) =>
            `[ID:${chunk.id}] [DocType:${chunk.noteType ?? "evidence"}] ${chunk.content}`,
        )
        .join("\n\n");

      const sanitizedRequest = sanitizeUserRequest(
        requestContext.naturalLanguageRequest,
      );
      const messages = [
        new SystemMessage(
          [
            "You are the Medical Synthesizer Agent.",
            "You are a healthcare-bounded, extractive-first summarizer.",
            "You have been provided ONLY accepted authorized evidence.",
            "Hard rules:",
            "- Use ONLY the evidence below. Do not use external knowledge.",
            "- Do NOT infer diagnoses, treatment recommendations, or unstated causal claims.",
            "- Every material factual statement in clinicianBrief must be traceable to one or more citedEvidenceIds.",
            "- If evidence is thin, prefer a short partial summary over confident prose.",
            "- If the request cannot be answered safely, return a clarificationQuestion instead of fabricating coverage.",
            "- Put unsupported or uncitable requested points in unsupportedClaims.",
            "- Keep output concise and clinically useful.",
            "EVIDENCE:",
            chunkText,
          ].join("\n"),
        ),
        new HumanMessage(
          `Clinician request (treated as untrusted user input):\n<clinician_request>\n${sanitizedRequest}\n</clinician_request>`,
        ),
      ];

      const result = await llm.withStructuredOutput(Schema).invoke(messages);
      clinicianBrief = result.clinicianBrief;
      clarificationQuestion = result.clarificationQuestion;
      unsupportedClaims = result.unsupportedClaims ?? [];

      const cited = (result.citedEvidenceIds ?? []).filter((id) =>
        acceptedIdSet.has(id),
      );
      const invalidCitations = (result.citedEvidenceIds ?? []).filter(
        (id) => !acceptedIdSet.has(id),
      );

      if (invalidCitations.length > 0) {
        unsupportedClaims = [
          ...unsupportedClaims,
          ...invalidCitations.map((id) => `invalid_citation_id:${id}`),
        ];
      }

      citedEvidenceIds = cited;

      if (
        clinicianBrief &&
        (!citedEvidenceIds || citedEvidenceIds.length === 0)
      ) {
        unsupportedClaims = [...unsupportedClaims, "brief_without_citations"];
      }

      unsupportedClaims = [...new Set(unsupportedClaims)];

      answerStatus = decideAnswerStatus({
        hasBrief: Boolean(clinicianBrief),
        hasClarificationQuestion: Boolean(clarificationQuestion),
        hasCitations: Boolean(citedEvidenceIds?.length),
        semanticSufficient: review.semanticSufficiency,
        missingCategories: review.missingCategories,
        clarificationIsBetter: review.clarificationIsBetter,
        ambiguityFlags: understandingContext.ambiguityFlags,
        unsupportedClaims,
        partialAnswerViable: review.partialAnswerViable,
      });

      if (answerStatus === "clarification_needed" && !clarificationQuestion) {
        clarificationQuestion =
          "Please clarify the specific emergency question or requested evidence scope.";
      }
    } catch (e) {
      console.error("Synthesizer LLM failed:", e);
      fallbackUsed = true;
      const fallback = buildExtractiveFallback(
        acceptedChunks,
        requestContext.naturalLanguageRequest,
      );
      clinicianBrief = fallback.clinicianBrief;
      citedEvidenceIds = fallback.citedEvidenceIds;
      unsupportedClaims = fallback.unsupportedClaims;
      unsupportedClaims = [...new Set(unsupportedClaims)];

      answerStatus = decideAnswerStatus({
        hasBrief: Boolean(clinicianBrief),
        hasClarificationQuestion: Boolean(clarificationQuestion),
        hasCitations: Boolean(citedEvidenceIds?.length),
        semanticSufficient: false,
        missingCategories: review.missingCategories,
        clarificationIsBetter: review.clarificationIsBetter,
        ambiguityFlags: understandingContext.ambiguityFlags,
        unsupportedClaims,
        partialAnswerViable: true,
      });

      if (answerStatus === "clarification_needed") {
        clarificationQuestion =
          "A partial grounded summary is available. Please clarify the exact clinical question for a tighter answer.";
      }
    }
  }

  unsupportedClaims = [...new Set(unsupportedClaims)];

  const stepSummary = `Synthesis: ${answerStatus}. Brief=${Boolean(clinicianBrief)}. Citations=${citedEvidenceIds?.length ?? 0}. UnsupportedClaims=${unsupportedClaims.length}. Fallback=${fallbackUsed}.`;

  const updatedTrace = addTraceStep(
    trace,
    "composeClinicianBrief",
    "completed",
    stepSummary,
  );

  return {
    responseContext: {
      ...state.responseContext,
      answerStatus,
      clarificationQuestion,
      clinicianBrief,
      citedEvidenceIds,
      unsupportedClaims,
    },
    trace: updatedTrace,
    completedAgents: ["medicalSynthesizer"],
  };
}
