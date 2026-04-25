import Database from "better-sqlite3";

import { CanonicalEvidenceItem } from "@/lib/agent/state";
import { getLexicalIndexDb } from "@/lib/agent/retrieval/buildLexicalIndex";
import {
  LexicalSearchInput,
  LexicalSearchResult,
} from "@/lib/agent/retrieval/retrievalTypes";
import { scoreLexicalCandidate } from "@/lib/agent/retrieval/scoreLexicalCandidates";

type DbOptions = {
  db?: Database.Database;
  dbPath?: string;
};

type RawLexicalRow = {
  payloadJson: string;
  bm25Score: number;
  timestamp: string;
};

function resolveDb(options?: DbOptions) {
  if (options?.db) {
    return options.db;
  }
  return getLexicalIndexDb(options?.dbPath);
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function sanitizeFtsToken(value: string) {
  return value.replace(/[^a-z0-9_]/gi, "").trim();
}

function escapePhrase(value: string) {
  return value.replace(/"/g, '""');
}

function buildMatchExpression(input: LexicalSearchInput) {
  const phraseTerms = input.query.phraseTerms
    .map((term) => normalizeToken(term))
    .filter(Boolean)
    .map((term) => `"${escapePhrase(term)}"`);

  const keywordTerms = input.query.keywordTerms
    .map(sanitizeFtsToken)
    .filter((term) => term.length > 1)
    .map((term) => `"${escapePhrase(term)}"`);

  const phraseClauses = phraseTerms.slice(0, 8);
  const keywordClauses = keywordTerms.slice(0, 24);

  if (!phraseClauses.length && !keywordClauses.length) {
    return "";
  }

  const clauses: string[] = [];
  if (phraseClauses.length) {
    clauses.push(...phraseClauses);
  }
  if (keywordClauses.length) {
    clauses.push(`(${keywordClauses.join(" OR ")})`);
  }

  return clauses.join(" AND ");
}

function normalizeToken(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function listFilterPlaceholders(values: string[]) {
  return values.map(() => "?").join(", ");
}

function buildMetadataFallbackQuery(params: {
  whereClause: string;
  shortlistLimit: number;
}) {
  return {
    sql: `
      SELECT
        m.payload_json AS payloadJson,
        0 AS bm25Score,
        m.timestamp AS timestamp
      FROM lexical_chunk_metadata m
      WHERE ${params.whereClause}
      ORDER BY m.timestamp DESC
      LIMIT ?
    `,
    limit: params.shortlistLimit,
  };
}

function parseCanonicalEvidence(
  payloadJson: string,
): CanonicalEvidenceItem | null {
  try {
    return JSON.parse(payloadJson) as CanonicalEvidenceItem;
  } catch {
    return null;
  }
}

function collectMatchedQueries(
  item: CanonicalEvidenceItem,
  input: LexicalSearchInput,
) {
  const normalizedContent = item.content.toLowerCase();

  const matched = [
    ...input.query.phraseTerms.filter((term) =>
      normalizedContent.includes(term.toLowerCase()),
    ),
    ...input.query.keywordTerms.filter((term) =>
      normalizedContent.includes(term.toLowerCase()),
    ),
  ];

  return dedupe(matched);
}

export function localLexicalSearch(
  input: LexicalSearchInput,
  options?: DbOptions,
): LexicalSearchResult[] {
  if (!input.patientHash) {
    return [];
  }

  const db = resolveDb(options);
  const topK = Math.max(1, input.topK ?? 5);
  const shortlistLimit = Math.max(topK * 4, 20);

  const targetFields = dedupe(input.targetFields ?? []);
  const targetNoteTypes = dedupe(input.targetNoteTypes ?? []);
  const matchExpression = buildMatchExpression(input);

  const whereFragments = ["m.patient_hash = ?"];
  const params: Array<string | number> = [input.patientHash];

  if (targetFields.length) {
    whereFragments.push(
      `m.field_key IN (${listFilterPlaceholders(targetFields)})`,
    );
    params.push(...targetFields);
  }

  if (targetNoteTypes.length) {
    whereFragments.push(
      `m.note_type IN (${listFilterPlaceholders(targetNoteTypes)})`,
    );
    params.push(...targetNoteTypes);
  }

  let rows: RawLexicalRow[] = [];

  if (matchExpression) {
    const sql = `
      SELECT
        m.payload_json AS payloadJson,
        bm25(lexical_chunk_fts) AS bm25Score,
        m.timestamp AS timestamp
      FROM lexical_chunk_fts
      INNER JOIN lexical_chunk_metadata m
        ON m.chunk_id = lexical_chunk_fts.chunk_id
      WHERE ${whereFragments.join(" AND ")} AND lexical_chunk_fts MATCH ?
      ORDER BY bm25(lexical_chunk_fts) ASC, m.timestamp DESC
      LIMIT ?
    `;

    const statement = db.prepare(sql);
    rows = statement.all(
      ...params,
      matchExpression,
      shortlistLimit,
    ) as RawLexicalRow[];

    if (!rows.length && (targetFields.length || targetNoteTypes.length)) {
      const fallback = buildMetadataFallbackQuery({
        whereClause: whereFragments.join(" AND "),
        shortlistLimit,
      });
      rows = db
        .prepare(fallback.sql)
        .all(...params, fallback.limit) as RawLexicalRow[];
    }
  } else {
    const fallback = buildMetadataFallbackQuery({
      whereClause: whereFragments.join(" AND "),
      shortlistLimit,
    });
    rows = db
      .prepare(fallback.sql)
      .all(...params, fallback.limit) as RawLexicalRow[];
  }

  const scored: LexicalSearchResult[] = [];

  for (const row of rows) {
    const item = parseCanonicalEvidence(row.payloadJson);
    if (!item || item.patientHash !== input.patientHash) {
      continue;
    }

    const scoreBreakdown = scoreLexicalCandidate({
      item,
      bm25Score: row.bm25Score,
      query: input.query,
      targetFields,
      targetNoteTypes,
    });

    const matchedQueries = collectMatchedQueries(item, input);

    scored.push({
      item: {
        ...item,
        retrieval: {
          source: "rag",
          retryIteration: 0,
          mode: input.mode ?? "balanced",
          query: input.query.rawQuery,
          score: scoreBreakdown.finalScore,
          bestScore: scoreBreakdown.finalScore,
          matchedQueries,
        },
      },
      source: "rag",
      mode: input.mode ?? "balanced",
      query: input.query.rawQuery,
      score: scoreBreakdown.finalScore,
      matchedQueries,
      scoreBreakdown,
    });
  }

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const timestampCompare = right.item.provenance.timestamp.localeCompare(
      left.item.provenance.timestamp,
    );
    if (timestampCompare !== 0) {
      return timestampCompare;
    }

    return left.item.id.localeCompare(right.item.id);
  });

  return scored.slice(0, topK);
}
