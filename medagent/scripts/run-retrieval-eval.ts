import { config } from "dotenv";

import {
  DEFAULT_RETRIEVAL_PLANNER_PROFILE,
  DEFAULT_RETRIEVAL_TOP_K,
} from "@/lib/agent/retrieval/plannerDefaults";
import { ensureEvalDataset } from "@/lib/rag/eval/retrievalEvalDataset";
import {
  compareEvalSummaryAgainstBaseline,
  loadEvalMachineSummary,
  runRetrievalEval,
  saveEvalMachineSummary,
  toEvalMachineSummary,
} from "@/lib/rag/eval/retrievalEvalRunner";
import {
  recommendModeOrder,
  recommendPlanProfile,
  recommendTopK,
} from "@/lib/rag/eval/planOptimizer";

config({ path: ".env.local" });
config();

function getArg(name: string) {
  const entry = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : undefined;
}

const ALLOWED_MODES = [
  "lexical_only",
  "lexical_plus_rerank",
  "cached",
  "cold_start",
] as const;

function resolveMode(value: string | undefined) {
  return value && (ALLOWED_MODES as readonly string[]).includes(value)
    ? (value as "lexical_only" | "lexical_plus_rerank" | "cached" | "cold_start")
    : "lexical_plus_rerank";
}

function joinOrNone(value: unknown) {
  return Array.isArray(value) && value.length ? value.join(", ") : "none";
}

async function main() {
  const dataset = ensureEvalDataset();
  const mode = resolveMode(getArg("--mode"));
  const makeBaseline = process.argv.includes("--make-baseline");
  const compareBaseline = process.argv.includes("--compare-baseline");
  const baselinePath =
    getArg("--baseline") ?? process.env.MEDAGENT_RETRIEVAL_REGRESSION_BASELINE;

  const report = await runRetrievalEval({
    dataset,
    config: {
      runId: `retrieval-eval-${Date.now()}`,
      mode,
      topK: DEFAULT_RETRIEVAL_TOP_K,
      includePerPlanMetrics: true,
      plannerConfig: {
        enablePlanOptimizer:
          process.env.MEDAGENT_ENABLE_PLAN_OPTIMIZER === "true",
        optimizerProfile: DEFAULT_RETRIEVAL_PLANNER_PROFILE,
        forceDisableRerank: false,
      },
    },
  });

  const summary = toEvalMachineSummary(report);
  const optimizerInput = {
    zeroResultPlanCount: Math.round(
      (1 - report.recallAtK) * report.requestCount,
    ),
    heavilyPrunedPlanCount: Math.round(
      (1 - report.precisionAtK) * report.requestCount,
    ),
    retrievalBreadthScore: report.recallAtK,
    cacheFreshHitRate: report.cacheHitRate,
    staleServeRate: report.staleCacheServeRate,
    rerankUpliftHistory: report.rerankUpliftDelta,
    targetFieldSparsity: 1 - report.fieldCoverageScore,
    noteTypeSparsity: 1 - report.noteTypeCoverageScore,
  };
  const profile = recommendPlanProfile(optimizerInput);

  const modeOrder = recommendModeOrder(profile);
  const topK = recommendTopK(profile, optimizerInput);

  const lines = [
    `requests evaluated: ${report.requestCount}`,
    `recall@k: ${report.recallAtK.toFixed(3)}`,
    `precision@k: ${report.precisionAtK.toFixed(3)}`,
    `MRR: ${report.mrr.toFixed(3)}`,
    `nDCG-lite: ${report.ndcgLite.toFixed(3)}`,
    `zero-hit queries: ${summary.zeroHitQueryCount}`,
    `avg latency (ms): ${report.avgLatencyMs.toFixed(2)}`,
    `cache hit rate: ${report.cacheHitRate.toFixed(3)}`,
    `stale cache serve rate: ${report.staleCacheServeRate.toFixed(3)}`,
    `background refresh rate: ${report.backgroundRefreshRate.toFixed(3)}`,
    `rerank uplift: ${report.rerankUpliftDelta.toFixed(4)}`,
    `recommended planner profile: ${profile}`,
    `recommended mode order: ${modeOrder.join(" -> ")}`,
    `recommended topK: ${topK}`,
    `zero-hit example ids: ${joinOrNone(report.diagnostics?.zeroHitExampleIds)}`,
    `lexical-miss example ids: ${joinOrNone(report.diagnostics?.lexicalMissExampleIds)}`,
    `filter-miss example ids: ${joinOrNone(report.diagnostics?.filterMissExampleIds)}`,
    `rerank-insufficiency example ids: ${joinOrNone(report.diagnostics?.rerankInsufficiencyExampleIds)}`,
  ];

  if (report.diagnostics?.improvedExampleIds?.length) {
    lines.push(
      `improved examples: ${report.diagnostics.improvedExampleIds.join(", ")}`,
    );
  }
  if (report.diagnostics?.regressedExampleIds?.length) {
    lines.push(
      `regressed examples: ${report.diagnostics.regressedExampleIds.join(", ")}`,
    );
  }

  if (makeBaseline) {
    if (!baselinePath || !baselinePath.trim()) {
      throw new Error(
        "--make-baseline requires a valid baseline path (use --baseline=... or MEDAGENT_RETRIEVAL_REGRESSION_BASELINE).",
      );
    }
    const savedPath = saveEvalMachineSummary({
      summary,
      outputPath: baselinePath,
    });
    lines.push(`baseline saved: ${savedPath}`);
  }

  if (compareBaseline) {
    if (!baselinePath) {
      lines.push("regression: fail (missing baseline path)");
      console.log(lines.join("\n"));
      process.exit(2);
    } else {
      const baseline = loadEvalMachineSummary(baselinePath);
      if (!baseline) {
        lines.push(
          `regression: fail (baseline not found or malformed at ${baselinePath})`,
        );
        console.log(lines.join("\n"));
        process.exit(2);
      } else {
        const regression = compareEvalSummaryAgainstBaseline({
          baseline,
          current: summary,
        });

        lines.push(`regression: ${regression.status}`);
        if (regression.reasons.length) {
          lines.push(`regression reasons: ${regression.reasons.join("; ")}`);
        }

        if (regression.status === "fail") {
          console.log(lines.join("\n"));
          process.exit(2);
        }
      }
    }
  }

  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
