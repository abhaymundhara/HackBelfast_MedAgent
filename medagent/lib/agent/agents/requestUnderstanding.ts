import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { AgentStateType } from "@/lib/agent/state";
import { addTraceStep } from "@/lib/agent/traceHelpers";

// Fallback keyword extraction logic
const KEYWORD_MAP = [
  {
    topic: "allergies",
    keys: [
      "allergy",
      "allergies",
      "allergic",
      "anaphylaxis",
      "reaction",
      "rash",
    ],
  },
  {
    topic: "medications",
    keys: [
      "medication",
      "medications",
      "medicine",
      "medicines",
      "meds",
      "drug",
      "dose",
      "anticoagulant",
      "warfarin",
      "insulin",
    ],
  },
  {
    topic: "conditions",
    keys: [
      "condition",
      "history",
      "diagnosis",
      "seizure",
      "epilepsy",
      "diabetes",
      "asthma",
      "implant",
    ],
  },
  {
    topic: "alerts",
    keys: ["alert", "risk", "contraindication", "critical", "warning", "dnr"],
  },
  {
    topic: "emergencyContact",
    keys: ["contact", "family", "next of kin", "relative", "call"],
  },
];

function fallbackUnderstanding(
  request: string | null | undefined,
): Partial<AgentStateType["understandingContext"]> {
  const lowerReq = (request ?? "").toLowerCase();
  const focusAreas: string[] = [];

  for (const { topic, keys } of KEYWORD_MAP) {
    if (keys.some((k) => lowerReq.includes(k))) {
      focusAreas.push(topic);
    }
  }

  return {
    focusAreas,
    suggestedStrategy:
      focusAreas.length > 0 ? "targeted_keyword" : "broad_semantic",
    ambiguityFlags: [],
  };
}

function sanitizeUserInput(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/```/g, "` ` `")
    .replace(/<\/?\s*(system|assistant|tool)\b/gi, "")
    .trim();
}

export async function runRequestUnderstanding(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const { requestContext, policyContext, trace } = state;

  if (policyContext.decision !== "granted") {
    return {
      completedAgents: ["requestUnderstanding"],
    };
  }

  let understanding = fallbackUnderstanding(
    requestContext.naturalLanguageRequest,
  );

  const shouldBypassLlmInTests =
    process.env.MEDAGENT_SKIP_LLM_IN_TESTS === "true";

  if (shouldBypassLlmInTests) {
    const updatedTrace = addTraceStep(
      trace,
      "analyzeRequestIntent",
      "completed",
      `Analyzed intent via deterministic fallback (test mode). Strategy: ${understanding.suggestedStrategy}. Focus: ${understanding.focusAreas?.join(", ") || "None"}.`,
    );

    return {
      understandingContext: {
        ...state.understandingContext,
        ...understanding,
        withheldAreas: understanding.withheldAreas || [],
      },
      trace: updatedTrace,
      completedAgents: ["requestUnderstanding"],
    };
  }

  try {
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.1,
      timeout: 20_000,
    });

    const Schema = z.object({
      focusAreas: z
        .array(z.string())
        .describe("List of exact relevant topics extracted from request."),
      withheldAreas: z
        .array(z.string())
        .describe(
          "Topics the clinician asked for, but we know policy rejects. (Look at policyContext.fieldsAllowed)",
        ),
      ambiguityFlags: z
        .array(z.string())
        .describe("Parts of the query that are unclear or vague."),
      suggestedStrategy: z.enum([
        "targeted_keyword",
        "broad_semantic",
        "hybrid",
        "fallback",
      ]),
    });

    const safeAllowedFields = (policyContext.fieldsAllowed ?? [])
      .filter((field) => typeof field === "string" && field.trim().length > 0)
      .map((field) => field.trim());
    const sanitizedRequest = sanitizeUserInput(
      requestContext.naturalLanguageRequest,
    );

    const messages = [
      new SystemMessage(
        [
          "You are the Request Understanding Agent in a medical emergency system.",
          `Allowed Policy Fields: ${JSON.stringify(safeAllowedFields)}`,
          "Analyze the clinician request.",
          "Extract the focus areas they care about.",
          'Identify if they asked for things outside the "Allowed Policy Fields" and mark them as withheld.',
          "Identify any clinical ambiguities in their wording.",
          "Suggest a retrieval strategy (targeted_keyword, broad_semantic, hybrid).",
        ].join("\n"),
      ),
      new HumanMessage(
        `user_input:\n<clinician_request>\n${sanitizedRequest}\n</clinician_request>`,
      ),
    ];

    const structuredLlm = llm.withStructuredOutput(Schema);
    const result = await structuredLlm.invoke(messages);

    understanding = {
      focusAreas: result.focusAreas,
      withheldAreas: result.withheldAreas,
      ambiguityFlags: result.ambiguityFlags,
      suggestedStrategy: result.suggestedStrategy,
    };
  } catch (error) {
    console.error(
      "LLM Understanding failed or timed out, using fallback.",
      error,
    );
    // fallback logic already populated
  }

  const updatedTrace = addTraceStep(
    trace,
    "analyzeRequestIntent",
    "completed",
    `Analyzed intent. Strategy: ${understanding.suggestedStrategy}. Focus: ${understanding.focusAreas?.join(", ") || "None"}.`,
  );

  return {
    understandingContext: {
      ...state.understandingContext,
      ...understanding,
      withheldAreas: understanding.withheldAreas || [],
    },
    trace: updatedTrace,
    completedAgents: ["requestUnderstanding"],
  };
}
