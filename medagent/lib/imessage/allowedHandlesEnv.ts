import fs from "fs";
import path from "path";

const ALLOWED_HANDLES_KEY = "IMESSAGE_POLLER_ALLOWED_HANDLES";

function getAllowedHandlesEnvPath() {
  return (
    process.env.IMESSAGE_POLLER_ENV_PATH?.trim() ||
    path.join(process.cwd(), ".env.local")
  );
}

export function parseAllowedHandles(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((handle) => handle.trim())
    .filter(Boolean);
}

function isWildcardAllowed(handles: string[]) {
  return handles.some((handle) => {
    const normalized = handle.toLowerCase();
    return normalized === "*" || normalized === "all";
  });
}

export function appendAllowedImessageHandle(
  handle: string,
  envPath = getAllowedHandlesEnvPath(),
  fallbackHandles: string[] = [],
): { added: boolean; handles: string[]; envPath: string; reason?: string } {
  const normalizedHandle = handle.trim();
  if (!normalizedHandle) {
    return { added: false, handles: [], envPath, reason: "empty-handle" };
  }

  const existingFile = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";
  const linePattern = new RegExp(
    `^(\\s*(?:export\\s+)?${ALLOWED_HANDLES_KEY}\\s*=\\s*)(.*)$`,
    "m",
  );
  const match = existingFile.match(linePattern);
  const currentValue =
    match?.[2] ??
    process.env[ALLOWED_HANDLES_KEY] ??
    fallbackHandles.join(",");
  const handles = parseAllowedHandles(currentValue);

  if (isWildcardAllowed(handles)) {
    return {
      added: false,
      handles,
      envPath,
      reason: "wildcard-allows-all",
    };
  }

  if (handles.includes(normalizedHandle)) {
    return {
      added: false,
      handles,
      envPath,
      reason: "already-present",
    };
  }

  const nextHandles = [...handles, normalizedHandle];
  const nextValue = nextHandles.join(",");
  const nextContent = match
    ? existingFile.replace(linePattern, `$1${nextValue}`)
    : `${existingFile}${existingFile && !existingFile.endsWith("\n") ? "\n" : ""}${ALLOWED_HANDLES_KEY}=${nextValue}\n`;

  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, nextContent);
  process.env[ALLOWED_HANDLES_KEY] = nextValue;

  return { added: true, handles: nextHandles, envPath };
}
