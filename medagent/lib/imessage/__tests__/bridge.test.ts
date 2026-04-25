import { afterEach, describe, expect, it } from "vitest";
import { getBridge } from "../bridge";

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
});
