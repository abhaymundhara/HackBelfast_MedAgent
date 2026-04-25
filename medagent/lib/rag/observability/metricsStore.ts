import fs from "fs";
import path from "path";

import {
  RetrievalObservabilitySnapshot,
  RetrievalObservabilitySnapshotSchema,
} from "@/lib/rag/observability/retrievalObservability";
import {
  RetrievalRegressionSummary,
  RetrievalRegressionSummarySchema,
} from "@/lib/rag/observability/retrievalRegression";

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  "data",
  "retrieval-observability",
);
const METRICS_FILE = path.join(ARTIFACT_ROOT, "metrics.jsonl");
const ALERTS_DIR = path.join(ARTIFACT_ROOT, "alerts");

export type RetrievalCostDashboard = {
  generatedAt: string;
  sampleSize: number;
  costTelemetryCoverage: number;
  avgEstimatedRequestCostUsd: number;
  avgBudgetUsd: number;
  budgetExceededRate: number;
  degradedRate: number;
  status: "healthy" | "warn" | "critical";
  warnings: string[];
};

function parseRate(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toRounded(value: number) {
  return Number(value.toFixed(6));
}

function average(values: number[]) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return 0;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function ensureRoot() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
}

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readLastNonEmptyLines(filePath: string, limit: number) {
  const chunkSize = 64 * 1024;
  const stat = fs.statSync(filePath);
  const fd = fs.openSync(filePath, "r");
  const lines: string[] = [];
  let position = stat.size;
  let carry = "";

  try {
    while (position > 0 && lines.length < limit + 1) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;
      const buffer = Buffer.allocUnsafe(readSize);
      fs.readSync(fd, buffer, 0, readSize, position);
      const chunk = buffer.toString("utf8");
      const merged = chunk + carry;
      const parts = merged.split("\n");
      carry = parts.shift() ?? "";

      for (let index = parts.length - 1; index >= 0; index -= 1) {
        const line = parts[index]?.trim();
        if (line) {
          lines.push(line);
          if (lines.length >= limit) {
            break;
          }
        }
      }
    }

    const head = carry.trim();
    if (head && lines.length < limit) {
      lines.push(head);
    }
  } finally {
    fs.closeSync(fd);
  }

  return lines.reverse().slice(-limit);
}

export function appendRetrievalMetricsSnapshot(
  snapshot: RetrievalObservabilitySnapshot,
  outputPath = METRICS_FILE,
) {
  const parsed = RetrievalObservabilitySnapshotSchema.parse(snapshot);
  ensureRoot();
  ensureParentDir(outputPath);
  fs.appendFileSync(outputPath, `${JSON.stringify(parsed)}\n`, "utf8");
  return outputPath;
}

export function loadRecentRetrievalMetrics(input?: {
  limit?: number;
  inputPath?: string;
}) {
  const inputPath = input?.inputPath ?? METRICS_FILE;
  const limit = input?.limit ?? 200;

  if (!fs.existsSync(inputPath)) {
    return [] as RetrievalObservabilitySnapshot[];
  }

  const selected = readLastNonEmptyLines(inputPath, limit);

  const parsed: RetrievalObservabilitySnapshot[] = [];
  for (const line of selected) {
    try {
      const candidate = JSON.parse(line);
      const result = RetrievalObservabilitySnapshotSchema.safeParse(candidate);
      if (result.success) {
        parsed.push(result.data);
      }
    } catch {
      // malformed line is ignored
    }
  }

  return parsed;
}

export function saveRegressionReport(input: {
  report: RetrievalRegressionSummary;
  outputPath?: string;
}) {
  const report = RetrievalRegressionSummarySchema.parse(input.report);
  const outputPath =
    input.outputPath ??
    path.join(ARTIFACT_ROOT, `regression-${Date.now()}.json`);

  ensureRoot();
  ensureParentDir(outputPath);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  return outputPath;
}

