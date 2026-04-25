"use strict";

import { execFile } from "child_process";
import { promisify } from "util";

export interface BridgeAdapter {
  sendText(input: {
    chatGuid: string;
    text: string;
    tempGuid?: string;
  }): Promise<{ messageGuid: string; status: "sent" | "queued" | "failed"; error?: string }>;
  markChatRead(input: { chatGuid: string }): Promise<BridgeActionResult>;
  showTypingIndicator(input: { chatGuid: string }): Promise<BridgeActionResult>;
  isHealthy(): Promise<{ healthy: boolean; detail: string }>;
}

export type BridgeActionResult = {
  status: "ok" | "skipped" | "failed";
  detail?: string;
};

const BRIDGE_KIND_MACOS_LOCAL = "macos-local";
const execFileAsync = promisify(execFile);
type AppleScriptRunner = (
  script: string,
  args: string[],
  options: {
    encoding?: BufferEncoding;
    timeout: number;
    maxBuffer: number;
  },
) => Promise<{ stdout?: string | Buffer }>;

let appleScriptRunner: AppleScriptRunner = (script, args, options) =>
  execFileAsync("osascript", ["-e", script, ...args], options);

function parseHandleFromChatGuid(chatGuid: string): string {
  const raw = chatGuid.trim();
  if (!raw) return "";
  if (!raw.includes(";")) return raw;

  const segments = raw.split(";");
  const candidate = segments[segments.length - 1]?.trim();
  if (!candidate || candidate === "-" || !/[A-Za-z0-9]/.test(candidate)) {
    return "";
  }
  return candidate;
}

function buildImessageUrl(chatGuid: string): string {
  const handle = parseHandleFromChatGuid(chatGuid);
  return handle ? `imessage://${encodeURIComponent(handle)}` : "";
}

