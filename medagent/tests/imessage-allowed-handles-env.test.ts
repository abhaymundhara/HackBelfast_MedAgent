import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appendAllowedImessageHandle } from "@/lib/imessage/allowedHandlesEnv";

describe("appendAllowedImessageHandle", () => {
  let tempDir: string;
  let envPath: string;
  let previousAllowedHandles: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "medagent-handles-"));
    envPath = path.join(tempDir, ".env.local");
    previousAllowedHandles = process.env.IMESSAGE_POLLER_ALLOWED_HANDLES;
  });

  afterEach(() => {
    if (previousAllowedHandles === undefined) {
      delete process.env.IMESSAGE_POLLER_ALLOWED_HANDLES;
    } else {
      process.env.IMESSAGE_POLLER_ALLOWED_HANDLES = previousAllowedHandles;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("appends a new activation sender to the poller allowlist", () => {
    fs.writeFileSync(
      envPath,
      "OTHER=value\nIMESSAGE_POLLER_ALLOWED_HANDLES=+447900000001, +447900000002\n",
    );

    const result = appendAllowedImessageHandle("+447900000003", envPath);

    expect(result.added).toBe(true);
    expect(fs.readFileSync(envPath, "utf8")).toContain(
      "IMESSAGE_POLLER_ALLOWED_HANDLES=+447900000001,+447900000002,+447900000003",
    );
    expect(process.env.IMESSAGE_POLLER_ALLOWED_HANDLES).toBe(
      "+447900000001,+447900000002,+447900000003",
    );
  });

  it("does not duplicate an existing sender", () => {
    fs.writeFileSync(envPath, "IMESSAGE_POLLER_ALLOWED_HANDLES=+447900000001\n");

    const result = appendAllowedImessageHandle("+447900000001", envPath);

    expect(result).toMatchObject({
      added: false,
      reason: "already-present",
    });
    expect(fs.readFileSync(envPath, "utf8")).toBe(
      "IMESSAGE_POLLER_ALLOWED_HANDLES=+447900000001\n",
    );
  });

  it("leaves wildcard allowlists unchanged", () => {
    fs.writeFileSync(envPath, "IMESSAGE_POLLER_ALLOWED_HANDLES=*\n");

    const result = appendAllowedImessageHandle("+447900000001", envPath);

    expect(result).toMatchObject({
      added: false,
      reason: "wildcard-allows-all",
    });
    expect(fs.readFileSync(envPath, "utf8")).toBe(
      "IMESSAGE_POLLER_ALLOWED_HANDLES=*\n",
    );
  });

  it("seeds a new allowlist from fallback handles when the env key is missing", () => {
    fs.writeFileSync(envPath, "OTHER=value\n");
    delete process.env.IMESSAGE_POLLER_ALLOWED_HANDLES;

    const result = appendAllowedImessageHandle("+447900000003", envPath, [
      "+447900000001",
      "+447900000002",
    ]);

    expect(result.added).toBe(true);
    expect(fs.readFileSync(envPath, "utf8")).toContain(
      "IMESSAGE_POLLER_ALLOWED_HANDLES=+447900000001,+447900000002,+447900000003",
    );
  });
});
