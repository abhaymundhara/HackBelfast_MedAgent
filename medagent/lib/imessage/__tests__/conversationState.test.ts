import { describe, it, expect, beforeEach } from "vitest";
import { loadConversation, saveConversation, clearActiveRequest } from "../conversationState";
import { getDb, resetDatabase } from "@/lib/db";

describe("conversationState", () => {
  beforeEach(() => {
    resetDatabase();
  });

  it("returns null for unknown handle", () => {
    expect(loadConversation("+1234567890")).toBeNull();
  });

  it("save and load round-trip", () => {
    saveConversation({
      handle: "+447700900111",
      identityId: "dr-murphy",
      identityKind: "clinician",
      activeRequestId: "req_123",
      awaiting: "approval_yes_no",
      lastMessageAt: new Date().toISOString(),
      metadata: { foo: "bar" },
    });

    const loaded = loadConversation("+447700900111");
    expect(loaded).not.toBeNull();
    expect(loaded!.identityId).toBe("dr-murphy");
    expect(loaded!.activeRequestId).toBe("req_123");
    expect(loaded!.awaiting).toBe("approval_yes_no");
    expect(loaded!.metadata).toEqual({ foo: "bar" });
  });

  it("persona override stored in metadata", () => {
    saveConversation({
      handle: "+447700900222",
      identityId: "dr-murphy",
      identityKind: "clinician",
      activeRequestId: null,
      awaiting: null,
      lastMessageAt: new Date().toISOString(),
      metadata: { personaOverride: "dr-okonkwo" },
    });

    const loaded = loadConversation("+447700900222");
    expect(loaded!.metadata.personaOverride).toBe("dr-okonkwo");
  });

  it("clearActiveRequest clears request and awaiting", () => {
    saveConversation({
      handle: "+447700900333",
      identityId: "sarah-bennett",
      identityKind: "patient",
      activeRequestId: "req_456",
      awaiting: "approval_yes_no",
      lastMessageAt: new Date().toISOString(),
      metadata: {},
    });

    clearActiveRequest("+447700900333");

    const loaded = loadConversation("+447700900333");
    expect(loaded!.activeRequestId).toBeNull();
    expect(loaded!.awaiting).toBeNull();
  });
});
