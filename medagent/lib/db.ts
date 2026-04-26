import crypto from "crypto";
import fs from "fs";
import path from "path";

import Database from "better-sqlite3";

import { decryptJson, encryptJson } from "@/lib/crypto";
import {
  AuditEvent,
  AuditEventType,
  AgentTrace,
  ClinicianPersona,
  EmergencySummary,
  PatientPolicy,
} from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DOC_DIR = path.join(DATA_DIR, "documents");
const DB_PATH = path.join(DATA_DIR, "medagent.db");

let database: Database.Database | null = null;

type PatientRow = {
  id: string;
  local_identity: string;
  registry_account_id: string | null;
  chain_identity: string | null;
  audit_ref: string | null;
  patient_hash: string;
  encrypted_summary: string;
  created_at: string;
  updated_at: string;
};

type PatientAccountRow = {
  id: string;
  patient_id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  solana_log_pda: string | null;
  created_at: string;
  last_login_at: string | null;
};

type DoctorRegistryRow = {
  reg_number: string;
  reg_body: string;
  name: string;
  email: string;
  specialty: string | null;
  hospital: string | null;
  jurisdiction: string;
  status: string;
};

type AppointmentSlotRow = {
  id: string;
  doctor_reg_number: string;
  doctor_name: string;
  doctor_email: string;
  specialty: string | null;
  clinic: string;
  jurisdiction: string;
  starts_at: string;
  ends_at: string;
  status: string;
  reason_tags_json: string;
  created_at: string;
  updated_at: string;
};

