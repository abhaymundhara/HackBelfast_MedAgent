const LOCAL_APP_BASE_URL = "http://localhost:3000";

const PUBLIC_URL_ENV_KEYS = [
  "NGROK_PUBLIC_URL",
  "NGROK_URL",
  "PUBLIC_APP_BASE_URL",
  "NEXT_PUBLIC_APP_BASE_URL",
  "APP_BASE_URL",
] as const;

function normalizeAppBaseUrl(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function isLocalAppBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

export function getAppBaseUrl() {
  for (const key of PUBLIC_URL_ENV_KEYS) {
    const normalized = normalizeAppBaseUrl(process.env[key]);
    if (normalized) {
      return normalized;
    }
  }
  return LOCAL_APP_BASE_URL;
}

export function getPublicAppBaseUrl() {
  const baseUrl = getAppBaseUrl();
  if (isLocalAppBaseUrl(baseUrl)) {
    console.warn(
      "APP_BASE_URL is local; run `npm run dev:tunnel` or set NGROK_PUBLIC_URL to generate globally reachable links.",
    );
  }
  return baseUrl;
}
