import { afterEach, describe, expect, it, vi } from "vitest";

import { parseNameDobInput } from "@/lib/imessage/onboardingNlp";

describe("parseNameDobInput", () => {
  const previousOllamaFlag = process.env.IMESSAGE_OLLAMA_PARSE_ENABLED;
  const previousDebug = process.env.IMESSAGE_DEBUG;

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousOllamaFlag === undefined) {
      delete process.env.IMESSAGE_OLLAMA_PARSE_ENABLED;
    } else {
      process.env.IMESSAGE_OLLAMA_PARSE_ENABLED = previousOllamaFlag;
    }
    if (previousDebug === undefined) {
      delete process.env.IMESSAGE_DEBUG;
    } else {
      process.env.IMESSAGE_DEBUG = previousDebug;
    }
  });

  it("parses compact month-name DOB format like 29May2003 deterministically", async () => {
    process.env.IMESSAGE_OLLAMA_PARSE_ENABLED = "false";

    const parsed = await parseNameDobInput("Abhay Mundhara 29May2003");

    expect(parsed).toEqual({
      name: "Abhay Mundhara",
      dob: "2003-05-29",
    });
  });

  it("rejects invalid ISO dates with impossible month/day", async () => {
    process.env.IMESSAGE_OLLAMA_PARSE_ENABLED = "false";

    const parsed = await parseNameDobInput("Abhay M 2003-29-05");

    expect(parsed).toBeNull();
  });

  it("does not write raw name or DOB to debug logs", async () => {
    process.env.IMESSAGE_DEBUG = "true";
    process.env.IMESSAGE_OLLAMA_PARSE_ENABLED = "false";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await parseNameDobInput("Abhay Mundhara 29May2003");

    const serializedLogs = logSpy.mock.calls
      .map((call) => JSON.stringify(call))
      .join("\n");
    expect(serializedLogs).not.toContain("Abhay");
    expect(serializedLogs).not.toContain("Mundhara");
    expect(serializedLogs).not.toContain("29May2003");
    expect(serializedLogs).not.toContain("2003-05-29");
    expect(serializedLogs).toContain("inputHash");
    expect(serializedLogs).toContain("inputLength");
  });
});
