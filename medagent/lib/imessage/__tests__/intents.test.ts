import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { classifyIntent, stripActivationKeyword } from "../intents";

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

describe("classifyIntent appointment flow", () => {
  it("classifies patient appointment requests", () => {
    expect(
      classifyIntent("My knee injury is spiking in Belfast, book a doctor", null),
    ).toMatchObject({ kind: "appointment_search", requestedDate: null });
  });

  it("classifies slot selections only while awaiting appointment selection", () => {
    expect(classifyIntent("2", "appointment_slot_selection")).toEqual({
      kind: "appointment_slot_selection",
      selection: 2,
    });
  });

  it("keeps appointment share consent separate from clinician approval", () => {
    expect(classifyIntent("YES", "appointment_share_yes_no")).toEqual({
      kind: "appointment_share",
      decision: "approve",
    });
    expect(classifyIntent("YES", "approval_yes_no")).toEqual({
      kind: "approval",
      decision: "approve",
    });
  });
});