function isMacAutomationDisabled(): boolean {
  const raw = (process.env.IMESSAGE_DISABLE_UI_AUTOMATION ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

class MacOSLocalBridge implements BridgeAdapter {
  async sendText(input: {
    chatGuid: string;
    text: string;
    tempGuid?: string;
  }): Promise<{ messageGuid: string; status: "sent" | "queued" | "failed"; error?: string }> {
    if (process.platform !== "darwin") {
      return { messageGuid: "", status: "failed", error: "macOS local iMessage bridge requires darwin host" };
    }

    const handle = parseHandleFromChatGuid(input.chatGuid);
    if (!handle) {
      return { messageGuid: "", status: "failed", error: "invalid chatGuid: unable to resolve iMessage handle" };
    }

    const script = `
on run argv
  set targetHandle to item 1 of argv
  set outgoingMessage to item 2 of argv
  tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy targetHandle of targetService
    send outgoingMessage to targetBuddy
  end tell
end run
`;

    try {
      await execFileAsync(
        "osascript",
        ["-e", script, handle, input.text],
        { timeout: 5000, maxBuffer: 1024 * 32 },
      );
      return { messageGuid: input.tempGuid ?? crypto.randomUUID(), status: "sent" };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      const errorName = error?.name ?? "Error";
      const errorCode =
        typeof error?.code === "string" || typeof error?.code === "number"
          ? String(error.code)
          : "unknown";
      console.error("[MacOSLocalBridge] sendText failed", {
        errorName,
        errorCode,
      });
      return { messageGuid: "", status: "failed", error: "failed to send message" };
    }
  }

  async markChatRead(input: { chatGuid: string }): Promise<BridgeActionResult> {
    if (process.platform !== "darwin") {
      return { status: "skipped", detail: "macOS local iMessage bridge requires darwin host" };
    }
    if (isMacAutomationDisabled()) {
      return { status: "skipped", detail: "Messages UI automation disabled" };
    }

    const imessageUrl = buildImessageUrl(input.chatGuid);
    if (!imessageUrl) {
      return { status: "failed", detail: "invalid chatGuid: unable to resolve iMessage handle" };
    }

    const script = `
on run argv
  set targetUrl to item 1 of argv
  tell application "Messages" to activate
  open location targetUrl
end run
`;

    try {
      await appleScriptRunner(script, [imessageUrl], {
        timeout: 3000,
        maxBuffer: 1024 * 16,
      });
      return { status: "ok" };
    } catch (err) {
      console.error("[MacOSLocalBridge] markChatRead failed", toSafeErrorLog(err));
      return { status: "failed", detail: "failed to mark chat read" };
    }
  }

  async showTypingIndicator(input: { chatGuid: string }): Promise<BridgeActionResult> {
    if (process.platform !== "darwin") {
      return { status: "skipped", detail: "macOS local iMessage bridge requires darwin host" };
    }
    if (isMacAutomationDisabled()) {
      return { status: "skipped", detail: "Messages UI automation disabled" };
    }

    const imessageUrl = buildImessageUrl(input.chatGuid);
    if (!imessageUrl) {
      return { status: "failed", detail: "invalid chatGuid: unable to resolve iMessage handle" };
    }

    const script = `
on run argv
  set targetUrl to item 1 of argv
  tell application "Messages" to activate
  open location targetUrl
  delay 0.2
  tell application "System Events"
    tell process "Messages"
      if my composerHasText() then
        return "skipped_non_empty_composer"
      end if
      keystroke space
      delay 0.2
      key code 51
      return "ok"
    end tell
  end tell
end run

on composerHasText()
  tell application "System Events"
    tell process "Messages"
      set focusedText to ""
      try
        set focusedText to value of focused UI element as text
      end try
      if focusedText is not "" then return true

      try
        set candidateTextAreas to every text area of window 1
        repeat with candidate in candidateTextAreas
          set candidateValue to value of candidate as text
          if candidateValue is not "" then return true
        end repeat
      end try
    end tell
  end tell
  return false
end composerHasText
`;

    try {
      const { stdout } = await appleScriptRunner(script, [imessageUrl], {
        timeout: 3000,
        maxBuffer: 1024 * 16,
      });
      const output = typeof stdout === "string" ? stdout.trim() : "";
      if (output === "skipped_non_empty_composer") {
        return { status: "skipped", detail: "Messages composer already has draft text" };
      }
      return { status: "ok" };
    } catch (err) {
      console.error("[MacOSLocalBridge] showTypingIndicator failed", toSafeErrorLog(err));
      return { status: "failed", detail: "failed to show typing indicator" };
    }
  }

  async isHealthy(): Promise<{ healthy: boolean; detail: string }> {
    if (process.platform !== "darwin") {
      return { healthy: false, detail: "macOS local iMessage bridge requires darwin host" };
    }

    const script = `
tell application "Messages"
  set _svc to 1st service whose service type = iMessage
  return "ok"
end tell
    `;

    try {
      const { stdout } = await execFileAsync(
        "osascript",
        ["-e", script],
        { encoding: "utf8", timeout: 3000, maxBuffer: 1024 * 32 },
      );
      const output = typeof stdout === "string" ? stdout : String(stdout);
      if (output.trim().toLowerCase() !== "ok") {
        return { healthy: false, detail: `unexpected Messages check output: ${output.trim()}` };
      }
      return { healthy: true, detail: "Messages.app iMessage service reachable" };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      const code =
        typeof error?.code === "string" || typeof error?.code === "number"
          ? ` (${String(error.code)})`
          : "";
      return { healthy: false, detail: `Messages check failed${code}` };
    }
  }
}

function toSafeErrorLog(err: unknown): Record<string, string> {
  const error = err as NodeJS.ErrnoException;
  const errorName = error?.name ?? "Error";
  const errorCode =
    typeof error?.code === "string" || typeof error?.code === "number"
      ? String(error.code)
      : "unknown";
  return { errorName, errorCode };
}

let bridgeInstance: BridgeAdapter | null = null;

function buildMacOSLocalBridge(): MacOSLocalBridge {
  const kind = (process.env.IMESSAGE_BRIDGE_KIND ?? BRIDGE_KIND_MACOS_LOCAL).trim().toLowerCase();
  if (kind !== BRIDGE_KIND_MACOS_LOCAL) {
    throw new Error(
      `[iMessage bridge] Unsupported IMESSAGE_BRIDGE_KIND="${kind}". BlueBubbles and mock bridge are disabled; use "macos-local".`,
    );
  }

  return new MacOSLocalBridge();
}

export function getBridge(): BridgeAdapter {
  if (bridgeInstance) {
    return bridgeInstance;
  }

  bridgeInstance = buildMacOSLocalBridge();

  return bridgeInstance;
}

export function __setAppleScriptRunnerForTests(
  runner: AppleScriptRunner | null,
) {
  appleScriptRunner =
    runner ??
    ((script, args, options) =>
      execFileAsync("osascript", ["-e", script, ...args], options));
}