export function buildRetrievalCostDashboard(input: {
  snapshots: RetrievalObservabilitySnapshot[];
}): RetrievalCostDashboard {
  const total = input.snapshots.length;
  if (!total) {
    return {
      generatedAt: new Date().toISOString(),
      sampleSize: 0,
      costTelemetryCoverage: 0,
      avgEstimatedRequestCostUsd: 0,
      avgBudgetUsd: 0,
      budgetExceededRate: 0,
      degradedRate: 0,
      status: "warn",
      warnings: ["no_retrieval_snapshots"],
    };
  }

  const withCostTelemetry = input.snapshots.filter(
    (snapshot) =>
      Number.isFinite(snapshot.estimatedRequestCostUsd) &&
      Number.isFinite(snapshot.costBudgetUsd),
  );

  const coverage = withCostTelemetry.length / total;
  const exceeded = withCostTelemetry.filter(
    (snapshot) => snapshot.costBudgetStatus === "budget_exceeded",
  ).length;
  const degraded = withCostTelemetry.filter(
    (snapshot) => snapshot.costBudgetStatus === "degraded",
  ).length;

  const budgetExceededRate = withCostTelemetry.length
    ? exceeded / withCostTelemetry.length
    : 0;
  const degradedRate = withCostTelemetry.length
    ? degraded / withCostTelemetry.length
    : 0;

  const coverageTarget = parseRate(
    process.env.MEDAGENT_COST_TELEMETRY_COVERAGE_TARGET,
    0.95,
  );
  const warnExceededRate = parseRate(
    process.env.MEDAGENT_COST_WARN_EXCEEDED_RATE,
    0.1,
  );
  const criticalExceededRate = parseRate(
    process.env.MEDAGENT_COST_CRITICAL_EXCEEDED_RATE,
    0.25,
  );

  const warnings: string[] = [];
  if (coverage < coverageTarget) {
    warnings.push(
      `cost_telemetry_coverage_below_target:${toRounded(coverage)}<${coverageTarget}`,
    );
  }
  if (budgetExceededRate >= warnExceededRate) {
    warnings.push(
      `budget_exceeded_rate_high:${toRounded(budgetExceededRate)}>=${warnExceededRate}`,
    );
  }

  const status: RetrievalCostDashboard["status"] =
    budgetExceededRate >= criticalExceededRate
      ? "critical"
      : warnings.length
        ? "warn"
        : "healthy";

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: total,
    costTelemetryCoverage: toRounded(coverage),
    avgEstimatedRequestCostUsd: toRounded(
      average(
        withCostTelemetry.map((snapshot) => snapshot.estimatedRequestCostUsd),
      ),
    ),
    avgBudgetUsd: toRounded(
      average(withCostTelemetry.map((snapshot) => snapshot.costBudgetUsd)),
    ),
    budgetExceededRate: toRounded(budgetExceededRate),
    degradedRate: toRounded(degradedRate),
    status,
    warnings,
  };
}

export function saveRetrievalCostDashboard(input: {
  dashboard: RetrievalCostDashboard;
  outputPath?: string;
}) {
  const outputPath =
    input.outputPath ?? path.join(ALERTS_DIR, "cost-dashboard-latest.json");
  ensureRoot();
  ensureParentDir(outputPath);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(input.dashboard, null, 2),
    "utf8",
  );
  return outputPath;
}

export function generateAndSaveRetrievalCostDashboard(input?: {
  inputPath?: string;
  outputPath?: string;
  limit?: number;
}) {
  const limit =
    input?.limit ??
    parsePositiveInteger(process.env.MEDAGENT_COST_DASHBOARD_WINDOW, 200);
  const snapshots = loadRecentRetrievalMetrics({
    inputPath: input?.inputPath,
    limit,
  });
  const dashboard = buildRetrievalCostDashboard({ snapshots });
  const outputPath = saveRetrievalCostDashboard({
    dashboard,
    outputPath: input?.outputPath,
  });

  return {
    dashboard,
    outputPath,
  };
}
