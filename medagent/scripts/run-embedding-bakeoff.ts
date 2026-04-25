import fs from "fs";
import path from "path";

import { config } from "dotenv";

import {
  DEFAULT_RETRIEVAL_PLANNER_PROFILE,
  DEFAULT_RETRIEVAL_TOP_K,
} from "@/lib/agent/retrieval/plannerDefaults";
import { ensureEvalDataset } from "@/lib/rag/eval/retrievalEvalDataset";
import { runRetrievalEval } from "@/lib/rag/eval/retrievalEvalRunner";

config({ path: ".env.local" });
config();

type BakeoffCandidate = {
  id: string;
  embeddingModel: string;
  embeddingDims: string;
  notes: string;
};

const DEFAULT_CANDIDATES: BakeoffCandidate[] = [
  {
    id: "zembed-1",
    embeddingModel: "zembed-1",
    embeddingDims: "768",
    notes: "primary candidate to beat",
  },
  {
    id: "bge-m3",
    embeddingModel: "BGE-M3",
    embeddingDims: "1024",
    notes: "strong multilingual/open baseline",
  },
  {
    id: "voyage-3.5",
    embeddingModel: "Voyage-3.5",
    embeddingDims: "1024",
    notes: "managed API reference profile",
  },
  {
    id: "modern-pubmed",
    embeddingModel: "ModernPubMedBERT",
    embeddingDims: "768",
    notes: "medical-domain embedding candidate",
  },
];

function getArg(name: string) {
  const entry = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : undefined;
}

function parseCandidates(raw: string | undefined) {
  if (!raw?.trim()) return DEFAULT_CANDIDATES;

  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((id) => {
      const normalized = id.toLowerCase();
      if (normalized === "zembed-1") {
        return {
          id: "zembed-1",
          embeddingModel: "zembed-1",
          embeddingDims: "768",
          notes: "primary candidate to beat",
        } satisfies BakeoffCandidate;
      }
      if (normalized === "bge-m3") {
        return {
          id: "bge-m3",
          embeddingModel: "BGE-M3",
          embeddingDims: "1024",
          notes: "strong multilingual/open baseline",
        } satisfies BakeoffCandidate;
      }
      if (normalized.startsWith("voyage")) {
        return {
          id: "voyage-3.5",
          embeddingModel: "Voyage-3.5",
          embeddingDims: "1024",
          notes: "managed API reference profile",
        } satisfies BakeoffCandidate;
      }
      return {
        id,
        embeddingModel: id,
        embeddingDims: "768",
        notes: "custom candidate",
      } satisfies BakeoffCandidate;
    });
}

function toNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

function scoreCandidate(input: {
  recallAtK: number;
  ndcgLite: number;
  mrr: number;
  avgLatencyMs: number;
}) {
  const quality =
    input.recallAtK * 0.45 + input.ndcgLite * 0.35 + input.mrr * 0.2;
  const latencyPenalty = Math.min(0.25, Math.max(0, input.avgLatencyMs / 5000));
  return quality - latencyPenalty;
}

async function evaluateCandidate(candidate: BakeoffCandidate) {
  const prevModel = process.env.MEDAGENT_LOCAL_EMBED_MODEL;
  const prevDims = process.env.MEDAGENT_LOCAL_EMBED_DIMS;

  process.env.MEDAGENT_LOCAL_EMBED_MODEL = candidate.embeddingModel;
  process.env.MEDAGENT_LOCAL_EMBED_DIMS = candidate.embeddingDims;

  try {
    const dataset = ensureEvalDataset();
    const report = await runRetrievalEval({
      dataset,
      config: {
        runId: `embed-bakeoff-${candidate.id}-${Date.now()}`,
        mode: "lexical_plus_rerank",
        topK: DEFAULT_RETRIEVAL_TOP_K,
        includePerPlanMetrics: false,
        plannerConfig: {
          enablePlanOptimizer: true,
          optimizerProfile: DEFAULT_RETRIEVAL_PLANNER_PROFILE,
          forceDisableRerank: false,
        },
      },
    });

    return {
      candidate: candidate.id,
      embeddingModel: candidate.embeddingModel,
      embeddingDims: Number(candidate.embeddingDims),
      notes: candidate.notes,
      requestCount: report.requestCount,
      recallAtK: toNumber(report.recallAtK),
      precisionAtK: toNumber(report.precisionAtK),
      mrr: toNumber(report.mrr),
      ndcgLite: toNumber(report.ndcgLite),
      avgLatencyMs: toNumber(report.avgLatencyMs),
      rerankUpliftDelta: toNumber(report.rerankUpliftDelta),
      score: toNumber(
        scoreCandidate({
          recallAtK: report.recallAtK,
          ndcgLite: report.ndcgLite,
          mrr: report.mrr,
          avgLatencyMs: report.avgLatencyMs,
        }),
      ),
    };
  } finally {
    if (prevModel === undefined) {
      delete process.env.MEDAGENT_LOCAL_EMBED_MODEL;
    } else {
      process.env.MEDAGENT_LOCAL_EMBED_MODEL = prevModel;
    }

    if (prevDims === undefined) {
      delete process.env.MEDAGENT_LOCAL_EMBED_DIMS;
    } else {
      process.env.MEDAGENT_LOCAL_EMBED_DIMS = prevDims;
    }
  }
}

async function main() {
  const rawCandidates =
    getArg("--candidates") ?? process.env.MEDAGENT_BAKEOFF_CANDIDATES;
  const candidates = parseCandidates(rawCandidates);

  const rows = [] as Awaited<ReturnType<typeof evaluateCandidate>>[];
  for (const candidate of candidates) {
    const result = await evaluateCandidate(candidate);
    rows.push(result);
  }

  const ranked = [...rows].sort((a, b) => b.score - a.score);
  const winner = ranked[0] ?? null;

  const output = {
    runId: `embedding-bakeoff-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    policy: {
      phiBoundary: "de-identified inputs only",
      externalModelConstraint:
        "managed APIs require policy-compliant de-identification",
      defaultFusionMethod: process.env.MEDAGENT_FUSION_METHOD ?? "rrf",
    },
    candidates: rows,
    recommendation: winner
      ? {
          winner: winner.candidate,
          embeddingModel: winner.embeddingModel,
          embeddingDims: winner.embeddingDims,
          score: winner.score,
          rationale:
            "Best blended score across Recall@K, nDCG-lite, MRR, and latency penalty.",
        }
      : null,
  };

  const outputDir = path.join(
    process.cwd(),
    "data",
    "retrieval-observability",
    "eval",
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    `embedding-bakeoff-${Date.now()}.json`,
  );
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`embedding bakeoff candidates: ${rows.length}`);
  for (const row of ranked) {
    console.log(
      `${row.candidate}: score=${row.score.toFixed(4)} recall=${row.recallAtK.toFixed(3)} ndcg=${row.ndcgLite.toFixed(3)} mrr=${row.mrr.toFixed(3)} latencyMs=${row.avgLatencyMs.toFixed(2)}`,
    );
  }
  console.log(`embedding bakeoff report: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
