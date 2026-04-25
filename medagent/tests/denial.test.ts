import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMedAgentWorkflow } from "@/lib/agent/medagent";
import { getAccessRequest, resetDatabase } from "@/lib/db";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";
import { seedDemo } from "@/scripts/seed-demo";

const originalSkipLlm = process.env.MEDAGENT_SKIP_LLM_IN_TESTS;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalForceLocalAudit = process.env.MEDAGENT_FORCE_LOCAL_AUDIT;

beforeAll(async () => {
  process.env.MEDAGENT_SKIP_LLM_IN_TESTS = "true";
  process.env.MEDAGENT_FORCE_LOCAL_AUDIT = "true";
  delete process.env.OPENAI_API_KEY;
  await resetDatabase();
  await seedDemo();
});

afterAll(() => {
  if (originalSkipLlm === undefined) {
    delete process.env.MEDAGENT_SKIP_LLM_IN_TESTS;
  } else {
    process.env.MEDAGENT_SKIP_LLM_IN_TESTS = originalSkipLlm;
  }

  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  if (originalForceLocalAudit === undefined) {
    delete process.env.MEDAGENT_FORCE_LOCAL_AUDIT;
  } else {
    process.env.MEDAGENT_FORCE_LOCAL_AUDIT = originalForceLocalAudit;
  }
});

describe("denial path", () => {
  it("does not release data or issue a session token", async () => {
    const persona = DEMO_CLINICIANS[1];
    const outcome = await runMedAgentWorkflow({
      input: {
        patientId: "omar-haddad",
        requesterId: persona.requesterId,
        naturalLanguageRequest: "Need access without any valid path.",
        targetLocale: persona.locale,
        emergencyMode: false,
      },
    });
    const request = getAccessRequest(outcome.requestId);

    expect(outcome.decision).toBe("denied");
    expect(outcome.sessionId).toBeUndefined();
    expect(outcome.fieldsAllowed).toEqual([]);
    expect(request?.decision).toBe("denied");
  });
});
