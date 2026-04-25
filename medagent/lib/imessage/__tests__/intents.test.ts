import { describe, it, expect } from "vitest";
import { stripActivationKeyword } from "../intents";

describe("stripActivationKeyword", () => {
  it("detects activation keyword and strips prefix", () => {
    process.env.IMESSAGE_ACTIVATION_KEYWORD = "hey baymax!";
    const parsed = stripActivationKeyword("Hey Baymax! access patient SARAHB");
    expect(parsed.activated).toBe(true);
    expect(parsed.cleanedText).toBe("access patient SARAHB");
  });

  it("handles activation keyword with punctuation-only suffix", () => {
    process.env.IMESSAGE_ACTIVATION_KEYWORD = "hey baymax!";
    const parsed = stripActivationKeyword("hey baymax!   ");
    expect(parsed.activated).toBe(true);
    expect(parsed.cleanedText).toBe("");
  });

  it("returns not activated for regular message", () => {
    process.env.IMESSAGE_ACTIVATION_KEYWORD = "hey baymax!";
    const parsed = stripActivationKeyword("access patient SARAHB");
    expect(parsed.activated).toBe(false);
    expect(parsed.cleanedText).toBe("access patient SARAHB");
  });
});
