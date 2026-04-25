import {
  IndexStats,
  RetrievalResult,
} from "@/lib/rag/ragTypes";
import { CanonicalEvidenceItem } from "@/lib/agent/state";

/**
 * CodeDB-inspired local RAG index.
 *
 * Performance principles mirrored from CodeDB-style engines:
 * - trigram index for fuzzy structural recall
 * - inverted token index for exact lexical recall
 * - positional postings for cheap TF signals
 * - patient-first filtering before ranking
 * - zero external services / embeddings
 */
export class RagIndex {
  private readonly chunks: CanonicalEvidenceItem[] = [];
  private readonly patientToChunkIds = new Map<string, number[]>();

  private readonly trigramIndex = new Map<string, Set<number>>();
  private readonly wordIndex = new Map<string, Set<number>>();
  private readonly positionIndex = new Map<string, Map<number, number[]>>();

  private readonly chunkTokens: string[][] = [];
  private readonly chunkTrigrams: Set<string>[] = [];
  private lastBuildMs = 0;

  clear() {
    this.chunks.length = 0;
    this.chunkTokens.length = 0;
    this.chunkTrigrams.length = 0;
    this.patientToChunkIds.clear();
    this.trigramIndex.clear();
    this.wordIndex.clear();
    this.positionIndex.clear();
    this.lastBuildMs = 0;
  }

  /** Bulk build (preferred path for startup seed). */
  buildIndex(chunks: CanonicalEvidenceItem[]) {
    const start = performance.now();
    this.clear();
    for (const chunk of chunks) {
      this.addChunk(chunk);
    }
    this.lastBuildMs = performance.now() - start;
  }

  /** Incremental add for live appends. */
  addChunk(chunk: CanonicalEvidenceItem) {
    const chunkId = this.chunks.length;
    const tokens = this.tokenize(chunk.content).slice(0, 512);
    const trigrams = this.toTrigrams(chunk.content);

    this.chunks.push(chunk);
    this.chunkTokens.push(tokens);
    this.chunkTrigrams.push(trigrams);

    const perPatient = this.patientToChunkIds.get(chunk.patientHash);
    if (perPatient) {
      perPatient.push(chunkId);
    } else {
      this.patientToChunkIds.set(chunk.patientHash, [chunkId]);
    }

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];

      const tokenPosting = this.wordIndex.get(token);
      if (tokenPosting) {
        tokenPosting.add(chunkId);
      } else {
        this.wordIndex.set(token, new Set([chunkId]));
      }

