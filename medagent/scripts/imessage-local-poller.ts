import fs from "fs";
import os from "os";
import path from "path";

import Database from "better-sqlite3";
import { config } from "dotenv";
import { listHandleMappings } from "@/lib/imessage/handles";

config({ path: ".env.local" });
config();

type PollerState = {
  lastRowId: number;
};

type MessageRow = {
  rowid: number;
  message_guid: string;
  text: string | null;
  is_from_me: number;
  handle: string;
  service: string;
  chat_guid: string;
};

type AttachmentRow = {
  guid: string;
  filename: string;
  transfer_name: string;
  mime_type: string;
  uti: string;
  total_bytes: number | null;
};

const DEFAULT_STATE_PATH = path.join(
  process.cwd(),
  "data",
  "imessage-poller-state.json",
);
const DEFAULT_CHAT_DB_PATH = path.join(
  os.homedir(),
  "Library",
  "Messages",
  "chat.db",
);
const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_BOOTSTRAP_MODE = "latest";
const DEFAULT_SKIP_HISTORY_ON_START = true;
const WEBHOOK_TIMEOUT_MS = 30_000;

function readState(statePath: string): PollerState {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PollerState>;
    return { lastRowId: Number(parsed.lastRowId ?? 0) };
  } catch {
    return { lastRowId: 0 };
  }
}

function writeState(statePath: string, state: PollerState) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
  if (["0", "false", "no", "n", "off"].includes(raw)) return false;
  return fallback;
}

function isDebugEnabled(): boolean {
  return readBool("IMESSAGE_DEBUG", false);
}

function debugLog(message: string, data?: unknown) {
  if (!isDebugEnabled()) return;
  if (data === undefined) {
    console.log(`[imessage-poller:debug] ${message}`);
    return;
  }
  console.log(`[imessage-poller:debug] ${message}`, data);
}

function buildAllowedHandles(): Set<string> {
  const configured = process.env.IMESSAGE_POLLER_ALLOWED_HANDLES
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    if (configured.includes("*") || configured.includes("all")) {
      return new Set();
    }
    return new Set(configured);
  }

  return new Set(listHandleMappings().map((m) => m.handle));
}

let attachmentQuery: Database.Statement | null = null;

function normalizeAttachmentPath(filename: string) {
  if (!filename) return "";
  if (filename.startsWith("~/")) {
    return path.join(os.homedir(), filename.slice(2));
  }
  return filename;
}

function readMessageAttachments(messageRowId: number) {
  if (!attachmentQuery) return [];

  const rows = attachmentQuery.all(messageRowId) as AttachmentRow[];
  return rows.map((attachment) => ({
    guid: attachment.guid || undefined,
    filename: attachment.filename || attachment.transfer_name || undefined,
    path: normalizeAttachmentPath(attachment.filename),
    mimeType: attachment.mime_type || undefined,
    uti: attachment.uti || undefined,
    transferName: attachment.transfer_name || undefined,
    totalBytes:
      typeof attachment.total_bytes === "number"
        ? attachment.total_bytes
        : undefined,
  }));
}