type AppointmentRow = {
  id: string;
  patient_id: string;
  slot_id: string;
  doctor_reg_number: string;
  doctor_name: string;
  doctor_email: string;
  clinic: string;
  starts_at: string;
  ends_at: string;
  symptom_summary: string;
  status: string;
  share_id: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

type PolicyRow = {
  patient_id: string;
  emergency_auto_access: number;
  allow_patient_approval_requests: number;
  break_glass_allowed: number;
  shareable_document_ids: string;
};

type DocumentRow = {
  id: string;
  patient_id: string;
  title: string;
  mime_type: string;
  storage_path: string;
  patient_approved: number;
  created_at: string;
  file_size_bytes: number | null;
  page_count: number | null;
  pdf_author: string | null;
  pdf_creation_date: string | null;
  pdf_producer: string | null;
  pdf_keywords: string | null;
  extraction_method: string | null;
  extracted_text_length: number | null;
};

type AccessRequestRow = {
  id: string;
  patient_id: string;
  requester_id: string;
  requester_label: string | null;
  issuer_label: string | null;
  natural_language_request: string;
  presented_credential: string | null;
  emergency_mode: number;
  status: string;
  decision: string | null;
  tier: number | null;
  ttl_seconds: number | null;
  justification: string | null;
  approval_method: string | null;
  approval_token: string | null;
  fields_allowed_json: string | null;
  fields_released_json: string | null;
  chain_ref: string | null;
  chain_sequence: number | null;
  chain_timestamp: string | null;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  request_id: string;
  patient_id: string;
  requester_id: string;
  tier: number;
  jwt: string;
  expires_at: string;
  fields_allowed_json: string;
  encrypted_summary: string;
  encrypted_translated_summary: string;
  glossary_json: string;
  brief: string;
  chain_ref: string | null;
  chain_sequence: number | null;
  chain_timestamp: string | null;
  created_at: string;
};

type AuditEventRow = {
  id: string;
  request_id: string;
  patient_id: string;
  event_type: string;
  decision: string | null;
  doctor_hash: string;
  patient_hash: string;
  jurisdiction: string;
  token_expiry: string | null;
  payload_json: string;
  chain_ref: string;
  chain_sequence: number | null;
  chain_timestamp: string | null;
  created_at: string;
};

type PendingAuditEventRow = {
  id: string;
  idempotency_key: string;
  request_id: string;
  patient_id: string;
  payload_json: string;
  status: string;
  chain_ref: string | null;
  chain_sequence: number | null;
  chain_timestamp: string | null;
  error: string | null;
  last_attempt_at: string;
  created_at: string;
  updated_at: string;
};

type ImessageUserRow = {
  handle: string;
  stage: string;
  full_name: string | null;
  dob: string | null;
  patient_id: string | null;
  onboarding_record_draft: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

function ensureDataDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(DOC_DIR, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function bool(value: number) {
  return value === 1;
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function ensureColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  definition: string,
) {
  const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (
    !identifierPattern.test(tableName) ||
    !identifierPattern.test(columnName)
  ) {
    throw new Error("Invalid SQL identifier passed to ensureColumn");
  }

  const normalizedDefinition = definition.trim().toUpperCase();
  const allowedDefinitions = new Set(["TEXT", "INTEGER"]);
  if (!allowedDefinitions.has(normalizedDefinition)) {
    throw new Error(
      `Invalid SQL column definition passed to ensureColumn: ${definition}`,
    );
  }

  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as {
    name: string;
  }[];
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${normalizedDefinition}`,
    );
  }
}

export function getDocStoragePath(patientId: string, documentId: string) {
  return path.join(DOC_DIR, `${patientId}__${documentId}.bin`);
}

export function writeEncryptedDocument(
  patientId: string,
  documentId: string,
  encryptedBytes: Buffer,
) {
  const storagePath = getDocStoragePath(patientId, documentId);
  fs.writeFileSync(storagePath, encryptedBytes);
  return storagePath;
}

export function readEncryptedDocument(storagePath: string) {
  return fs.readFileSync(storagePath);
}

export function getDb() {
  if (!database) {
    ensureDataDirs();
    database = new Database(DB_PATH);
    database.pragma("journal_mode = WAL");
    initDb();
  }
  return database;
}

export function initDb() {
  const db = database ?? new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      local_identity TEXT NOT NULL,
      registry_account_id TEXT,
      chain_identity TEXT,
      audit_ref TEXT,
      patient_hash TEXT NOT NULL,
      encrypted_summary TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patient_documents (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      title TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      patient_approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS patient_policies (
      patient_id TEXT PRIMARY KEY,
      emergency_auto_access INTEGER NOT NULL DEFAULT 0,
      allow_patient_approval_requests INTEGER NOT NULL DEFAULT 0,
      break_glass_allowed INTEGER NOT NULL DEFAULT 0,
      shareable_document_ids TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS issuer_registry (
      id TEXT PRIMARY KEY,
      requester_id TEXT NOT NULL UNIQUE,
      requester_label TEXT NOT NULL,
      issuer_id TEXT NOT NULL,
      issuer_label TEXT NOT NULL,
      locale TEXT NOT NULL,
      trusted INTEGER NOT NULL DEFAULT 0,
      verification_mode TEXT NOT NULL,
      registry_account_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS access_requests (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      requester_id TEXT NOT NULL,
      requester_label TEXT,
      issuer_label TEXT,
      natural_language_request TEXT NOT NULL,
      presented_credential TEXT,
      emergency_mode INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      decision TEXT,
      tier INTEGER,
      ttl_seconds INTEGER,
      justification TEXT,
      approval_method TEXT,
      approval_token TEXT,
      fields_allowed_json TEXT,
      fields_released_json TEXT,
      chain_ref TEXT,
      chain_sequence INTEGER,
      chain_timestamp TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      decided_at TEXT,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES access_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      requester_id TEXT NOT NULL,
      tier INTEGER NOT NULL,
      jwt TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      fields_allowed_json TEXT NOT NULL,
      encrypted_summary TEXT NOT NULL,
      encrypted_translated_summary TEXT NOT NULL,
      glossary_json TEXT NOT NULL,
      brief TEXT NOT NULL,
      chain_ref TEXT,
      chain_sequence INTEGER,
      chain_timestamp TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES access_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      decision TEXT,
      doctor_hash TEXT NOT NULL,
      patient_hash TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      token_expiry TEXT,
      payload_json TEXT NOT NULL,
      chain_ref TEXT NOT NULL,
      chain_sequence INTEGER,
      chain_timestamp TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES access_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pending_audit_events (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      request_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      chain_ref TEXT,
      chain_sequence INTEGER,
      chain_timestamp TEXT,
      error TEXT,
      last_attempt_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES access_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_traces (
      request_id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      requester_id TEXT NOT NULL,
      trace_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS imessage_conversations (
      handle TEXT PRIMARY KEY,
      identity_id TEXT NOT NULL,
      identity_kind TEXT NOT NULL,
      active_request_id TEXT,
      awaiting TEXT,
      last_message_at TEXT NOT NULL,
      metadata_json TEXT
    );
    CREATE INDEX IF NOT EXISTS imessage_conversations_request
      ON imessage_conversations(active_request_id);

    CREATE TABLE IF NOT EXISTS doctor_registry (
      reg_number TEXT PRIMARY KEY,
      reg_body TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      specialty TEXT,
      hospital TEXT,
      jurisdiction TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS doctor_otps (
      id TEXT PRIMARY KEY,
      reg_number TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS doctor_sessions (
      id TEXT PRIMARY KEY,
      reg_number TEXT NOT NULL,
      name TEXT NOT NULL,
      jwt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patient_accounts (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      solana_log_pda TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE IF NOT EXISTS imessage_users (
      handle TEXT PRIMARY KEY,
      stage TEXT NOT NULL,
      full_name TEXT,
      dob TEXT,
      patient_id TEXT,
      onboarding_record_draft TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS imessage_users_stage
      ON imessage_users(stage);

    CREATE TABLE IF NOT EXISTS appointment_slots (
      id TEXT PRIMARY KEY,
      doctor_reg_number TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      doctor_email TEXT NOT NULL,
      specialty TEXT,
      clinic TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      reason_tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS appointment_slots_lookup
      ON appointment_slots(status, jurisdiction, starts_at);

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      doctor_reg_number TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      doctor_email TEXT NOT NULL,
      clinic TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      symptom_summary TEXT NOT NULL,
      status TEXT NOT NULL,
      share_id TEXT,
      confirmed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS appointments_patient
      ON appointments(patient_id, created_at);

    CREATE TABLE IF NOT EXISTS message_events (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      handle TEXT NOT NULL,
      direction TEXT NOT NULL,
      linked_request_id TEXT,
      linked_chain_ref TEXT,
      event_type TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS message_events_message_id
      ON message_events(message_id);
    CREATE INDEX IF NOT EXISTS message_events_request_id
      ON message_events(linked_request_id);

    CREATE TABLE IF NOT EXISTS shared_records (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      doctor_email TEXT NOT NULL,
      doctor_hash TEXT NOT NULL,
      encrypted_summary TEXT NOT NULL,
      encrypted_share_key TEXT NOT NULL,
      fields_shared TEXT NOT NULL,
      access_token_hash TEXT NOT NULL,
      document_hash TEXT NOT NULL,
      share_scope TEXT NOT NULL DEFAULT 'field_subset',
      appointment_id TEXT,
      document_manifest_json TEXT,
      share_payload_version TEXT NOT NULL DEFAULT '1',
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TEXT NOT NULL,
      max_access_count INTEGER DEFAULT 3,
      access_count INTEGER DEFAULT 0,
      share_chain_ref TEXT,
      share_chain_slot INTEGER,
      access_chain_ref TEXT,
      revoke_chain_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
  `);

  // Lightweight forward-compatible migration for branches that already have old schemas.
  ensureColumn(db, "access_requests", "chain_ref", "TEXT");
  ensureColumn(db, "access_requests", "chain_sequence", "INTEGER");
  ensureColumn(db, "access_requests", "chain_timestamp", "TEXT");
  ensureColumn(db, "sessions", "chain_ref", "TEXT");
  ensureColumn(db, "sessions", "chain_sequence", "INTEGER");
  ensureColumn(db, "sessions", "chain_timestamp", "TEXT");
  ensureColumn(db, "patients", "registry_account_id", "TEXT");
  ensureColumn(db, "patients", "chain_identity", "TEXT");
  ensureColumn(db, "patients", "audit_ref", "TEXT");
  ensureColumn(db, "issuer_registry", "registry_account_id", "TEXT");
  ensureColumn(db, "issuer_registry", "jurisdiction", "TEXT");
  ensureColumn(
    db,
    "issuer_registry",
    "requires_cross_system_approval",
    "INTEGER",
  );
  ensureColumn(db, "patient_accounts", "solana_log_pda", "TEXT");
  ensureColumn(db, "shared_records", "share_scope", "TEXT");
  ensureColumn(db, "shared_records", "appointment_id", "TEXT");
  ensureColumn(db, "shared_records", "document_manifest_json", "TEXT");
  ensureColumn(db, "shared_records", "share_payload_version", "TEXT");
  ensureColumn(db, "shared_records", "short_code", "TEXT");
  ensureColumn(db, "access_requests", "source_message_id", "TEXT");
  ensureColumn(db, "access_requests", "clinician_handle", "TEXT");
  ensureColumn(db, "access_requests", "clinician_chat_guid", "TEXT");
  ensureColumn(db, "audit_events", "source_message_id", "TEXT");
  ensureColumn(db, "pending_audit_events", "source_message_id", "TEXT");
  ensureColumn(db, "patient_documents", "file_size_bytes", "INTEGER");
  ensureColumn(db, "patient_documents", "page_count", "INTEGER");
  ensureColumn(db, "patient_documents", "pdf_author", "TEXT");
  ensureColumn(db, "patient_documents", "pdf_creation_date", "TEXT");
  ensureColumn(db, "patient_documents", "pdf_producer", "TEXT");
  ensureColumn(db, "patient_documents", "pdf_keywords", "TEXT");
  ensureColumn(db, "patient_documents", "extraction_method", "TEXT");
  ensureColumn(db, "patient_documents", "extracted_text_length", "INTEGER");

  if (!database) {
    db.close();
  }
}

export function resetDatabase() {
  if (database) {
    database.close();
    database = null;
  }
  for (const filePath of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
  if (fs.existsSync(DOC_DIR)) {
    fs.rmSync(DOC_DIR, { recursive: true, force: true });
  }
  ensureDataDirs();
  getDb();
}

export function setAppConfig(key: string, value: unknown) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO app_config (key, value, updated_at)
    VALUES (@key, @value, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  stmt.run({
    key,
    value: JSON.stringify(value),
    updatedAt: nowIso(),
  });
}

export function getAppConfig<T>(key: string): T | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM app_config WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : null;
}

export function upsertIssuerRegistry(
  persona: ClinicianPersona,
  registryAccountId?: string | null,
) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO issuer_registry (
      id, requester_id, requester_label, issuer_id, issuer_label, locale,
      trusted, verification_mode, registry_account_id, created_at, updated_at
    ) VALUES (
      @id, @requesterId, @requesterLabel, @issuerId, @issuerLabel, @locale,
      @trusted, @verificationMode, @registryAccountId, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      requester_id = excluded.requester_id,
      requester_label = excluded.requester_label,
      issuer_id = excluded.issuer_id,
      issuer_label = excluded.issuer_label,
      locale = excluded.locale,
      trusted = excluded.trusted,
      verification_mode = excluded.verification_mode,
      registry_account_id = excluded.registry_account_id,
      updated_at = excluded.updated_at
  `);
  const timestamp = nowIso();
  stmt.run({
    id: persona.id,
    requesterId: persona.requesterId,
    requesterLabel: persona.requesterLabel,
    issuerId: persona.issuerId,
    issuerLabel: persona.issuerLabel,
    locale: persona.locale,
    trusted: persona.stronglyVerified ? 1 : 0,
    verificationMode: persona.stronglyVerified
      ? "trusted_registry"
      : "unverified",
    registryAccountId: registryAccountId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function listIssuerRegistry() {
  const db = getDb();
  return db
    .prepare("SELECT * FROM issuer_registry ORDER BY requester_label")
    .all() as {
    id: string;
    requester_id: string;
    requester_label: string;
    issuer_id: string;
    issuer_label: string;
    locale: string;
    trusted: number;
    verification_mode: string;
    registry_account_id: string | null;
    jurisdiction: string | null;
    requires_cross_system_approval: number | null;
  }[];
}

export function getIssuerByRequesterId(requesterId: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM issuer_registry WHERE requester_id = ? OR id = ?")
    .get(requesterId, requesterId) as
    | {
        id: string;
        requester_id: string;
        requester_label: string;
        issuer_id: string;
        issuer_label: string;
        locale: string;
        trusted: number;
        verification_mode: string;
        registry_account_id: string | null;
        jurisdiction: string | null;
        requires_cross_system_approval: number | null;
      }
    | undefined;
}

export function upsertPatient(input: {
  patientId: string;
  localIdentity: string;
  encryptedSummary: string;
  patientHash: string;
  chainIdentity?: string | null;
  registryAccountId?: string | null;
  auditRef?: string | null;
}) {
  const db = getDb();
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO patients (
      id, local_identity, registry_account_id, chain_identity, audit_ref,
      patient_hash, encrypted_summary, created_at, updated_at
    ) VALUES (
      @patientId, @localIdentity, @registryAccountId, @chainIdentity, @auditRef,
      @patientHash, @encryptedSummary, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      local_identity = excluded.local_identity,
      registry_account_id = excluded.registry_account_id,
      chain_identity = excluded.chain_identity,
      audit_ref = excluded.audit_ref,
      patient_hash = excluded.patient_hash,
      encrypted_summary = excluded.encrypted_summary,
      updated_at = excluded.updated_at
  `,
  ).run({
    patientId: input.patientId,
    localIdentity: input.localIdentity,
    registryAccountId: input.registryAccountId ?? null,
    chainIdentity: input.chainIdentity ?? null,
    auditRef: input.auditRef ?? null,
    patientHash: input.patientHash,
    encryptedSummary: input.encryptedSummary,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function savePatientPolicy(patientId: string, policy: PatientPolicy) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO patient_policies (
      patient_id, emergency_auto_access, allow_patient_approval_requests,
      break_glass_allowed, shareable_document_ids, updated_at
    ) VALUES (
      @patientId, @emergencyAutoAccess, @allowPatientApprovalRequests,
      @breakGlassAllowed, @shareableDocumentIds, @updatedAt
    )
    ON CONFLICT(patient_id) DO UPDATE SET
      emergency_auto_access = excluded.emergency_auto_access,
      allow_patient_approval_requests = excluded.allow_patient_approval_requests,
      break_glass_allowed = excluded.break_glass_allowed,
      shareable_document_ids = excluded.shareable_document_ids,
      updated_at = excluded.updated_at
  `,
  ).run({
    patientId,
    emergencyAutoAccess: policy.emergencyAutoAccess ? 1 : 0,
    allowPatientApprovalRequests: policy.allowPatientApprovalRequests ? 1 : 0,
    breakGlassAllowed: policy.breakGlassAllowed ? 1 : 0,
    shareableDocumentIds: JSON.stringify(policy.shareableDocumentIds),
    updatedAt: nowIso(),
  });
}

export function savePatientDocumentMetadata(input: {
  id: string;
  patientId: string;
  title: string;
  mimeType: string;
  storagePath: string;
  patientApproved: boolean;
  fileSizeBytes?: number | null;
  pageCount?: number | null;
  pdfAuthor?: string | null;
  pdfCreationDate?: string | null;
  pdfProducer?: string | null;
  pdfKeywords?: string | null;
  extractionMethod?: string | null;
  extractedTextLength?: number | null;
}) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO patient_documents (
      id, patient_id, title, mime_type, storage_path, patient_approved, created_at,
      file_size_bytes, page_count, pdf_author, pdf_creation_date, pdf_producer,
      pdf_keywords, extraction_method, extracted_text_length
    ) VALUES (
      @id, @patientId, @title, @mimeType, @storagePath, @patientApproved, @createdAt,
      @fileSizeBytes, @pageCount, @pdfAuthor, @pdfCreationDate, @pdfProducer,
      @pdfKeywords, @extractionMethod, @extractedTextLength
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      mime_type = excluded.mime_type,
      storage_path = excluded.storage_path,
      patient_approved = excluded.patient_approved,
      file_size_bytes = excluded.file_size_bytes,
      page_count = excluded.page_count,
      pdf_author = excluded.pdf_author,
      pdf_creation_date = excluded.pdf_creation_date,
      pdf_producer = excluded.pdf_producer,
      pdf_keywords = excluded.pdf_keywords,
      extraction_method = excluded.extraction_method,
      extracted_text_length = excluded.extracted_text_length
  `,
  ).run({
    id: input.id,
    patientId: input.patientId,
    title: input.title,
    mimeType: input.mimeType,
    storagePath: input.storagePath,
    patientApproved: input.patientApproved ? 1 : 0,
    createdAt: nowIso(),
    fileSizeBytes: input.fileSizeBytes ?? null,
    pageCount: input.pageCount ?? null,
    pdfAuthor: input.pdfAuthor ?? null,
    pdfCreationDate: input.pdfCreationDate ?? null,
    pdfProducer: input.pdfProducer ?? null,
    pdfKeywords: input.pdfKeywords ?? null,
    extractionMethod: input.extractionMethod ?? null,
    extractedTextLength: input.extractedTextLength ?? null,
  });
}

export function deletePatientDocuments(patientId: string) {
  const db = getDb();
  const rows = db
    .prepare("SELECT storage_path FROM patient_documents WHERE patient_id = ?")
    .all(patientId) as { storage_path: string }[];
  for (const row of rows) {
    if (fs.existsSync(row.storage_path)) {
      fs.rmSync(row.storage_path, { force: true });
    }
  }
  db.prepare("DELETE FROM patient_documents WHERE patient_id = ?").run(
    patientId,
  );
}

export function getPatientRow(patientId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM patients WHERE id = ?").get(patientId) as
    | PatientRow
    | undefined;
}

export function getPatientRowByHash(patientHash: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM patients WHERE patient_hash = ?")
    .get(patientHash) as PatientRow | undefined;
}

export function getPatientPolicy(patientId: string): PatientPolicy | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM patient_policies WHERE patient_id = ?")
    .get(patientId) as PolicyRow | undefined;
  if (!row) {
    return null;
  }
  return {
    emergencyAutoAccess: bool(row.emergency_auto_access),
    allowPatientApprovalRequests: bool(row.allow_patient_approval_requests),
    breakGlassAllowed: bool(row.break_glass_allowed),
    shareableDocumentIds: parseJson<string[]>(row.shareable_document_ids, []),
  };
}

export function getPatientSummary(patientId: string): EmergencySummary | null {
  const row = getPatientRow(patientId);
  return row ? decryptJson<EmergencySummary>(row.encrypted_summary) : null;
}

export function getPatientAccountByPatientId(patientId: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM patient_accounts WHERE patient_id = ? LIMIT 1")
    .get(patientId) as PatientAccountRow | undefined;
}

export function listDoctorRegistry() {
  const db = getDb();
  return db
    .prepare("SELECT * FROM doctor_registry ORDER BY name")
    .all() as DoctorRegistryRow[];
}

export function setPatientAccountSolanaLogPda(
  patientId: string,
  solanaLogPda: string | null,
) {
  const db = getDb();
  db.prepare(
    "UPDATE patient_accounts SET solana_log_pda = ? WHERE patient_id = ?",
  ).run(solanaLogPda, patientId);
}

export function listPatientDocuments(patientId: string) {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM patient_documents WHERE patient_id = ? ORDER BY title",
    )
    .all(patientId) as DocumentRow[];
}

