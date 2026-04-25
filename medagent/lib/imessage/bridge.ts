"use strict";

export interface BridgeAdapter {
  sendText(input: {
    chatGuid: string;
    text: string;
    tempGuid?: string;
  }): Promise<{ messageGuid: string; status: "sent" | "queued" | "failed"; error?: string }>;
  isHealthy(): Promise<{ healthy: boolean; detail: string }>;
}

class MockBridge implements BridgeAdapter {
  async sendText(input: {
    chatGuid: string;
    text: string;
    tempGuid?: string;
  }): Promise<{ messageGuid: string; status: "sent" | "queued" | "failed"; error?: string }> {
    const messageGuid = crypto.randomUUID();
    console.log("[MockBridge] sendText", { chatGuid: input.chatGuid, text: input.text, messageGuid });
    return { messageGuid, status: "sent" };
  }

  async isHealthy(): Promise<{ healthy: boolean; detail: string }> {
    return { healthy: true, detail: "mock bridge always healthy" };
  }
}

class BlueBubblesBridge implements BridgeAdapter {
  private readonly baseUrl: string;
  private readonly password: string;
  private readonly defaultMethod: string;

  constructor(baseUrl: string, password: string, defaultMethod: string) {
    this.baseUrl = baseUrl;
    this.password = password;
    this.defaultMethod = defaultMethod;
  }

  async sendText(input: {
    chatGuid: string;
    text: string;
    tempGuid?: string;
  }): Promise<{ messageGuid: string; status: "sent" | "queued" | "failed"; error?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/message/text?password=${this.password}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatGuid: input.chatGuid,
            tempGuid: input.tempGuid ?? crypto.randomUUID(),
            message: input.text,
            method: this.defaultMethod,
          }),
          signal: controller.signal,
        },
      );
      const json = (await response.json()) as { guid?: string; status?: number; error?: string };
      if (!response.ok) {
        const err = json.error ?? `HTTP ${response.status}`;
        console.error("[BlueBubblesBridge] sendText error", err);
        return { messageGuid: "", status: "failed", error: err };
      }
      return { messageGuid: json.guid ?? "", status: "sent" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[BlueBubblesBridge] sendText exception", message);
      return { messageGuid: "", status: "failed", error: message };
    } finally {
      clearTimeout(timer);
    }
  }

  async isHealthy(): Promise<{ healthy: boolean; detail: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/server/info?password=${this.password}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        return { healthy: false, detail: `HTTP ${response.status}` };
      }
      return { healthy: true, detail: "bluebubbles reachable" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { healthy: false, detail: message };
    } finally {
      clearTimeout(timer);
    }
  }
}

let bridgeInstance: BridgeAdapter | null = null;

export function getBridge(): BridgeAdapter {
  if (bridgeInstance) {
    return bridgeInstance;
  }

  const kind = process.env.IMESSAGE_BRIDGE_KIND ?? "mock";

  if (kind === "bluebubbles") {
    const baseUrl = process.env.IMESSAGE_BRIDGE_URL ?? "";
    const password = process.env.IMESSAGE_BRIDGE_PASSWORD ?? "";
    const defaultMethod = process.env.IMESSAGE_BRIDGE_DEFAULT_METHOD ?? "private-api";
    bridgeInstance = new BlueBubblesBridge(baseUrl, password, defaultMethod);
  } else {
    bridgeInstance = new MockBridge();
  }

  return bridgeInstance;
}