async function forwardMessage(
  appBaseUrl: string,
  secret: string | undefined,
  row: MessageRow,
) {
  const webhookUrl = `${appBaseUrl.replace(/\/+$/, "")}/api/imessage/webhook`;

  const payload = {
    type: "new-message",
    data: {
      guid: row.message_guid,
      text: row.text ?? "",
      handle: { address: row.handle },
      chats: [{ guid: row.chat_guid }],
      isFromMe: row.is_from_me === 1,
      // Keep this fresh so inbound age filter accepts the event.
      dateCreated: Date.now(),
      attachments: readMessageAttachments(row.rowid),
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) headers["x-webhook-secret"] = secret;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    WEBHOOK_TIMEOUT_MS,
  );
  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Webhook POST timed out after 30s");
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Webhook POST failed (${response.status}): ${body}`);
  }
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("imessage-local-poller requires macOS (darwin).");
  }

  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  const secret = process.env.IMESSAGE_WEBHOOK_SECRET?.trim();
  const statePath =
    process.env.IMESSAGE_POLLER_STATE_PATH?.trim() || DEFAULT_STATE_PATH;
  const chatDbPath =
    process.env.IMESSAGE_CHAT_DB_PATH?.trim() || DEFAULT_CHAT_DB_PATH;
  const intervalMs = Number(
    process.env.IMESSAGE_POLLER_INTERVAL_MS ?? DEFAULT_INTERVAL_MS,
  );
  const batchSize = Number(
    process.env.IMESSAGE_POLLER_BATCH_SIZE ?? DEFAULT_BATCH_SIZE,
  );
  const bootstrapMode = (
    process.env.IMESSAGE_POLLER_BOOTSTRAP ?? DEFAULT_BOOTSTRAP_MODE
  )
    .trim()
    .toLowerCase();
  const skipHistoryOnStart = readBool(
    "IMESSAGE_POLLER_SKIP_HISTORY_ON_START",
    DEFAULT_SKIP_HISTORY_ON_START,
  );
  const onlyIMessageService = readBool(
    "IMESSAGE_POLLER_ONLY_IMESSAGE_SERVICE",
    true,
  );
  const allowedHandles = buildAllowedHandles();
  const bridgeKind = (process.env.IMESSAGE_BRIDGE_KIND ?? "")
    .trim()
    .toLowerCase();

  if (bridgeKind !== "macos-local") {
    throw new Error(
      `IMESSAGE_BRIDGE_KIND must be "macos-local" for local poller (received "${bridgeKind || "(empty)"}").`,
    );
  }

  if (!fs.existsSync(chatDbPath)) {
    throw new Error(`Messages chat DB not found at ${chatDbPath}`);
  }
  requireEnv("IMESSAGE_BRIDGE_KIND");

  const db = new Database(chatDbPath, { readonly: true });
  const maxRowStmt = db.prepare(
    `SELECT COALESCE(MAX(ROWID), 0) AS maxRowId FROM message`,
  );

  const query = db.prepare(
    `
    SELECT
      m.ROWID AS rowid,
      COALESCE(m.guid, 'local-' || m.ROWID) AS message_guid,
      m.text AS text,
      m.is_from_me AS is_from_me,
      COALESCE(h.id, '') AS handle,
      COALESCE(h.service, '') AS service,
      COALESCE(MIN(c.guid), 'iMessage;-;' || COALESCE(h.id, '')) AS chat_guid
    FROM message m
    LEFT JOIN handle h ON h.ROWID = m.handle_id
    LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
    LEFT JOIN chat c ON c.ROWID = cmj.chat_id
    WHERE m.ROWID > @afterRowId
      AND m.is_from_me = 0
      AND (
        (m.text IS NOT NULL AND m.text != '')
        OR m.cache_has_attachments = 1
      )
    GROUP BY m.ROWID
    ORDER BY m.ROWID ASC
    LIMIT @limit
    `,
  );

  attachmentQuery = db.prepare(
    `
    SELECT
      COALESCE(a.guid, '') AS guid,
      COALESCE(a.filename, '') AS filename,
      COALESCE(a.transfer_name, '') AS transfer_name,
      COALESCE(a.mime_type, '') AS mime_type,
      COALESCE(a.uti, '') AS uti,
      a.total_bytes AS total_bytes
    FROM message_attachment_join maj
    JOIN attachment a ON a.ROWID = maj.attachment_id
    WHERE maj.message_id = ?
    ORDER BY a.ROWID ASC
    `,
  );

  const stateFileExists = fs.existsSync(statePath);
  const state = readState(statePath);
  const row = maxRowStmt.get() as { maxRowId: number };
  const currentMaxRowId = Number(row.maxRowId ?? 0);

  // Default behavior is strict live-tail mode: every startup skips history
  // and starts from the current highest row ID in chat.db.
  if (skipHistoryOnStart) {
    state.lastRowId = currentMaxRowId;
    writeState(statePath, state);
    console.log(
      `[imessage-poller] tail-on-start enabled; starting at rowid=${state.lastRowId}`,
    );
  } else if (
    (state.lastRowId <= 0 || !stateFileExists) &&
    bootstrapMode !== "backfill"
  ) {
    state.lastRowId = currentMaxRowId;
    writeState(statePath, state);
    console.log(
      `[imessage-poller] bootstrapped to latest rowid=${state.lastRowId} (mode=${bootstrapMode})`,
    );
  }

  console.log(
    `[imessage-poller] starting | db=${chatDbPath} | state=${statePath} | afterRowId=${state.lastRowId}`,
  );
  if (allowedHandles.size > 0) {
    console.log(
      `[imessage-poller] handle filter active (${allowedHandles.size} handles)`,
    );
  } else {
    console.log("[imessage-poller] handle filter disabled (all senders allowed)");
  }

  let shutdownRequested = false;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    writeState(statePath, state);
    db.close();
  };

  const requestShutdown = (signal: string) => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    console.log(`[imessage-poller] received ${signal}, shutting down...`);
  };

  process.on("SIGINT", () => requestShutdown("SIGINT"));
  process.on("SIGTERM", () => requestShutdown("SIGTERM"));

  try {
    while (!shutdownRequested) {
      const rows = query.all({
        afterRowId: state.lastRowId,
        limit: batchSize,
      }) as MessageRow[];

      for (const row of rows) {
        if (shutdownRequested) break;

        // Messages with no handle/chat are ignored to avoid malformed webhook payloads.
        if (!row.handle && !row.chat_guid) {
          debugLog("skip row: missing handle/chat", { rowid: row.rowid });
          state.lastRowId = row.rowid;
          writeState(statePath, state);
          continue;
        }
        if (onlyIMessageService && row.service.toLowerCase() !== "imessage") {
          debugLog("skip row: non-iMessage service", {
            rowid: row.rowid,
            service: row.service,
            handle: row.handle,
          });
          state.lastRowId = row.rowid;
          writeState(statePath, state);
          continue;
        }
        if (allowedHandles.size > 0 && !allowedHandles.has(row.handle)) {
          debugLog("skip row: handle not allowlisted", {
            rowid: row.rowid,
            handle: row.handle,
          });
          state.lastRowId = row.rowid;
          writeState(statePath, state);
          continue;
        }

        try {
          await forwardMessage(appBaseUrl, secret, row);
          state.lastRowId = row.rowid;
          writeState(statePath, state);
          console.log(
            `[imessage-poller] forwarded row=${row.rowid} fromMe=${row.is_from_me === 1} handle=${row.handle}`,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            `[imessage-poller] forward failed row=${row.rowid}; will retry: ${message}`,
          );
          break;
        }
      }

      if (shutdownRequested) break;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error("[imessage-poller] fatal:", err);
  process.exit(1);
});
