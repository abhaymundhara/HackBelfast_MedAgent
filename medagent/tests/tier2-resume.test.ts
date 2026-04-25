import { beforeAll, describe, expect, it } from "vitest";

import { runMedAgentWorkflow } from "@/lib/agent/medagent";
import { resetDatabase } from "@/lib/db";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";
import { seedDemo } from "@/scripts/seed-demo";

beforeAll(async () => {
  resetDatabase();
  await seedDemo();
});

describe("simplified access flow", () => {
  it(
    "grants access immediately without approval step",
    async () => {
      const outcome = await runMedAgentWorkflow({
        input: {
          patientId: "sarah-bennett",
          requesterId: DEMO_CLINICIANS[1].requesterId,
          naturalLanguageRequest: "Need emergency access to patient record.",
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