export type AppointmentSlot = {
  id: string;
  doctorRegNumber: string;
  doctorName: string;
  doctorEmail: string;
  specialty: string | null;
  clinic: string;
  jurisdiction: string;
  startsAt: string;
  endsAt: string;
  status: string;
  reasonTags: string[];
  createdAt: string;
  updatedAt: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  slotId: string;
  doctorRegNumber: string;
  doctorName: string;
  doctorEmail: string;
  clinic: string;
  startsAt: string;
  endsAt: string;
  symptomSummary: string;
  status: string;
  shareId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapAppointmentSlot(row: AppointmentSlotRow): AppointmentSlot {
  return {
    id: row.id,
    doctorRegNumber: row.doctor_reg_number,
    doctorName: row.doctor_name,
    doctorEmail: row.doctor_email,
    specialty: row.specialty,
    clinic: row.clinic,
    jurisdiction: row.jurisdiction,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    reasonTags: parseJson<string[]>(row.reason_tags_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    slotId: row.slot_id,
    doctorRegNumber: row.doctor_reg_number,
    doctorName: row.doctor_name,
    doctorEmail: row.doctor_email,
    clinic: row.clinic,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    symptomSummary: row.symptom_summary,
    status: row.status,
    shareId: row.share_id,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function upsertAppointmentSlot(input: {
  id: string;
  doctorRegNumber: string;
  doctorName: string;
  doctorEmail: string;
  specialty?: string | null;
  clinic: string;
  jurisdiction: string;
  startsAt: string;
  endsAt: string;
  status?: string;
  reasonTags: string[];
}) {
  const db = getDb();
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO appointment_slots (
      id, doctor_reg_number, doctor_name, doctor_email, specialty, clinic,
      jurisdiction, starts_at, ends_at, status, reason_tags_json, created_at, updated_at
    ) VALUES (
      @id, @doctorRegNumber, @doctorName, @doctorEmail, @specialty, @clinic,
      @jurisdiction, @startsAt, @endsAt, @status, @reasonTagsJson, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      doctor_reg_number = excluded.doctor_reg_number,
      doctor_name = excluded.doctor_name,
      doctor_email = excluded.doctor_email,
      specialty = excluded.specialty,
      clinic = excluded.clinic,
      jurisdiction = excluded.jurisdiction,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      status = excluded.status,
      reason_tags_json = excluded.reason_tags_json,
      updated_at = excluded.updated_at`,
  ).run({
    id: input.id,
    doctorRegNumber: input.doctorRegNumber,
    doctorName: input.doctorName,
    doctorEmail: input.doctorEmail,
    specialty: input.specialty ?? null,
    clinic: input.clinic,
    jurisdiction: input.jurisdiction,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status ?? "available",
    reasonTagsJson: JSON.stringify(input.reasonTags),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function listAppointmentSlots(input: {
  jurisdiction?: string;
  from?: string;
  to?: string;
  status?: string;
} = {}) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.jurisdiction) {
    clauses.push("jurisdiction = @jurisdiction");
    params.jurisdiction = input.jurisdiction;
  }
  if (input.from) {
    clauses.push("starts_at >= @from");
    params.from = input.from;
  }
  if (input.to) {
    clauses.push("starts_at < @to");
    params.to = input.to;
  }
  if (input.status) {
    clauses.push("status = @status");
    params.status = input.status;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(`SELECT * FROM appointment_slots ${where} ORDER BY starts_at ASC`)
    .all(params) as AppointmentSlotRow[];
  return rows.map(mapAppointmentSlot);
}

export function getAppointmentSlot(slotId: string) {
  const row = getDb()
    .prepare("SELECT * FROM appointment_slots WHERE id = ?")
    .get(slotId) as AppointmentSlotRow | undefined;
  return row ? mapAppointmentSlot(row) : null;
}

export function createAppointment(input: {
  id: string;
  patientId: string;
  slotId: string;
  doctorRegNumber: string;
  doctorName: string;
  doctorEmail: string;
  clinic: string;
  startsAt: string;
  endsAt: string;
  symptomSummary: string;
}) {
  const db = getDb();
  const timestamp = nowIso();
  const tx = db.transaction(() => {
    const slotUpdate = db
      .prepare(
        `UPDATE appointment_slots
         SET status = 'booked', updated_at = @updatedAt
         WHERE id = @slotId AND status = 'available'`,
      )
      .run({ slotId: input.slotId, updatedAt: timestamp });
    if (slotUpdate.changes !== 1) {
      throw new Error("Appointment slot is no longer available");
    }
    db.prepare(
      `INSERT INTO appointments (
        id, patient_id, slot_id, doctor_reg_number, doctor_name, doctor_email,
        clinic, starts_at, ends_at, symptom_summary, status, share_id,
        confirmed_at, created_at, updated_at
      ) VALUES (
        @id, @patientId, @slotId, @doctorRegNumber, @doctorName, @doctorEmail,
        @clinic, @startsAt, @endsAt, @symptomSummary, 'confirmed', NULL,
        @confirmedAt, @createdAt, @updatedAt
      )`,
    ).run({
      id: input.id,
      patientId: input.patientId,
      slotId: input.slotId,
      doctorRegNumber: input.doctorRegNumber,
      doctorName: input.doctorName,
      doctorEmail: input.doctorEmail,
      clinic: input.clinic,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      symptomSummary: input.symptomSummary,
      confirmedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
  tx();
  return getAppointment(input.id);
}

export function getAppointment(appointmentId: string) {
  const row = getDb()
    .prepare("SELECT * FROM appointments WHERE id = ?")
    .get(appointmentId) as AppointmentRow | undefined;
  return row ? mapAppointment(row) : null;
}

export function attachShareToAppointment(appointmentId: string, shareId: string) {
  getDb()
    .prepare(
      `UPDATE appointments
       SET share_id = @shareId, updated_at = @updatedAt
       WHERE id = @appointmentId`,
    )
    .run({ appointmentId, shareId, updatedAt: nowIso() });
}

export function listPatientsSafe() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM patients ORDER BY id")
    .all() as PatientRow[];
  const safeProfiles: Array<{
    patientId: string;
    name: string;
    email: string;
    homeCountry: string;
    localIdentity: string;
    chainIdentity: string | null;
    auditRef: string | null;
  }> = [];

  for (const row of rows) {
    try {
      const summary = decryptJson<EmergencySummary>(row.encrypted_summary);
      safeProfiles.push({
        patientId: row.id,
        name: summary.demographics.name,
        email: summary.demographics.email,
        homeCountry: summary.demographics.homeCountry,
        localIdentity: row.local_identity,
        chainIdentity: row.chain_identity,
        auditRef: row.audit_ref,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[db] skipping patient ${row.id} in listPatientsSafe: failed to decrypt summary (${message}). Check ENCRYPTION_PEPPER consistency or reseed demo data.`,
      );
    }
  }

  return safeProfiles;
}

export function getPatientSafeProfile(patientId: string) {
  const row = getPatientRow(patientId);
  if (!row) {
    return null;
  }
  const summary = decryptJson<EmergencySummary>(row.encrypted_summary);
  const policy = getPatientPolicy(patientId);
  const approvals = listPendingApprovalsByPatient(patientId);
  const documents = listPatientDocuments(patientId).map((doc) => ({
    id: doc.id,
    title: doc.title,
    mimeType: doc.mime_type,
    patientApprovedForTier1Or2: bool(doc.patient_approved),
  }));
  return {
    patientId: row.id,
    name: summary.demographics.name,
    email: summary.demographics.email,
    localIdentity: row.local_identity,
    chainIdentity: row.chain_identity,
    auditRef: row.audit_ref,
    policy,
    documents,
    pendingApprovals: approvals,
  };
}

export function createAccessRequest(input: {
  id: string;
  patientId: string;
  requesterId: string;
  requesterLabel?: string | null;
  issuerLabel?: string | null;
  naturalLanguageRequest: string;
  presentedCredential?: string | null;
  emergencyMode: boolean;
  sourceMessageId?: string | null;
  clinicianHandle?: string | null;
  clinicianChatGuid?: string | null;
}) {
  const db = getDb();
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO access_requests (
      id, patient_id, requester_id, requester_label, issuer_label,
      natural_language_request, presented_credential, emergency_mode,
      source_message_id, clinician_handle, clinician_chat_guid,
      status, created_at, updated_at
    ) VALUES (
      @id, @patientId, @requesterId, @requesterLabel, @issuerLabel,
      @naturalLanguageRequest, @presentedCredential, @emergencyMode,
      @sourceMessageId, @clinicianHandle, @clinicianChatGuid,
      'pending', @createdAt, @updatedAt
    )
  `,
  ).run({
    id: input.id,
    patientId: input.patientId,
    requesterId: input.requesterId,
    requesterLabel: input.requesterLabel ?? null,
    issuerLabel: input.issuerLabel ?? null,
    naturalLanguageRequest: input.naturalLanguageRequest,
    presentedCredential: input.presentedCredential ?? null,
    emergencyMode: input.emergencyMode ? 1 : 0,
    sourceMessageId: input.sourceMessageId ?? null,
    clinicianHandle: input.clinicianHandle ?? null,
    clinicianChatGuid: input.clinicianChatGuid ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function updateAccessRequest(
  requestId: string,
  patch: Partial<{
    requesterLabel: string | null;
    issuerLabel: string | null;
    status: string;
    decision: string | null;
    tier: number | null;
    ttlSeconds: number | null;
    justification: string | null;
    approvalMethod: string | null;
    approvalToken: string | null;
    fieldsAllowed: string[] | null;
    fieldsReleased: string[] | null;
    chainRef: string | null;
    chainSequence: number | null;
    chainTimestamp: string | null;
  }>,
) {
  const db = getDb();
  const fields = [];
  const values: Record<string, unknown> = { requestId, updatedAt: nowIso() };

  const mapping: Record<string, string> = {
    requesterLabel: "requester_label",
    issuerLabel: "issuer_label",
    status: "status",
    decision: "decision",
    tier: "tier",
    ttlSeconds: "ttl_seconds",
    justification: "justification",
    approvalMethod: "approval_method",
    approvalToken: "approval_token",
    fieldsAllowed: "fields_allowed_json",
    fieldsReleased: "fields_released_json",
    chainRef: "chain_ref",
    chainSequence: "chain_sequence",
    chainTimestamp: "chain_timestamp",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (key in patch) {
      fields.push(`${column} = @${key}`);
      const value = patch[key as keyof typeof patch];
      values[key] =
        key === "fieldsAllowed" || key === "fieldsReleased"
          ? JSON.stringify(value ?? [])
          : value;
    }
  }

  fields.push("updated_at = @updatedAt");
  db.prepare(
    `UPDATE access_requests SET ${fields.join(", ")} WHERE id = @requestId`,
  ).run(values);
}

export function getAccessRequest(requestId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM access_requests WHERE id = ?")
    .get(requestId) as AccessRequestRow | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    emergency_mode: bool(row.emergency_mode),
    fields_allowed: parseJson<string[]>(row.fields_allowed_json, []),
    fields_released: parseJson<string[]>(row.fields_released_json, []),
  };
}

export function createApproval(input: {
  id: string;
  requestId: string;
  patientId: string;
  token: string;
  method: "push" | "email";
  expiresAt: string;
}) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO approvals (
      id, request_id, patient_id, token, method, status, sent_at, expires_at
    ) VALUES (
      @id, @requestId, @patientId, @token, @method, 'pending', @sentAt, @expiresAt
    )
  `,
  ).run({
    id: input.id,
    requestId: input.requestId,
    patientId: input.patientId,
    token: input.token,
    method: input.method,
    sentAt: nowIso(),
    expiresAt: input.expiresAt,
  });
}

export function getApprovalByToken(token: string) {
  const db = getDb();
  const approval = db
    .prepare("SELECT * FROM approvals WHERE token = ?")
    .get(token) as
    | {
        id: string;
        request_id: string;
        patient_id: string;
        token: string;
        method: "push" | "email";
        status: string;
        sent_at: string;
        decided_at: string | null;
        expires_at: string;
      }
    | undefined;

  if (
    approval &&
    approval.status === "pending" &&
    isExpired(approval.expires_at)
  ) {
    updateApprovalStatus(token, "expired");
    updateAccessRequest(approval.request_id, {
      status: "expired",
      decision: "denied",
      justification:
        "The patient approval window expired before a decision was received. No data was released.",
      fieldsReleased: [],
    });

    return {
      ...approval,
      status: "expired",
      decided_at: nowIso(),
    };
  }

  return approval;
}

export function getApprovalByRequestId(requestId: string) {
  const db = getDb();
  const approval = db
    .prepare(
      "SELECT * FROM approvals WHERE request_id = ? ORDER BY sent_at DESC LIMIT 1",
    )
    .get(requestId) as
    | {
        id: string;
        request_id: string;
        patient_id: string;
        token: string;
        method: "push" | "email";
        status: string;
        sent_at: string;
        decided_at: string | null;
        expires_at: string;
      }
    | undefined;

  if (
    approval &&
    approval.status === "pending" &&
    isExpired(approval.expires_at)
  ) {
    updateApprovalStatus(approval.token, "expired");
    updateAccessRequest(requestId, {
      status: "expired",
      decision: "denied",
      justification:
        "The patient approval window expired before a decision was received. No data was released.",
      fieldsReleased: [],
    });

    return {
      ...approval,
      status: "expired",
      decided_at: nowIso(),
    };
  }

  return approval;
}

export function updateApprovalStatus(
  token: string,
  status: "approved" | "denied" | "expired",
) {
  const db = getDb();
  db.prepare(
    `
    UPDATE approvals
    SET status = @status, decided_at = @decidedAt
    WHERE token = @token
  `,
  ).run({
    token,
    status,
    decidedAt: nowIso(),
  });
}

export function deleteApprovalById(approvalId: string) {
  const db = getDb();
  db.prepare("DELETE FROM approvals WHERE id = ?").run(approvalId);
}

export function listPendingApprovalsByPatient(patientId: string) {
  const db = getDb();
  const staleRows = db
    .prepare(
      `
      SELECT token, request_id
      FROM approvals
      WHERE patient_id = ? AND status = 'pending' AND expires_at <= ?
    `,
    )
    .all(patientId, nowIso()) as { token: string; request_id: string }[];

  for (const staleRow of staleRows) {
    updateApprovalStatus(staleRow.token, "expired");
    updateAccessRequest(staleRow.request_id, {
      status: "expired",
      decision: "denied",
      justification:
        "The patient approval window expired before a decision was received. No data was released.",
      fieldsReleased: [],
    });
  }

  const rows = db
    .prepare(
      `
      SELECT a.*, r.requester_label, r.issuer_label, r.natural_language_request
      FROM approvals a
      JOIN access_requests r ON r.id = a.request_id
      WHERE a.patient_id = ? AND a.status = 'pending'
      ORDER BY a.sent_at DESC
    `,
    )
    .all(patientId) as {
    id: string;
    request_id: string;
    token: string;
    method: "push" | "email";
    status: string;
    sent_at: string;
    expires_at: string;
    requester_label: string | null;
    issuer_label: string | null;
    natural_language_request: string;
  }[];
  return rows.map((row) => ({
    approvalId: row.id,
    requestId: row.request_id,
    token: row.token,
    method: row.method,
    status: row.status,
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
    requesterLabel: row.requester_label,
    issuerLabel: row.issuer_label,
    naturalLanguageRequest: row.natural_language_request,
  }));
}

export function saveAgentTrace(trace: AgentTrace) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO agent_traces (request_id, patient_id, requester_id, trace_json, updated_at)
    VALUES (@requestId, @patientId, @requesterId, @traceJson, @updatedAt)
    ON CONFLICT(request_id) DO UPDATE SET
      trace_json = excluded.trace_json,
      updated_at = excluded.updated_at
  `,
  ).run({
    requestId: trace.requestId,
    patientId: trace.patientId,
    requesterId: trace.requesterId,
    traceJson: JSON.stringify(trace),
    updatedAt: nowIso(),
  });
}

export function getAgentTrace(requestId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT trace_json FROM agent_traces WHERE request_id = ?")
    .get(requestId) as { trace_json: string } | undefined;
  return row ? (JSON.parse(row.trace_json) as AgentTrace) : null;
}

export function createSession(input: {
  id: string;
  requestId: string;
  patientId: string;
  requesterId: string;
  tier: number;
  jwt: string;
  expiresAt: string;
  fieldsAllowed: string[];
  summarySubset: Record<string, unknown>;
  translatedSummary: Record<string, unknown>;
  glossary: { original: string; translated: string }[];
  brief: string;
}) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO sessions (
      id, request_id, patient_id, requester_id, tier, jwt, expires_at,
      fields_allowed_json, encrypted_summary, encrypted_translated_summary,
      glossary_json, brief, created_at
    ) VALUES (
      @id, @requestId, @patientId, @requesterId, @tier, @jwt, @expiresAt,
      @fieldsAllowedJson, @encryptedSummary, @encryptedTranslatedSummary,
      @glossaryJson, @brief, @createdAt
    )
  `,
  ).run({
    id: input.id,
    requestId: input.requestId,
    patientId: input.patientId,
    requesterId: input.requesterId,
    tier: input.tier,
    jwt: input.jwt,
    expiresAt: input.expiresAt,
    fieldsAllowedJson: JSON.stringify(input.fieldsAllowed),
    encryptedSummary: encryptJson(input.summarySubset),
    encryptedTranslatedSummary: encryptJson(input.translatedSummary),
    glossaryJson: JSON.stringify(input.glossary),
    brief: input.brief,
    createdAt: nowIso(),
  });
}

