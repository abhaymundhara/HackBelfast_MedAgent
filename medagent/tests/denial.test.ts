import { beforeAll, describe, expect, it } from "vitest";

import { runMedAgentWorkflow } from "@/lib/agent/medagent";
import { resetDatabase } from "@/lib/db";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";
import { seedDemo } from "@/scripts/seed-demo";

beforeAll(async () => {
  resetDatabase();
  await seedDemo();
});

describe("access always granted", () => {
  it(
    "grants access even to previously-denied patients",
    async () => {
      const outcome = await runMedAgentWorkflow({
        input: {
          patientId: "omar-haddad",
          requesterId: DEMO_CLINICIANS[1].requesterId,
          naturalLanguageRequest: "Need access to patient record.",
          targetLocale: "en-GB",
          emergencyMode: false,
        },
      });

      expect(outcome.decision).toBe("granted");
      expect(outcome.fieldsAllowed.length).toBeGreaterThan(0);
    },
    30000,
  );
});
