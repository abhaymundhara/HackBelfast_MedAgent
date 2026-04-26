import { afterEach, describe, expect, it } from "vitest";

import {
  getAppBaseUrl,
  getPublicAppBaseUrl,
  isLocalAppBaseUrl,
} from "@/lib/appUrl";

const ENV_KEYS = [
  "APP_BASE_URL",
  "NEXT_PUBLIC_APP_BASE_URL",
  "PUBLIC_APP_BASE_URL",
  "NGROK_URL",
  "NGROK_PUBLIC_URL",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = originalEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

describe("app URL resolution", () => {
  it("prefers active ngrok URL over localhost APP_BASE_URL", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.NGROK_PUBLIC_URL = "https://medagent-demo.ngrok-free.app/";

    expect(getAppBaseUrl()).toBe("https://medagent-demo.ngrok-free.app");
  });

  it("falls back to localhost for local development", () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    expect(getPublicAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("detects local URLs", () => {
    expect(isLocalAppBaseUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalAppBaseUrl("https://example.ngrok-free.app")).toBe(false);
  });
});
