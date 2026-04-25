-- Phase 1 pgvector migration draft
-- Target: patient-scoped semantic retrieval with deterministic policy filtering.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS retrieval_chunks (
  id UUID PRIMARY KEY,
  patient_hash TEXT NOT NULL,
  field_key TEXT NOT NULL,
  note_type TEXT,
  recency_bucket TEXT,
  content_hash TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_dims INTEGER NOT NULL,
  embedding VECTOR(768) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS retrieval_chunks_patient_content_model_uidx
  ON retrieval_chunks (patient_hash, content_hash, embedding_model);

CREATE INDEX IF NOT EXISTS retrieval_chunks_patient_idx
  ON retrieval_chunks (patient_hash);

CREATE INDEX IF NOT EXISTS retrieval_chunks_field_idx
  ON retrieval_chunks (field_key);

CREATE INDEX IF NOT EXISTS retrieval_chunks_note_type_idx
  ON retrieval_chunks (note_type);

-- Cosine distance index for ANN search.
CREATE INDEX IF NOT EXISTS retrieval_chunks_embedding_cosine_ivfflat
  ON retrieval_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Optional: hybrid lexical support from Postgres side.
CREATE INDEX IF NOT EXISTS retrieval_chunks_tsv_idx
  ON retrieval_chunks
  USING gin (to_tsvector('simple', normalized_text));

COMMIT;
