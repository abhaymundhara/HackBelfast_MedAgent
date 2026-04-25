const DEFAULT_WORKFLOW_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIEVAL_RETRIES = 2;
const MAX_ALLOWED_RETRIES = 6;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getWorkflowTimeoutMs() {
  if (process.env.NODE_ENV === "test") {
    return parsePositiveInteger(
      process.env.MEDAGENT_REQUEST_TIMEOUT_MS,
      30_000,
    );
  }

  return parsePositiveInteger(
    process.env.MEDAGENT_REQUEST_TIMEOUT_MS,
    DEFAULT_WORKFLOW_TIMEOUT_MS,
  );
}

export function getMaxRetrievalRetries() {
  const configured = parsePositiveInteger(
    process.env.MEDAGENT_MAX_RETRIEVAL_RETRIES,
    DEFAULT_MAX_RETRIEVAL_RETRIES,
  );
  return Math.min(configured, MAX_ALLOWED_RETRIES);
}