      const tokenPositions = this.positionIndex.get(token);
      if (!tokenPositions) {
        this.positionIndex.set(token, new Map([[chunkId, [i]]]));
      } else {
        const positions = tokenPositions.get(chunkId);
        if (positions) {
          positions.push(i);
        } else {
          tokenPositions.set(chunkId, [i]);
        }
      }
    }

    for (const gram of trigrams) {
      const gramPosting = this.trigramIndex.get(gram);
      if (gramPosting) {
        gramPosting.add(chunkId);
      } else {
        this.trigramIndex.set(gram, new Set([chunkId]));
      }
    }
  }

  query(patientHash: string, query: string, topK = 5): RetrievalResult[] {
    const patientChunkIds = this.patientToChunkIds.get(patientHash);
    if (!patientChunkIds || !patientChunkIds.length) {
      return [];
    }

    const normalizedTopK = Math.max(1, topK);
    const qTokens = this.tokenize(query);
    const qTrigrams = this.toTrigrams(query);
    const patientFilter = new Set(patientChunkIds);

    // Candidate generation: keyword postings intersected with patient scope first.
    const candidates = new Set<number>();
    for (const token of qTokens) {
      const posting = this.wordIndex.get(token);
      if (!posting) continue;
      for (const chunkId of posting) {
        if (patientFilter.has(chunkId)) {
          candidates.add(chunkId);
        }
      }
    }

    // Fallback: if query has no lexical hits, stay patient-local and rank by trigram + recency.
    const targetIds = candidates.size ? [...candidates] : patientChunkIds;

    const scored = targetIds.map((chunkId) => {
      const tf = this.tfScore(chunkId, qTokens);
      const keywordHits = this.keywordHitCount(chunkId, qTokens);
      const trigram = this.trigramOverlapScore(chunkId, qTrigrams);
      const recency = this.recencyScore(this.chunks[chunkId].provenance.timestamp);

      const score =
        keywordHits * 3.2 + tf * 1.35 + trigram * 2.1 + recency * 0.75;
      const relevanceExplanation = `kw:${keywordHits} tf:${tf.toFixed(2)} tri:${trigram.toFixed(2)} rec:${recency.toFixed(2)}`;

      return {
        chunk: this.chunks[chunkId],
        score,
        relevanceExplanation,
      } satisfies RetrievalResult;
    });

    scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.chunk.provenance.timestamp.localeCompare(left.chunk.provenance.timestamp);
    });

    return scored.slice(0, normalizedTopK);
  }

  getStats(): IndexStats {
    let postingEntries = 0;
    for (const posting of this.wordIndex.values()) {
      postingEntries += posting.size;
    }

    let positionalEntries = 0;
    for (const posting of this.positionIndex.values()) {
      for (const positions of posting.values()) {
        positionalEntries += positions.length;
      }
    }

    const tokenTotal = this.chunkTokens.reduce(
      (sum, tokens) => sum + tokens.length,
      0,
    );

    return {
      chunkCount: this.chunks.length,
      patientCount: this.patientToChunkIds.size,
      trigramCount: this.trigramIndex.size,
      vocabularySize: this.wordIndex.size,
      postingEntries,
      positionalEntries,
      avgTokensPerChunk: this.chunks.length
        ? tokenTotal / this.chunks.length
        : 0,
      lastBuildMs: this.lastBuildMs,
    };
  }

  private tokenize(input: string): string[] {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 2);
  }

  private toTrigrams(input: string): Set<string> {
    const normalized = input.toLowerCase().replace(/\s+/g, " ").trim();
    if (normalized.length <= 3) {
      return new Set(normalized ? [normalized] : []);
    }

    const grams = new Set<string>();
    for (let i = 0; i <= normalized.length - 3; i += 1) {
      grams.add(normalized.slice(i, i + 3));
    }
    return grams;
  }

  private keywordHitCount(chunkId: number, qTokens: string[]): number {
    if (!qTokens.length) return 0;
    const tokenSet = new Set(this.chunkTokens[chunkId]);
    let hits = 0;
    for (const token of qTokens) {
      if (tokenSet.has(token)) {
        hits += 1;
      }
    }
    return hits;
  }

  private tfScore(chunkId: number, qTokens: string[]): number {
    if (!qTokens.length) return 0;
    let tf = 0;
    for (const token of qTokens) {
      const posting = this.positionIndex.get(token);
      if (!posting) continue;
      tf += posting.get(chunkId)?.length ?? 0;
    }
    return tf;
  }

  private trigramOverlapScore(chunkId: number, qTrigrams: Set<string>): number {
    if (!qTrigrams.size) return 0;
    const chunkTrigrams = this.chunkTrigrams[chunkId];
    if (!chunkTrigrams.size) return 0;

    let intersection = 0;
    for (const gram of qTrigrams) {
      if (chunkTrigrams.has(gram)) {
        intersection += 1;
      }
    }

    return intersection / qTrigrams.size;
  }

  private recencyScore(dateIso: string): number {
    const timestamp = Date.parse(dateIso);
    if (Number.isNaN(timestamp)) {
      return 0;
    }

    const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);
    // Smooth bounded decay, keeps recent emergency notes high without zeroing older chronic context.
    return 1 / (1 + ageDays / 120);
  }
}
