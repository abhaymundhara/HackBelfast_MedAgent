import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  resumeApprovedRequest,
  runMedAgentWorkflow,
} from "@/lib/agent/medagent";
import {
  getApprovalByRequestId,
  listAccessRequests,
  resetDatabase,
  updateApprovalStatus,
} from "@/lib/db";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";
import { seedDemo } from "@/scripts/seed-demo";

const originalSkipLlm = process.env.MEDAGENT_SKIP_LLM_IN_TESTS;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalForceLocalAudit = process.env.MEDAGENT_FORCE_LOCAL_AUDIT;
const originalJwtSecret = process.env.JWT_SECRET;

beforeAll(async () => {
  process.env.MEDAGENT_SKIP_LLM_IN_TESTS = "true";
  process.env.MEDAGENT_FORCE_LOCAL_AUDIT = "true";
  process.env.JWT_SECRET = "test-secret";
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

  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});

describe("tier 2 resume flow", () => {
  it("resumes the original request and creates a single session", async () => {
    const persona = DEMO_CLINICIANS[1];
    const pendingOutcome = await runMedAgentWorkflow({
      input: {
        patientId: "sarah-bennett",
        requesterId: persona.requesterId,
        naturalLanguageRequest:
          "Need medication and allergy context while the patient can still approve.",
        targetLocale: persona.locale,
        emergencyMode: false,
      },
    });

    const requestId = pendingOutcome.requestId;
    const approval = getApprovalByRequestId(requestId);
    expect(pendingOutcome.decision).toBe("awaiting_human");
    expect(approval?.status).toBe("pending");

    updateApprovalStatus(approval!.token, "approved");
    const resumedOutcome = await resumeApprovedRequest(requestId);

    expect(resumedOutcome.requestId).toBe(requestId);
    expect(resumedOutcome.decision).toBe("granted");
    expect(resumedOutcome.jwt).toBeDefined();
    expect(resumedOutcome.expiresAt).toBeDefined();
    expect(
      listAccessRequests().filter((request) => request.id === requestId),
    ).toHaveLength(1);
  });
});
