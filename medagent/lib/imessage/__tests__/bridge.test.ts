import { afterEach, describe, expect, it, vi } from "vitest";
import { __setAppleScriptRunnerForTests, getBridge } from "../bridge";

const originalPlatform = process.platform;
const originalDisableUiAutomation = process.env.IMESSAGE_DISABLE_UI_AUTOMATION;

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: platform,
  });
}

afterEach(() => {
  setPlatform(originalPlatform);
  __setAppleScriptRunnerForTests(null);
  vi.restoreAllMocks();
  if (originalDisableUiAutomation === undefined) {
    delete process.env.IMESSAGE_DISABLE_UI_AUTOMATION;
  } else {
    process.env.IMESSAGE_DISABLE_UI_AUTOMATION = originalDisableUiAutomation;
  }
});

describe("MacOSLocalBridge message state helpers", () => {
  it("skips read and typing actions outside macOS", async () => {
    setPlatform("linux");
    const bridge = getBridge();

    await expect(
      bridge.markChatRead({ chatGuid: "iMessage;-;+447700900111" }),
    ).resolves.toMatchObject({ status: "skipped" });
    await expect(
      bridge.showTypingIndicator({ chatGuid: "iMessage;-;+447700900111" }),
    ).resolves.toMatchObject({ status: "skipped" });
  });

  it("skips UI automation when explicitly disabled", async () => {
    setPlatform("darwin");
    process.env.IMESSAGE_DISABLE_UI_AUTOMATION = "true";
    const bridge = getBridge();

    await expect(
      bridge.markChatRead({ chatGuid: "iMessage;-;+447700900111" }),
    ).resolves.toMatchObject({ status: "skipped" });
    await expect(
      bridge.showTypingIndicator({ chatGuid: "iMessage;-;+447700900111" }),
    ).resolves.toMatchObject({ status: "skipped" });
  });

  it("runs macOS UI automation when enabled and reports failures", async () => {
    setPlatform("darwin");
    delete process.env.IMESSAGE_DISABLE_UI_AUTOMATION;
    const runner = vi.fn().mockResolvedValue({ stdout: "ok\n" });
    __setAppleScriptRunnerForTests(runner);
    const bridge = getBridge();

    await expect(
      bridge.markChatRead({ chatGuid: "iMessage;-;+447700900111" }),
    ).resolves.toEqual({ status: "ok" });
    await expect(
      bridge.showTypingIndicator({ chatGuid: "iMessage;-;+447700900111" }),
    ).resolves.toEqual({ status: "ok" });
    expect(runner).toHaveBeenCalledTimes(2);

    vi.spyOn(console, "error").mockImplementation(() => {});
    runner.mockRejectedValueOnce(new Error("automation denied"));
    await expect(
      bridge.markChatRead({ chatGuid: "iMessage;-;+447700900111" }),
    ).resolves.toMatchObject({ status: "failed" });
  });

  it("does not pulse typing when the composer already has draft text", async () => {
    setPlatform("darwin");
    delete process.env.IMESSAGE_DISABLE_UI_AUTOMATION;
    __setAppleScriptRunnerForTests(
      vi.fn().mockResolvedValue({ stdout: "skipped_non_empty_composer\n" }),
    );
    const bridge = getBridge();

    await expect(
      bridge.showTypingIndicator({ chatGuid: "iMessage;-;+447700900111" }),
    ).resolves.toMatchObject({
      status: "skipped",
      detail: "Messages composer already has draft text",
    });
  });

  it("rejects malformed structured chat GUIDs", async () => {
    setPlatform("darwin");
    delete process.env.IMESSAGE_DISABLE_UI_AUTOMATION;
    const runner = vi.fn().mockResolvedValue({ stdout: "ok\n" });
    __setAppleScriptRunnerForTests(runner);
    const bridge = getBridge();

    await expect(
      bridge.markChatRead({ chatGuid: "iMessage;-;" }),
    ).resolves.toMatchObject({ status: "failed" });
    await expect(
      bridge.showTypingIndicator({ chatGuid: "iMessage;-;-" }),
    ).resolves.toMatchObject({ status: "failed" });
    expect(runner).not.toHaveBeenCalled();
  });
});
