import { afterEach, describe, expect, it } from "vitest";

import { parseNameDobInput } from "@/lib/imessage/onboardingNlp";

describe("parseNameDobInput", () => {
  const previousOllamaFlag = process.env.IMESSAGE_OLLAMA_PARSE_ENABLED;

  afterEach(() => {
    if (previousOllamaFlag === undefined) {
      delete process.env.IMESSAGE_OLLAMA_PARSE_ENABLED;
    } else {
      process.env.IMESSAGE_OLLAMA_PARSE_ENABLED = previousOllamaFlag;
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
});
