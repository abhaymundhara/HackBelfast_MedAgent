import { PlanProfile } from "@/lib/rag/eval/planOptimizer";

type RetrievalMode = "balanced" | "broad" | "exact";

function parseProfile(value: string | undefined): PlanProfile | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "balanced" ||
    normalized === "precision_first" ||
    normalized === "recall_first"
  ) {
    return normalized;
  }
  return null;
}

function parseModeOrder(value: string | undefined): RetrievalMode[] | null {
  if (!value) return null;
  const tokens = value
    .split(/[,>\- ]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return null;

  const parsed = tokens.filter(
    (token): token is RetrievalMode =>
      token === "balanced" || token === "broad" || token === "exact",
  );
  if (!parsed.length) return null;

  const deduped = [...new Set(parsed)];
  if (!deduped.includes("balanced")) {
    deduped.unshift("balanced");
  }
  return deduped;
}

function parseTopK(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(50, parsed));
}

export const DEFAULT_RETRIEVAL_PLANNER_PROFILE: PlanProfile =
  parseProfile(process.env.MEDAGENT_RETRIEVAL_DEFAULT_PROFILE) ?? "balanced";
export const DEFAULT_RETRIEVAL_MODE_ORDER: RetrievalMode[] =
  parseModeOrder(process.env.MEDAGENT_RETRIEVAL_DEFAULT_MODE_ORDER) ?? [
    "balanced",
    "broad",
    "exact",
  ];
export const DEFAULT_RETRIEVAL_TOP_K =
  parseTopK(process.env.MEDAGENT_RETRIEVAL_DEFAULT_TOP_K) ?? 5;
