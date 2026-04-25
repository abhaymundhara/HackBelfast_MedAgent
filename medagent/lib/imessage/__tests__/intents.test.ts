import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { stripActivationKeyword } from "../intents";

describe("stripActivationKeyword", () => {
  const activation = "hey baymax!";
  let originalKeyword: string | undefined;

  beforeEach(() => {
    originalKeyword = process.env.IMESSAGE_ACTIVATION_KEYWORD;
    process.env.IMESSAGE_ACTIVATION_KEYWORD = activation;
  });

  afterEach(() => {
    if (originalKeyword === undefined) {
      delete process.env.IMESSAGE_ACTIVATION_KEYWORD;
      return;
    }
    process.env.IMESSAGE_ACTIVATION_KEYWORD = originalKeyword;
  });

  it("detects activation keyword and strips prefix", () => {
    const parsed = stripActivationKeyword("Hey Baymax! access patient SARAHB");
    expect(parsed.activated).toBe(true);
    expect(parsed.cleanedText).toBe("access patient SARAHB");
  });

  it("handles activation keyword with punctuation-only suffix", () => {
    const parsed = stripActivationKeyword("hey baymax!   ");
    expect(parsed.activated).toBe(true);
    expect(parsed.cleanedText).toBe("");
  });

  it("returns not activated for regular message", () => {
    const parsed = stripActivationKeyword("access patient SARAHB");
    expect(parsed.activated).toBe(false);
    expect(parsed.cleanedText).toBe("access patient SARAHB");
  });
});