export function updateSessionAudit(
  sessionId: string,
  audit: {
    chainRef: string | null;
    chainSequence: number | null;
    chainTimestamp: string | null;
  },
) {
  const db = getDb();
  db.prepare(
    `
    UPDATE sessions
    SET chain_ref = @chainRef,
        chain_sequence = @chainSequence,
        chain_timestamp = @chainTimestamp
    WHERE id = @sessionId
  `,
  ).run({
    sessionId,
    chainRef: audit.chainRef,
    chainSequence: audit.chainSequence,
    chainTimestamp: audit.chainTimestamp,
  });
}

export function deleteSession(sessionId: string) {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function getSession(sessionId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as SessionRow | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    fieldsAllowed: parseJson<string[]>(row.fields_allowed_json, []),
    summarySubset: decryptJson<Record<string, unknown>>(row.encrypted_summary),
    translatedSummary: decryptJson<Record<string, unknown>>(
      row.encrypted_translated_summary,
    ),
    glossary: parseJson<{ original: string; translated: string }[]>(
      row.glossary_json,
      [],
    ),
  };
}

export function getSessionByRequestId(requestId: string) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM sessions WHERE request_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(requestId) as SessionRow | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    fieldsAllowed: parseJson<string[]>(row.fields_allowed_json, []),
    summarySubset: decryptJson<Record<string, unknown>>(row.encrypted_summary),
    translatedSummary: decryptJson<Record<string, unknown>>(
      row.encrypted_translated_summary,
    ),
    glossary: parseJson<{ original: string; translated: string }[]>(
      row.glossary_json,
      [],
    ),
  };
}

