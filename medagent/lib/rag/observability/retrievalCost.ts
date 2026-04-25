export type RetrievalCostBudgetStatus =
  | "healthy"
  | "degraded"
  | "budget_exceeded";

export type RetrievalCostBreakdown = {
  embedUsd: number;
  rerankUsd: number;
  judgeUsd: number;
  chainWriteUsd: number;
};

export type RetrievalCostEstimate = {
  totalUsd: number;
  budgetUsd: number;
  status: RetrievalCostBudgetStatus;
  breakdown: RetrievalCostBreakdown;
};

const DEFAULT_BUDGET_USD = 0.01;
const DEFAULT_EMBED_USD = 0.0009;
const DEFAULT_RERANK_USD = 0.0005;
const DEFAULT_JUDGE_USD = 0;
const DEFAULT_CHAIN_WRITE_USD = 0.001;

function parseNonNegativeNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toRounded(value: number) {
  return Number(value.toFixed(6));
}

export function getRetrievalCostBudgetUsd() {
  return parseNonNegativeNumber(
    process.env.MEDAGENT_RETRIEVAL_COST_BUDGET_USD,
    DEFAULT_BUDGET_USD,
  );
}

export function estimateRetrievalRequestCost(input: {
  rerankApplied: boolean;
  includeJudgeCost?: boolean;
  includeChainWriteCost?: boolean;
  budgetUsd?: number;
}): RetrievalCostEstimate {
  const budgetUsd = input.budgetUsd ?? getRetrievalCostBudgetUsd();

  const embedUsd = parseNonNegativeNumber(
    process.env.MEDAGENT_RETRIEVAL_EMBED_COST_USD,
    DEFAULT_EMBED_USD,
  );

  const rerankBaseUsd = parseNonNegativeNumber(
    process.env.MEDAGENT_RETRIEVAL_RERANK_COST_USD,
    DEFAULT_RERANK_USD,
  );
  const rerankUsd = input.rerankApplied ? rerankBaseUsd : 0;

  const judgeBaseUsd = parseNonNegativeNumber(
    process.env.MEDAGENT_RETRIEVAL_JUDGE_COST_USD,
    DEFAULT_JUDGE_USD,
  );
  const judgeUsd = input.includeJudgeCost ? judgeBaseUsd : 0;

  const chainBaseUsd = parseNonNegativeNumber(
    process.env.MEDAGENT_RETRIEVAL_CHAIN_WRITE_COST_USD,
    DEFAULT_CHAIN_WRITE_USD,
  );
  const chainWriteUsd =
    input.includeChainWriteCost === false ? 0 : chainBaseUsd;

  const totalUsd = embedUsd + rerankUsd + judgeUsd + chainWriteUsd;

  const status: RetrievalCostBudgetStatus =
    totalUsd > budgetUsd
      ? "budget_exceeded"
      : totalUsd >= budgetUsd * 0.8
        ? "degraded"
        : "healthy";

  return {
    totalUsd: toRounded(totalUsd),
    budgetUsd: toRounded(budgetUsd),
    status,
    breakdown: {
      embedUsd: toRounded(embedUsd),
      rerankUsd: toRounded(rerankUsd),
      judgeUsd: toRounded(judgeUsd),
      chainWriteUsd: toRounded(chainWriteUsd),
    },
  };
}
