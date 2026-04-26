function isDebugEnabled(): boolean {
  const raw = (process.env.IMESSAGE_DEBUG ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

export function createDebugLogger(prefix: string) {
  return function debugLog(message: string, data?: unknown) {
    if (!isDebugEnabled()) return;
    if (data === undefined) {
      console.log(`[${prefix}] ${message}`);
      return;
    }
    console.log(`[${prefix}] ${message}`, data);
  };
}
