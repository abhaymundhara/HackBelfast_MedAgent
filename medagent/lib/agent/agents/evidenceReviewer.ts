import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { AgentStateType } from "@/lib/agent/state";
import { computeRetryDecision } from "@/lib/agent/policy/retryDecision";
import { addTraceStep } from "@/lib/agent/traceHelpers";

function deriveRetrievalTelemetry(state: AgentStateType) {
  const retrieval = state.retrievalContext;
  const executionLog = retrieval.executionLog ?? [];
  const planCount = retrieval.queryPlans?.length ?? 0;
  const totalUniqueCandidates = retrieval.totalUniqueCandidates;
  const totalRagCandidates = retrieval.totalRagCandidates;
  const rawCandidates = retrieval.rawCandidates ?? [];

  const zeroResultPlanCount = executionLog.filter(
    (record) => record.zeroResult,
  ).length;
  const plansWithRagHits = executionLog.filter(
    (record) => record.ragReturnedCount > 0 || record.ragContributedCount > 0,
  ).length;
  const plansAfterTargetingCount = executionLog.reduce(
    (sum, record) => sum + record.countAfterTargeting,
    0,
  );
  const heavilyPrunedPlanCount = executionLog.filter(
    (record) =>
      record.countBeforeTargeting > 0 &&
      record.countAfterTargeting <=
        Math.floor(record.countBeforeTargeting * 0.4),
  ).length;

  const ragUniqueCandidateCount = rawCandidates.filter((candidate) => {
    const sourcesSeen = candidate.retrieval?.sourcesSeen ?? [];
    return sourcesSeen.includes("rag") || candidate.retrieval?.source === "rag";
  }).length;

  const ragRetrievalVolumeRatio =
    totalUniqueCandidates > 0
      ? ragUniqueCandidateCount / totalUniqueCandidates
      : 0;
  const hitSpread = planCount > 0 ? plansWithRagHits / planCount : 0;
  const retrievalBreadthScore = Math.max(
    0,
    Math.min(1, hitSpread * 0.6 + Math.min(1, ragRetrievalVolumeRatio) * 0.4),
  );

  return {
    zeroResultPlanCount,
    plansWithRagHits,
    plansAfterTargetingCount,
    heavilyPrunedPlanCount,
    ragRetrievalVolumeRatio,
    retrievalBreadthScore,
    retrievalDiagnostic: !retrieval.ragUsed
      ? "rag_not_attempted"
      : retrieval.totalRagCandidates === 0 && zeroResultPlanCount > 0
        ? "retrieval_failed"
        : heavilyPrunedPlanCount > 0
          ? "targeting_pruned_results"
          : totalUniqueCandidates > 0
            ? "retrieval_healthy"
            : "retrieval_sparse",
  };
}

