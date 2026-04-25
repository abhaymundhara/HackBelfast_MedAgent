export type RetrievalBudgetProfile = "default" | "strict";

export type RetrievalLatencyBudgets = {
  lexicalMs: { soft: number; hard: number };
  rerankMs: { soft: number; hard: number };
  cacheLookupMs: { soft: number; hard: number };
  indexEnsureMs: { soft: number; hard: number };
  totalPlannerMs: { soft: number; hard: number };
};

export type RetrievalLatencySnapshot = {
  lexicalMs: number;
  rerankMs: number;
  cacheLookupMs: number;
  indexEnsureMs: number;
  totalPlannerMs: number;
};

export type RetrievalLatencyClassification = {
  status: "healthy" | "degraded" | "budget_exceeded";
  breaches: string[];
};

const DEFAULT_BUDGETS: RetrievalLatencyBudgets = {
  lexicalMs: { soft: 120, hard: 350 },
  rerankMs: { soft: 140, hard: 400 },
  cacheLookupMs: { soft: 40, hard: 120 },
  indexEnsureMs: { soft: 180, hard: 600 },
  totalPlannerMs: { soft: 450, hard: 1400 },
};

const STRICT_BUDGETS: RetrievalLatencyBudgets = {
  lexicalMs: { soft: 80, hard: 220 },
  rerankMs: { soft: 100, hard: 260 },
  cacheLookupMs: { soft: 25, hard: 80 },
  indexEnsureMs: { soft: 120, hard: 350 },
  totalPlannerMs: { soft: 300, hard: 900 },
};

function parseProfile(value: string | undefined): RetrievalBudgetProfile {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "strict") return "strict";
  return "default";
}

export function getRetrievalBudgetProfile() {
  return parseProfile(process.env.MEDAGENT_RETRIEVAL_BUDGET_PROFILE);
}

export function getRetrievalLatencyBudgets(
  profile: RetrievalBudgetProfile = getRetrievalBudgetProfile(),
): RetrievalLatencyBudgets {
  return profile === "strict" ? STRICT_BUDGETS : DEFAULT_BUDGETS;
}

export function classifyRetrievalLatency(
  snapshot: RetrievalLatencySnapshot,
  budgets = getRetrievalLatencyBudgets(),
): RetrievalLatencyClassification {
  const softBreaches: string[] = [];
  const hardBreaches: string[] = [];

  const checks: Array<keyof RetrievalLatencySnapshot> = [
    "lexicalMs",
    "rerankMs",
    "cacheLookupMs",
    "indexEnsureMs",
    "totalPlannerMs",
  ];

  for (const metric of checks) {
    const value = snapshot[metric];
    const budget = budgets[metric];
    if (value > budget.hard) {
      hardBreaches.push(`${metric}:${value.toFixed(2)}>${budget.hard}`);
    } else if (value > budget.soft) {
      softBreaches.push(`${metric}:${value.toFixed(2)}>${budget.soft}`);
    }
  }

  if (hardBreaches.length) {
    return {
      status: "budget_exceeded",
      breaches: [...hardBreaches, ...softBreaches],
    };
  }

  if (softBreaches.length) {
    return {
      status: "degraded",
      breaches: softBreaches,
    };
  }

  return {
    status: "healthy",
    breaches: [],
  };
}
