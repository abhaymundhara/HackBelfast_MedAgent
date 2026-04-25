import fs from "fs";
import path from "path";

import Database from "better-sqlite3";

import { CanonicalEvidenceItem } from "@/lib/agent/state";
import { RetrievalIndexStats } from "@/lib/agent/retrieval/retrievalTypes";

type DbOptions = {
  db?: Database.Database;
  dbPath?: string;
};

type BuildLexicalIndexOptions = DbOptions & {
  patientHash?: string;
  mode?: "rebuild" | "upsert";
};

const DEFAULT_INDEX_PATH = path.join(
  process.cwd(),
  "data",
  "lexical-retrieval.db",
);

const dbCache = new Map<string, Database.Database>();

function ensureDbDirectory(dbPath: string) {
  const directory = path.dirname(dbPath);
  fs.mkdirSync(directory, { recursive: true });
}

function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lexical_chunk_metadata (
      chunk_id TEXT PRIMARY KEY,
      patient_hash TEXT NOT NULL,
      field_key TEXT NOT NULL,
      note_type TEXT,
      content TEXT NOT NULL,
      clinical_tags TEXT NOT NULL,
      recency_bucket TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_lexical_meta_patient
      ON lexical_chunk_metadata(patient_hash);
    CREATE INDEX IF NOT EXISTS idx_lexical_meta_patient_field
      ON lexical_chunk_metadata(patient_hash, field_key);
    CREATE INDEX IF NOT EXISTS idx_lexical_meta_patient_note
      ON lexical_chunk_metadata(patient_hash, note_type);

    CREATE VIRTUAL TABLE IF NOT EXISTS lexical_chunk_fts USING fts5(
      chunk_id UNINDEXED,
      patient_hash UNINDEXED,
      field_key,
      note_type,
      content,
      clinical_tags,
      recency_bucket UNINDEXED,
      timestamp UNINDEXED
    );
  `);
}

export function getLexicalIndexDb(dbPath = DEFAULT_INDEX_PATH) {
  const resolvedPath = path.resolve(dbPath);
  const cached = dbCache.get(resolvedPath);
  if (cached) {
    return cached;
  }

  ensureDbDirectory(resolvedPath);
  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  ensureSchema(db);
  dbCache.set(resolvedPath, db);
  return db;
}

function resolveDb(options?: DbOptions) {
  if (options?.db) {
    ensureSchema(options.db);
    return options.db;
  }
  return getLexicalIndexDb(options?.dbPath);
}

function inferPatientHash(
  items: CanonicalEvidenceItem[],
  patientHash?: string,
): string {
  if (patientHash) {
    return patientHash;
  }
  return items[0]?.patientHash ?? "";
}

export function clearLexicalIndex(options?: DbOptions) {
  const db = resolveDb(options);
  const clearInTransaction = db.transaction(() => {
    db.exec("DELETE FROM lexical_chunk_fts;");
    db.exec("DELETE FROM lexical_chunk_metadata;");
  });
  clearInTransaction();
}

export function buildLexicalIndex(
  items: CanonicalEvidenceItem[],
  options?: BuildLexicalIndexOptions,
): RetrievalIndexStats {
  const db = resolveDb(options);
  const patientHash = inferPatientHash(items, options?.patientHash);
  const mode = options?.mode ?? "upsert";

  if (!patientHash) {
    return {
      totalIndexed: 0,
      indexedByField: {},
      indexedByNoteType: {},
      patientHash: "",
    };
  }

  const scopedItems = items.filter((item) => item.patientHash === patientHash);

  const indexedByField: Record<string, number> = {};
  const indexedByNoteType: Record<string, number> = {};

  const deletePatientMetadata = db.prepare(
    "DELETE FROM lexical_chunk_metadata WHERE patient_hash = ?",
  );
  const deletePatientFts = db.prepare(
    "DELETE FROM lexical_chunk_fts WHERE patient_hash = ?",
  );

  const upsertMetadata = db.prepare(`
    INSERT INTO lexical_chunk_metadata (
      chunk_id,
      patient_hash,
      field_key,
      note_type,
      content,
      clinical_tags,
      recency_bucket,
      timestamp,
      payload_json,
      updated_at
    ) VALUES (
      @chunkId,
      @patientHash,
      @fieldKey,
      @noteType,
      @content,
      @clinicalTags,
      @recencyBucket,
      @timestamp,
      @payloadJson,
      @updatedAt
    )
    ON CONFLICT(chunk_id) DO UPDATE SET
      patient_hash = excluded.patient_hash,
      field_key = excluded.field_key,
      note_type = excluded.note_type,
      content = excluded.content,
      clinical_tags = excluded.clinical_tags,
      recency_bucket = excluded.recency_bucket,
      timestamp = excluded.timestamp,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `);

  const deleteFtsRow = db.prepare(
    "DELETE FROM lexical_chunk_fts WHERE chunk_id = ?",
  );
  const insertFtsRow = db.prepare(`
    INSERT INTO lexical_chunk_fts (
      chunk_id,
      patient_hash,
      field_key,
      note_type,
      content,
      clinical_tags,
      recency_bucket,
      timestamp
    ) VALUES (
      @chunkId,
      @patientHash,
      @fieldKey,
      @noteType,
      @content,
      @clinicalTags,
      @recencyBucket,
      @timestamp
    )
  `);

  const runBuild = db.transaction(() => {
    if (mode === "rebuild") {
      deletePatientMetadata.run(patientHash);
      deletePatientFts.run(patientHash);
    }

    for (const item of scopedItems) {
      const fieldKey = item.authorization.fieldKey;
      const noteType = item.noteType ?? "unknown";
      const clinicalTags = item.clinicalTags.join(" ");
      const timestamp = item.provenance.timestamp;
      const updatedAt = new Date().toISOString();

      indexedByField[fieldKey] = (indexedByField[fieldKey] ?? 0) + 1;
      indexedByNoteType[noteType] = (indexedByNoteType[noteType] ?? 0) + 1;

      const row = {
        chunkId: item.id,
        patientHash: item.patientHash,
        fieldKey,
        noteType,
        content: item.content,
        clinicalTags,
        recencyBucket: item.recencyBucket,
        timestamp,
        payloadJson: JSON.stringify(item),
        updatedAt,
      };

      upsertMetadata.run(row);
      deleteFtsRow.run(item.id);
      insertFtsRow.run(row);
    }
  });

  runBuild();

  return {
    totalIndexed: scopedItems.length,
    indexedByField,
    indexedByNoteType,
    patientHash,
  };
}
