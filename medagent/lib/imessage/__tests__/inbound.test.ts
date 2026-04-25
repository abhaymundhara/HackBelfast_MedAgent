import { describe, it, expect } from "vitest";
import { parseInbound } from "../inbound";

describe("parseInbound", () => {
  const validPayload = {
    type: "new-message",
    data: {
      guid: "iMessage;-;+447700900111",
      text: "Need emergency access to patient SARAHB",
      handle: { address: "+447700900111" },
      chats: [{ guid: "iMessage;-;+447700900111" }],
      isFromMe: false,
      dateCreated: Date.now(),
    },
  };

  it("parses a valid BlueBubbles new-message payload", () => {
    const result = parseInbound(validPayload);
    expect(result).not.toBeNull();
    expect(result!.handle).toBe("+447700900111");
    expect(result!.chatGuid).toBe("iMessage;-;+447700900111");
    expect(result!.text).toBe("Need emergency access to patient SARAHB");
    expect(result!.bridgeMessageGuid).toBe("iMessage;-;+447700900111");
  });

  it("rejects isFromMe: true", () => {
    const result = parseInbound({
      ...validPayload,
      data: { ...validPayload.data, isFromMe: true },
    });
    expect(result).toBeNull();
  });

  it("rejects empty text", () => {
    const result = parseInbound({
      ...validPayload,
      data: { ...validPayload.data, text: "   " },
    });
    expect(result).toBeNull();
  });

  it("rejects events older than 5 minutes", () => {
    const result = parseInbound({
      ...validPayload,
      data: { ...validPayload.data, dateCreated: Date.now() - 6 * 60 * 1000 },
    });
    expect(result).toBeNull();
  });

  it("rejects non-new-message events", () => {
    const result = parseInbound({ ...validPayload, type: "updated-message" });
    expect(result).toBeNull();
  });

  it("returns null for invalid payloads", () => {
    expect(parseInbound(null)).toBeNull();
    expect(parseInbound({})).toBeNull();
    expect(parseInbound("string")).toBeNull();
  });
});
