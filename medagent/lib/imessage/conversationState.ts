"use strict";

import { getDb } from "@/lib/db";

export interface ConversationState {
  handle: string;
  identityId: string;
  identityKind: "clinician" | "patient";
  activeRequestId: string | null;
  awaiting: string | null;
  lastMessageAt: string;
  metadata: Record<string, unknown>;
}

type ConversationRow = {
  handle: string;
  identity_id: string;
  identity_kind: string;
  active_request_id: string | null;
  awaiting: string | null;
  last_message_at: string;
  metadata_json: string | null;
};

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function loadConversation(handle: string): ConversationState | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM imessage_conversations WHERE handle = ?")
    .get(handle) as ConversationRow | undefined;
  if (!row) return null;
  return {
    handle: row.handle,
    identityId: row.identity_id,
    identityKind: row.identity_kind as "clinician" | "patient",
    activeRequestId: row.active_request_id,
    awaiting: row.awaiting,
    lastMessageAt: row.last_message_at,
    metadata: parseMetadata(row.metadata_json),
  };
}

export function saveConversation(state: ConversationState): void {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO imessage_conversations (
      handle, identity_id, identity_kind, active_request_id, awaiting,
      last_message_at, metadata_json
    ) VALUES (
      @handle, @identityId, @identityKind, @activeRequestId, @awaiting,
      @lastMessageAt, @metadataJson
    )
    ON CONFLICT(handle) DO UPDATE SET
      identity_id = excluded.identity_id,
      identity_kind = excluded.identity_kind,
      active_request_id = excluded.active_request_id,
      awaiting = excluded.awaiting,
      last_message_at = excluded.last_message_at,
      metadata_json = excluded.metadata_json
    `,
  ).run({
    handle: state.handle,
    identityId: state.identityId,
    identityKind: state.identityKind,
    activeRequestId: state.activeRequestId,
    awaiting: state.awaiting,
    lastMessageAt: state.lastMessageAt,
    metadataJson: JSON.stringify(state.metadata),
  });
}

export function clearActiveRequest(handle: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE imessage_conversations SET active_request_id = NULL, awaiting = NULL WHERE handle = ?",
  ).run(handle);
}