export async function runEvidenceReviewer(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const { requestContext, evidenceContext, understandingContext, trace } =
    state;
  const retrievalTelemetry = deriveRetrievalTelemetry(state);
  const authorizedChunks = evidenceContext.authorizedChunks || [];
  const rawCandidates = state.retrievalContext.rawCandidates || [];

  if (state.policyContext.decision !== "granted") {
    return { completedAgents: ["evidenceReviewer"] };
  }

  // If deterministic firewall removed all evidence, skip LLM and compute control flow deterministically.
  if (authorizedChunks.length === 0) {
    const retryDecision = computeRetryDecision({
      rawCandidateCount: rawCandidates.length,
      authorizedChunkCount: 0,
      acceptedEvidenceCount: 0,
      retryCount: state.retrievalContext.retryCount || 0,
      missingCategories: understandingContext.focusAreas,
      queryPlanCount: state.retrievalContext.queryPlans.length,
      zeroResultPlanCount: retrievalTelemetry.zeroResultPlanCount,
      heavilyPrunedPlanCount: retrievalTelemetry.heavilyPrunedPlanCount,
      totalUniqueCandidates: state.retrievalContext.totalUniqueCandidates,
      totalRagCandidates: state.retrievalContext.totalRagCandidates,
      ragUsed: state.retrievalContext.ragUsed,
      plansWithRagHits: retrievalTelemetry.plansWithRagHits,
    });

    return {
      evidenceContext: {
        ...evidenceContext,
        reviewJudgement: {
          acceptedEvidenceIds: [],
          rejectedEvidenceIds: [],
          rejectionReasons: {},
          missingCategories: understandingContext.focusAreas,
          semanticSufficiency: false,
          partialAnswerViable: false,
          confidence: "low",
          zeroResultPlanCount: retrievalTelemetry.zeroResultPlanCount,
          heavilyPrunedPlanCount: retrievalTelemetry.heavilyPrunedPlanCount,
          retrievalDiagnostic:
            rawCandidates.length > 0
              ? "policy_filtered_authorized_zero"
              : retrievalTelemetry.retrievalDiagnostic,
          retrievalBreadthScore: retrievalTelemetry.retrievalBreadthScore,
          ...retryDecision,
        },
      },
      trace: addTraceStep(
        trace,
        "rerankChunks",
        "completed",
        `Evidence review bypassed. Accepted 0. Rejected 0. Sufficiency=false. Gap=${retryDecision.retrievalGapType}. Retry=${retryDecision.worthAnotherRetrievalPass}. Zero-result plans=${retrievalTelemetry.zeroResultPlanCount}. Heavily pruned plans=${retrievalTelemetry.heavilyPrunedPlanCount}. Unique candidates=${state.retrievalContext.totalUniqueCandidates}. RAG candidates=${state.retrievalContext.totalRagCandidates}.`,
      ),
      completedAgents: ["evidenceReviewer"],
    };
  }

  const shouldBypassLlmInTests =
    process.env.MEDAGENT_SKIP_LLM_IN_TESTS === "true";

  if (shouldBypassLlmInTests) {
    const fallbackJudgement = {
      acceptedEvidenceIds: authorizedChunks.map((chunk) => chunk.id),
      rejectedEvidenceIds: [] as string[],
      rejectionReasons: {} as Record<string, string>,
      missingCategories: [] as string[],
      semanticSufficiency: true,
      partialAnswerViable: true,
      confidence: "medium" as const,
    };

    const retryDecision = computeRetryDecision({
      rawCandidateCount: rawCandidates.length,
      authorizedChunkCount: authorizedChunks.length,
      acceptedEvidenceCount: fallbackJudgement.acceptedEvidenceIds.length,
      retryCount: state.retrievalContext.retryCount || 0,
      missingCategories: fallbackJudgement.missingCategories,
      queryPlanCount: state.retrievalContext.queryPlans.length,
      zeroResultPlanCount: retrievalTelemetry.zeroResultPlanCount,
      heavilyPrunedPlanCount: retrievalTelemetry.heavilyPrunedPlanCount,
      totalUniqueCandidates: state.retrievalContext.totalUniqueCandidates,
      totalRagCandidates: state.retrievalContext.totalRagCandidates,
      ragUsed: state.retrievalContext.ragUsed,
      plansWithRagHits: retrievalTelemetry.plansWithRagHits,
    });

    const judgement = {
      ...fallbackJudgement,
      ...retryDecision,
      zeroResultPlanCount: retrievalTelemetry.zeroResultPlanCount,
      heavilyPrunedPlanCount: retrievalTelemetry.heavilyPrunedPlanCount,
      retrievalDiagnostic: retrievalTelemetry.retrievalDiagnostic,
      retrievalBreadthScore: retrievalTelemetry.retrievalBreadthScore,
    };

    const updatedTrace = addTraceStep(
      trace,
      "rerankChunks",
      "completed",
      `Evidence review test fallback used. Accepted ${judgement.acceptedEvidenceIds.length}.`,
    );

    return {
      evidenceContext: {
        ...evidenceContext,
        reviewJudgement: judgement,
      },
      trace: updatedTrace,
      completedAgents: ["evidenceReviewer"],
    };
  }

  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.1,
  });

  const Schema = z.object({
    acceptedEvidenceIds: z
      .array(z.string())
      .describe(
        "IDs of chunks that are relevant and non-redundant for this request.",
      ),
    rejectedEvidenceIds: z
      .array(z.string())
      .describe(
        "IDs of chunks that are irrelevant, weakly relevant, or redundant.",
      ),
    rejectionReasons: z
      .record(z.string(), z.string())
      .describe("Map of rejected ID -> concise semantic reason."),
    missingCategories: z
      .array(z.string())
      .describe(
        "Requested focus categories still unsupported by the provided evidence.",
      ),
    semanticSufficiency: z
      .boolean()
      .describe(
        "True when accepted evidence semantically covers the main clinician request.",
      ),
    partialAnswerViable: z
      .boolean()
      .describe("True when accepted evidence supports a safe partial answer."),
    confidence: z.enum(["high", "medium", "low"]),
  });

  // Compress evidence for the prompt to save tokens
  const formattedEvidence = authorizedChunks.map((c) => ({
    id: c.id,
    type: c.noteType,
    content: c.content,
  }));

  const prompt = `
You are the Evidence Reviewer in a medical access system.
Clinician Request: "${requestContext.naturalLanguageRequest}"
Focus Areas Extracted previously: ${JSON.stringify(understandingContext.focusAreas)}

You have received an array of authorized candidate chunks. Your job is to stringently accept or reject these chunks and determine semantic sufficiency.

Authorized Candidates:
${JSON.stringify(formattedEvidence, null, 2)}

Judge only semantic relevance/sufficiency. Do not decide workflow control flow.
  `;

  let semanticJudgement;
  try {
    semanticJudgement = await llm.withStructuredOutput(Schema).invoke(prompt);
  } catch (e) {
    console.error("Evidence Review LLM failed:", e);
    // Conservative failure mode: narrow acceptance and let deterministic retry/clarification decide next step.
    semanticJudgement = {
      acceptedEvidenceIds: [],
      rejectedEvidenceIds: authorizedChunks.map((c) => c.id),
      rejectionReasons: Object.fromEntries(
        authorizedChunks.map((c) => [
          c.id,
          "llm_review_unavailable_conservative_reject",
        ]),
      ),
      missingCategories: understandingContext.focusAreas,
      semanticSufficiency: false,
      partialAnswerViable: false,
      confidence: "low" as const,
    };
  }

  const retryDecision = computeRetryDecision({
    rawCandidateCount: rawCandidates.length,
    authorizedChunkCount: authorizedChunks.length,
    acceptedEvidenceCount: semanticJudgement.acceptedEvidenceIds.length,
    retryCount: state.retrievalContext.retryCount || 0,
    missingCategories: semanticJudgement.missingCategories,
    queryPlanCount: state.retrievalContext.queryPlans.length,
    zeroResultPlanCount: retrievalTelemetry.zeroResultPlanCount,
    heavilyPrunedPlanCount: retrievalTelemetry.heavilyPrunedPlanCount,
    totalUniqueCandidates: state.retrievalContext.totalUniqueCandidates,
    totalRagCandidates: state.retrievalContext.totalRagCandidates,
    ragUsed: state.retrievalContext.ragUsed,
    plansWithRagHits: retrievalTelemetry.plansWithRagHits,
  });

  const judgement = {
    ...semanticJudgement,
    ...retryDecision,
    zeroResultPlanCount: retrievalTelemetry.zeroResultPlanCount,
    heavilyPrunedPlanCount: retrievalTelemetry.heavilyPrunedPlanCount,
    retrievalDiagnostic:
      retryDecision.retrievalGapType === "policy_blocked"
        ? "policy_blocked"
        : retrievalTelemetry.retrievalDiagnostic,
    retrievalBreadthScore: retrievalTelemetry.retrievalBreadthScore,
    confidence:
      semanticJudgement.confidence === "high" &&
      !semanticJudgement.semanticSufficiency
        ? "medium"
        : semanticJudgement.confidence,
  };

  // If semantic sufficiency is false, force conservative non-complete posture.
  if (!judgement.semanticSufficiency) {
    if (judgement.acceptedEvidenceIds.length > 0) {
      judgement.partialAnswerViable = true;
    }
  }

  const stepSummary = `Accepted ${judgement.acceptedEvidenceIds.length}. Rejected ${judgement.rejectedEvidenceIds.length}. Sufficiency=${judgement.semanticSufficiency}. Gap=${judgement.retrievalGapType}. Retry=${judgement.worthAnotherRetrievalPass}. Zero-result plans=${retrievalTelemetry.zeroResultPlanCount}. Heavily pruned plans=${retrievalTelemetry.heavilyPrunedPlanCount}. Unique candidates=${state.retrievalContext.totalUniqueCandidates}. RAG candidates=${state.retrievalContext.totalRagCandidates}.`;

  const updatedTrace = addTraceStep(
    trace,
    "rerankChunks",
    "completed",
    stepSummary,
  );

  return {
    evidenceContext: {
      ...evidenceContext,
      reviewJudgement: judgement,
    },
    trace: updatedTrace,
    completedAgents: ["evidenceReviewer"],
  };
}