export function listSessions() {
  const db = getDb();
  return db
    .prepare("SELECT * FROM sessions ORDER BY created_at DESC")
    .all() as SessionRow[];
}

export function listAccessRequests() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM access_requests ORDER BY created_at DESC")
    .all() as AccessRequestRow[];
  return rows.map((row) => ({
    ...row,
    emergency_mode: bool(row.emergency_mode),
    fields_allowed: parseJson<string[]>(row.fields_allowed_json, []),
    fields_released: parseJson<string[]>(row.fields_released_json, []),
  }));
}

export function createAuditEvent(input: {
  id: string;
  requestId: string;
  patientId: string;
  eventType: AuditEventType;
  decision: "allow" | "deny" | null;
  doctorHash: string;
  patientHash: string;
  jurisdiction: string;
  tokenExpiry: string | null;
  payload: AuditEvent;
  chainRef: string;
  chainSequence: number | null;
  chainTimestamp: string | null;
}) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO audit_events (
      id, request_id, patient_id, event_type, decision, doctor_hash, patient_hash,
      jurisdiction, token_expiry, payload_json, chain_ref, chain_sequence,
      chain_timestamp, created_at
    ) VALUES (
      @id, @requestId, @patientId, @eventType, @decision, @doctorHash, @patientHash,
      @jurisdiction, @tokenExpiry, @payloadJson, @chainRef, @chainSequence,
      @chainTimestamp, @createdAt
    )
  `,
  ).run({
    id: input.id,
    requestId: input.requestId,
    patientId: input.patientId,
    eventType: input.eventType,
    decision: input.decision,
    doctorHash: input.doctorHash,
    patientHash: input.patientHash,
    jurisdiction: input.jurisdiction,
    tokenExpiry: input.tokenExpiry,
    payloadJson: JSON.stringify(input.payload),
    chainRef: input.chainRef,
    chainSequence: input.chainSequence,
    chainTimestamp: input.chainTimestamp,
    createdAt: nowIso(),
  });
}

export function getAuditEventByChainRef(chainRef: string) {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM audit_events WHERE chain_ref = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(chainRef) as AuditEventRow | undefined;
}

export function getAuditEventByRequestAndType(
  requestId: string,
  eventType: AuditEventType,
) {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM audit_events WHERE request_id = ? AND event_type = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(requestId, eventType) as AuditEventRow | undefined;
}

export function getPendingAuditEventByKey(idempotencyKey: string) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM pending_audit_events WHERE idempotency_key = ? LIMIT 1",
    )
    .get(idempotencyKey) as PendingAuditEventRow | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    requestId: row.request_id,
    patientId: row.patient_id,
    payload: parseJson<AuditEvent>(row.payload_json, {
      event_type: "access_decision",
      request_id: row.request_id,
      doctor_hash: "unknown",
      patient_hash: "unknown",
      jurisdiction: "unknown",
      decision: null,
      token_expiry: null,
      timestamp: row.updated_at,
    }),
    status: row.status,
    chainRef: row.chain_ref,
    chainSequence: row.chain_sequence,
    chainTimestamp: row.chain_timestamp,
    error: row.error,
    lastAttemptAt: row.last_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function upsertPendingAuditEvent(input: {
  idempotencyKey: string;
  requestId: string;
  patientId: string;
  payload: AuditEvent;
  status: "pending" | "onchain_submitted" | "persisted" | "failed";
  chainRef?: string | null;
  chainSequence?: number | null;
  chainTimestamp?: string | null;
  error?: string | null;
}) {
  const db = getDb();
  const timestamp = nowIso();

  db.prepare(
    `
    INSERT INTO pending_audit_events (
      id,
      idempotency_key,
      request_id,
      patient_id,
      payload_json,
      status,
      chain_ref,
      chain_sequence,
      chain_timestamp,
      error,
      last_attempt_at,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @idempotencyKey,
      @requestId,
      @patientId,
      @payloadJson,
      @status,
      @chainRef,
      @chainSequence,
      @chainTimestamp,
      @error,
      @lastAttemptAt,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(idempotency_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      status = CASE
        WHEN (
          CASE excluded.status
            WHEN 'pending' THEN 1
            WHEN 'onchain_submitted' THEN 2
            WHEN 'failed' THEN 3
            WHEN 'persisted' THEN 4
            ELSE 0
          END
        ) > (
          CASE pending_audit_events.status
            WHEN 'pending' THEN 1
            WHEN 'onchain_submitted' THEN 2
            WHEN 'failed' THEN 3
            WHEN 'persisted' THEN 4
            ELSE 0
          END
        ) THEN excluded.status
        ELSE pending_audit_events.status
      END,
      chain_ref = COALESCE(excluded.chain_ref, pending_audit_events.chain_ref),
      chain_sequence = COALESCE(excluded.chain_sequence, pending_audit_events.chain_sequence),
      chain_timestamp = COALESCE(excluded.chain_timestamp, pending_audit_events.chain_timestamp),
      error = excluded.error,
      last_attempt_at = excluded.last_attempt_at,
      updated_at = excluded.updated_at
  `,
  ).run({
    id: crypto.randomUUID(),
    idempotencyKey: input.idempotencyKey,
    requestId: input.requestId,
    patientId: input.patientId,
    payloadJson: JSON.stringify(input.payload),
    status: input.status,
    chainRef: input.chainRef ?? null,
    chainSequence: input.chainSequence ?? null,
    chainTimestamp: input.chainTimestamp ?? null,
    error: input.error ?? null,
    lastAttemptAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return getPendingAuditEventByKey(input.idempotencyKey);
}

export function listAuditEvents(patientId: string) {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM audit_events WHERE patient_id = ? ORDER BY created_at DESC",
    )
    .all(patientId) as AuditEventRow[];

  return rows.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    patientId: row.patient_id,
    eventType: row.event_type as AuditEventType,
    decision: row.decision as "allow" | "deny" | null,
    doctorHash: row.doctor_hash,
    patientHash: row.patient_hash,
    jurisdiction: row.jurisdiction,
    tokenExpiry: row.token_expiry,
    payload: parseJson<AuditEvent | null>(row.payload_json, null) as AuditEvent,
    chainRef: row.chain_ref,
    chainSequence: row.chain_sequence,
    chainTimestamp: row.chain_timestamp ?? row.created_at,
    createdAt: row.created_at,
  }));
}

export function getDocumentForPatient(patientId: string, documentId: string) {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM patient_documents WHERE patient_id = ? AND id = ? LIMIT 1",
    )
    .get(patientId, documentId) as DocumentRow | undefined;
}

export type ImessageOnboardingStage =
  | "new"
  | "awaiting_name_dob"
  | "awaiting_ready_yes_no"
  | "awaiting_new_user_record"
  | "onboarded";

export interface ImessageUser {
  handle: string;
  stage: ImessageOnboardingStage;
  fullName: string | null;
  dob: string | null;
  patientId: string | null;
  onboardingRecordDraft: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

function mapImessageUserRow(row: ImessageUserRow): ImessageUser {
  return {
    handle: row.handle,
    stage: row.stage as ImessageOnboardingStage,
    fullName: row.full_name,
    dob: row.dob,
    patientId: row.patient_id,
    onboardingRecordDraft: row.onboarding_record_draft,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function getImessageUser(handle: string): ImessageUser | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM imessage_users WHERE handle = ?")
    .get(handle) as ImessageUserRow | undefined;
  return row ? mapImessageUserRow(row) : null;
}

export function touchImessageUser(handle: string): ImessageUser {
  const db = getDb();
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO imessage_users (
      handle, stage, full_name, dob, patient_id, onboarding_record_draft,
      created_at, updated_at, last_seen_at
    ) VALUES (
      @handle, 'new', NULL, NULL, NULL, NULL,
      @createdAt, @updatedAt, @lastSeenAt
    )
    ON CONFLICT(handle) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
  `,
  ).run({
    handle,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSeenAt: timestamp,
  });

  const user = getImessageUser(handle);
  if (!user) {
    throw new Error("Failed to touch iMessage user record");
  }
  return user;
}

