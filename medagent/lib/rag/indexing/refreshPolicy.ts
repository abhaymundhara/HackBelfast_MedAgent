const DEFAULT_INDEX_STALE_AFTER_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_FRESH_TTL_MS = 30 * 1000;
const DEFAULT_CACHE_STALE_TTL_MS = 3 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 500;

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function isBackgroundIndexingEnabled() {
  return parseBoolean(process.env.MEDAGENT_ENABLE_BACKGROUND_INDEXING, true);
}

export function getIndexStaleAfterMs() {
  return parsePositiveInt(
    process.env.MEDAGENT_INDEX_STALE_AFTER_MS,
    DEFAULT_INDEX_STALE_AFTER_MS,
  );
}

export function getCacheFreshTtlMs() {
  return parsePositiveInt(
    process.env.MEDAGENT_CACHE_FRESH_TTL_MS,
    DEFAULT_CACHE_FRESH_TTL_MS,
  );
}

export function getCacheStaleTtlMs() {
  return parsePositiveInt(
    process.env.MEDAGENT_CACHE_STALE_TTL_MS,
    DEFAULT_CACHE_STALE_TTL_MS,
  );
}

export function getCacheMaxEntries() {
  return parsePositiveInt(
    process.env.MEDAGENT_CACHE_MAX_ENTRIES,
    DEFAULT_CACHE_MAX_ENTRIES,
  );
}

export function isStaleWhileRevalidateEnabled() {
  return parseBoolean(process.env.MEDAGENT_ENABLE_STALE_WHILE_REVALIDATE, true);
}

export function getCacheTimingWindow(now = Date.now()) {
  const freshTtlMs = getCacheFreshTtlMs();
  const staleTtlMs = getCacheStaleTtlMs();
  const staleAt = now + freshTtlMs;
  const expiresAt = staleAt + staleTtlMs;

  return {
    now,
    freshTtlMs,
    staleTtlMs,
    staleAt,
    expiresAt,
  };
}
