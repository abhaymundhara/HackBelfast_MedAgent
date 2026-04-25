"use strict";

import { execFileSync } from "child_process";

export interface BridgeAdapter {
  sendText(input: {
    chatGuid: string;
    text: string;
    tempGuid?: string;
  }): Promise<{ messageGuid: string; status: "sent" | "queued" | "failed"; error?: string }>;
  isHealthy(): Promise<{ healthy: boolean; detail: string }>;
}

const BRIDGE_KIND_MACOS_LOCAL = "macos-local";

function parseHandleFromChatGuid(chatGuid: string): string {
  const raw = chatGuid.trim();
  if (!raw) return "";
  const segments = raw.split(";");
  const candidate = segments[segments.length - 1]?.trim();
  return candidate || raw;
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
      execFileSync(
        "osascript",
        ["-e", script, handle, input.text],
        { stdio: "pipe", timeout: 5000 },
      );
      return { messageGuid: input.tempGuid ?? crypto.randomUUID(), status: "sent" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[MacOSLocalBridge] sendText exception", message);
      return { messageGuid: "", status: "failed", error: message };
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
      const output = execFileSync(
        "osascript",
        ["-e", script],
        { encoding: "utf8", stdio: "pipe", timeout: 3000 },
      );
      if (output.trim().toLowerCase() !== "ok") {
        return { healthy: false, detail: `unexpected Messages check output: ${output.trim()}` };
      }
      return { healthy: true, detail: "Messages.app iMessage service reachable" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { healthy: false, detail: message };
    }
  }
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