export function updateImessageUser(
  handle: string,
  patch: Partial<{
    stage: ImessageOnboardingStage;
    fullName: string | null;
    dob: string | null;
    patientId: string | null;
    onboardingRecordDraft: string | null;
  }>,
): ImessageUser {
  const db = getDb();
  const fields: string[] = [];
  const values: Record<string, unknown> = {
    handle,
    updatedAt: nowIso(),
    lastSeenAt: nowIso(),
  };

  const mapping: Record<string, string> = {
    stage: "stage",
    fullName: "full_name",
    dob: "dob",
    patientId: "patient_id",
    onboardingRecordDraft: "onboarding_record_draft",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (key in patch) {
      fields.push(`${column} = @${key}`);
      values[key] = patch[key as keyof typeof patch];
    }
  }

  fields.push("updated_at = @updatedAt");
  fields.push("last_seen_at = @lastSeenAt");

  db.prepare(
    `UPDATE imessage_users SET ${fields.join(", ")} WHERE handle = @handle`,
  ).run(values);

  const user = getImessageUser(handle);
  if (!user) {
    throw new Error("Failed to update iMessage user record");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Shared Records
// ---------------------------------------------------------------------------

export type SharedRecordRow = {
  id: string;
  patient_id: string;
  doctor_name: string;
  doctor_email: string;
  doctor_hash: string;
  encrypted_summary: string;
  encrypted_share_key: string;
  fields_shared: string;
  access_token_hash: string;
  document_hash: string;
  share_scope: string | null;
  appointment_id: string | null;
  document_manifest_json: string | null;
  share_payload_version: string | null;
  status: string;
  expires_at: string;
  max_access_count: number;
  access_count: number;
  share_chain_ref: string | null;
  share_chain_slot: number | null;
  access_chain_ref: string | null;
  revoke_chain_ref: string | null;
  short_code: string | null;
  short_token: string | null;
  created_at: string;
  updated_at: string;
};

export function createSharedRecord(input: {
  id: string;
  patientId: string;
  doctorName: string;
  doctorEmail: string;
  doctorHash: string;
  encryptedSummary: string;
  encryptedShareKey: string;
  fieldsShared: string[];
  accessTokenHash: string;
  documentHash: string;
  shareScope?: "field_subset" | "full_record";
  appointmentId?: string | null;
  documentManifestJson?: string | null;
  sharePayloadVersion?: string;
  expiresAt: string;
  shareChainRef?: string;
  shareChainSlot?: number;
  shortCode?: string;
}) {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `INSERT INTO shared_records
     (id, patient_id, doctor_name, doctor_email, doctor_hash,
      encrypted_summary, encrypted_share_key, fields_shared,
      access_token_hash, document_hash, share_scope, appointment_id,
      document_manifest_json, share_payload_version, status, expires_at,
      share_chain_ref, share_chain_slot, short_code, created_at, updated_at)
     VALUES (@id, @patientId, @doctorName, @doctorEmail, @doctorHash,
      @encryptedSummary, @encryptedShareKey, @fieldsShared,
      @accessTokenHash, @documentHash, @shareScope, @appointmentId,
      @documentManifestJson, @sharePayloadVersion, 'active', @expiresAt,
      @shareChainRef, @shareChainSlot, @shortCode, @createdAt, @updatedAt)`,
  ).run({
    id: input.id,
    patientId: input.patientId,
    doctorName: input.doctorName,
    doctorEmail: input.doctorEmail,
    doctorHash: input.doctorHash,
    encryptedSummary: input.encryptedSummary,
    encryptedShareKey: input.encryptedShareKey,
    fieldsShared: JSON.stringify(input.fieldsShared),
    accessTokenHash: input.accessTokenHash,
    documentHash: input.documentHash,
    shareScope: input.shareScope ?? "field_subset",
    appointmentId: input.appointmentId ?? null,
    documentManifestJson: input.documentManifestJson ?? null,
    sharePayloadVersion: input.sharePayloadVersion ?? "1",
    expiresAt: input.expiresAt,
    shareChainRef: input.shareChainRef ?? null,
    shareChainSlot: input.shareChainSlot ?? null,
    shortCode: input.shortCode ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

export function getSharedRecordByShortCode(shortCode: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM shared_records WHERE short_code = ?")
    .get(shortCode) as (SharedRecordRow & { short_token?: string }) | undefined;
}

export function updateSharedRecordShortToken(shareId: string, shortToken: string) {
  const db = getDb();
  ensureColumn(db, "shared_records", "short_token", "TEXT");
  db.prepare("UPDATE shared_records SET short_token = ? WHERE id = ?").run(shortToken, shareId);
}

export function getSharedRecord(shareId: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM shared_records WHERE id = ?")
    .get(shareId) as SharedRecordRow | undefined;
}

export function listSharedRecords(patientId: string) {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM shared_records WHERE patient_id = ? ORDER BY created_at DESC",
    )
    .all(patientId) as SharedRecordRow[];
}

export function updateSharedRecordStatus(
  shareId: string,
  status: string,
  chainRef?: string,
) {
  const db = getDb();
  db.prepare(
    `UPDATE shared_records
     SET status = @status, revoke_chain_ref = COALESCE(@chainRef, revoke_chain_ref),
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: shareId,
    status,
    chainRef: chainRef ?? null,
    updatedAt: nowIso(),
  });
}

export function incrementSharedRecordAccess(
  shareId: string,
  accessChainRef?: string,
) {
  const db = getDb();
  db.prepare(
    `UPDATE shared_records
     SET access_count = access_count + 1,
         access_chain_ref = COALESCE(@chainRef, access_chain_ref),
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: shareId,
    chainRef: accessChainRef ?? null,
    updatedAt: nowIso(),
  });
}

// ---------------------------------------------------------------------------
// Message Events — correlation logging for iMessage pipeline
// ---------------------------------------------------------------------------

export function logMessageEvent(input: {
  messageId: string;
  handle: string;
  direction: "inbound" | "outbound";
  linkedRequestId?: string | null;
  linkedChainRef?: string | null;
  eventType: string;
  metadata?: Record<string, unknown> | null;
}) {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `
    INSERT INTO message_events (
      id, message_id, handle, direction, linked_request_id, linked_chain_ref,
      event_type, metadata_json, created_at
    ) VALUES (
      @id, @messageId, @handle, @direction, @linkedRequestId, @linkedChainRef,
      @eventType, @metadataJson, @createdAt
    )
  `,
  ).run({
    id,
    messageId: input.messageId,
    handle: input.handle,
    direction: input.direction,
    linkedRequestId: input.linkedRequestId ?? null,
    linkedChainRef: input.linkedChainRef ?? null,
    eventType: input.eventType,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    createdAt: nowIso(),
  });
  return id;
}

export function getClinicianHandleForRequest(
  requestId: string,
): { handle: string; chatGuid: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT clinician_handle, clinician_chat_guid FROM access_requests WHERE id = ?",
    )
    .get(requestId) as
    | { clinician_handle: string | null; clinician_chat_guid: string | null }
    | undefined;
  if (!row?.clinician_handle || !row?.clinician_chat_guid) return null;
  return { handle: row.clinician_handle, chatGuid: row.clinician_chat_guid };
}
