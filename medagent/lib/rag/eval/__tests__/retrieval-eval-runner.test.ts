import fs from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase } from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";
import { runRetrievalEval } from "@/lib/rag/eval/retrievalEvalRunner";
import { buildDefaultEvalDataset } from "@/lib/rag/eval/retrievalEvalDataset";
import {
  compareEvalSummaryAgainstBaseline,
  loadEvalMachineSummary,
  saveEvalMachineSummary,
  toEvalMachineSummary,
} from "@/lib/rag/eval/retrievalEvalRunner";

const MANIFEST_PATH = path.join(process.cwd(), "data", "index-manifest.json");
const BASELINE_PATH = path.join(
  process.cwd(),
  "data",
  "retrieval-observability",
  "eval",
  "test-baseline.json",
);

describe("retrieval eval runner", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedDemo();
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.rmSync(MANIFEST_PATH, { force: true });
    }
  });

  afterEach(() => {
    fs.rmSync(BASELINE_PATH, { force: true });
  });

  it("runs lexical_plus_rerank mode deterministically", async () => {
    const dataset = buildDefaultEvalDataset();

    const first = await runRetrievalEval({
      dataset,
      config: {
        runId: "eval-1",
        mode: "lexical_plus_rerank",
        topK: 5,
        includePerPlanMetrics: true,
        plannerConfig: {
          enablePlanOptimizer: false,
          optimizerProfile: "auto",
          forceDisableRerank: false,
        },
      },
    });

    const second = await runRetrievalEval({
      dataset,
      config: {
        runId: "eval-2",
        mode: "lexical_plus_rerank",
        topK: 5,
        includePerPlanMetrics: true,
        plannerConfig: {
          enablePlanOptimizer: false,
          optimizerProfile: "auto",
          forceDisableRerank: false,
        },
      },
    });

    expect(first.requestCount).toBeGreaterThan(0);
    expect(second.requestCount).toBe(first.requestCount);
    expect(first.precisionAtK).toBeCloseTo(second.precisionAtK, 3);
    expect(first.diagnostics).toBeDefined();
    expect(first.diagnostics?.zeroHitExampleIds).toBeInstanceOf(Array);
    expect(first.diagnostics?.lexicalMissExampleIds).toBeInstanceOf(Array);
    expect(first.diagnostics?.filterMissExampleIds).toBeInstanceOf(Array);
    expect(first.diagnostics?.rerankInsufficiencyExampleIds).toBeInstanceOf(
      Array,
    );
  });

  it("supports cached and cold_start modes", async () => {
    const dataset = buildDefaultEvalDataset();

    const cached = await runRetrievalEval({
      dataset,
      config: {
        runId: "eval-cached",
        mode: "cached",
        topK: 5,
        includePerPlanMetrics: true,
        plannerConfig: {
          enablePlanOptimizer: false,
          optimizerProfile: "auto",
          forceDisableRerank: false,
        },
      },
    });

    const cold = await runRetrievalEval({
      dataset,
      config: {
        runId: "eval-cold",
        mode: "cold_start",
        topK: 5,
        includePerPlanMetrics: true,
        plannerConfig: {
          enablePlanOptimizer: false,
          optimizerProfile: "auto",
          forceDisableRerank: false,
        },
      },
    });

    expect(cached.requestCount).toBeGreaterThan(0);
    expect(cold.requestCount).toBeGreaterThan(0);
  });

  it("compares planner configs in one run", async () => {
    const dataset = buildDefaultEvalDataset();

    const report = await runRetrievalEval({
      dataset,
      config: {
        runId: "eval-compare",
        mode: "lexical_plus_rerank",
        topK: 5,
        includePerPlanMetrics: false,
        plannerConfig: {
          enablePlanOptimizer: false,
          optimizerProfile: "auto",
          forceDisableRerank: false,
        },
        baselinePlannerConfig: {
          enablePlanOptimizer: false,
          optimizerProfile: "auto",
          forceDisableRerank: true,
        },
        candidatePlannerConfig: {
          enablePlanOptimizer: true,
          optimizerProfile: "balanced",
          forceDisableRerank: false,
        },
      },
    });

    expect(report.plannerComparison).toBeDefined();
    expect(report.diagnostics?.improvedExampleIds).toBeInstanceOf(Array);
    expect(report.diagnostics?.regressedExampleIds).toBeInstanceOf(Array);
  });

  it("supports baseline artifact save/load and regression compare", async () => {
    const dataset = buildDefaultEvalDataset();
    const baselineReport = await runRetrievalEval({
      dataset,
      config: {
        runId: "eval-baseline",
        mode: "lexical_plus_rerank",
        topK: 5,
        includePerPlanMetrics: false,
        plannerConfig: {
          enablePlanOptimizer: false,
          optimizerProfile: "auto",
          forceDisableRerank: false,
        },
      },
    });

    const baselineSummary = toEvalMachineSummary(baselineReport);
    saveEvalMachineSummary({
      summary: baselineSummary,
      outputPath: BASELINE_PATH,
    });

    const loaded = loadEvalMachineSummary(BASELINE_PATH);
    expect(loaded).not.toBeNull();

    const current = {
      ...baselineSummary,
      avgLatencyMs: baselineSummary.avgLatencyMs * 1.4,
      recallAtK: Math.max(0, baselineSummary.recallAtK - 0.05),
    };

    const regression = compareEvalSummaryAgainstBaseline({
      baseline: loaded!,
      current,
    });

    expect(regression.status).toBe("warn");
  });
});
