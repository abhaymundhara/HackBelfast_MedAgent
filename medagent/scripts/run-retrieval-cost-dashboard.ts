import { config } from "dotenv";

import { generateAndSaveRetrievalCostDashboard } from "@/lib/rag/observability/metricsStore";

config({ path: ".env.local" });
config();

function getArg(name: string) {
  const entry = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : undefined;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const limit = parsePositiveInteger(getArg("--limit"), 200);
  const outputPath = getArg("--out");

  const { dashboard, outputPath: savedPath } =
    generateAndSaveRetrievalCostDashboard({
      limit,
      outputPath,
    });

  console.log(`retrieval cost dashboard: ${savedPath}`);
  console.log(`status: ${dashboard.status}`);
  console.log(`sample size: ${dashboard.sampleSize}`);
  console.log(
    `coverage: ${(dashboard.costTelemetryCoverage * 100).toFixed(2)}%`,
  );
  console.log(
    `avg estimated cost usd: ${dashboard.avgEstimatedRequestCostUsd}`,
  );
  console.log(`avg budget usd: ${dashboard.avgBudgetUsd}`);
  console.log(`budget exceeded rate: ${dashboard.budgetExceededRate}`);

  if (dashboard.warnings.length) {
    console.log(`warnings: ${dashboard.warnings.join("; ")}`);
  }

  if (dashboard.status === "critical") {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
