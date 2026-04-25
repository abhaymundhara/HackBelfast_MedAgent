import { beforeAll, describe, expect, it } from "vitest";

import { filterSummaryForTier } from "@/lib/agent/tools/fetchSummary";
import { resetDatabase } from "@/lib/db";
import { DEMO_PATIENTS } from "@/lib/ips/seed";
import { seedDemo } from "@/scripts/seed-demo";

beforeAll(async () => {
  await resetDatabase();
  await seedDemo();
});

describe("field filtering", () => {
  const patient = DEMO_PATIENTS.find(
    (item) => item.patientId === "sarah-bennett",
  )!;

  it("releases broader data for Tier 1 than Tier 2", () => {
    const tier1 = filterSummaryForTier(
      patient.patientId,
      patient.summary,
      patient.policy,
      1,
    );
    const tier2 = filterSummaryForTier(
      patient.patientId,
      patient.summary,
      patient.policy,
      2,
    );

    expect(tier1).toHaveProperty("recentDischarge");
    expect(tier2).not.toHaveProperty("recentDischarge");
    expect((tier1.documents as unknown[]).length).toBeGreaterThan(0);
  });

  it("keeps Tier 3 to critical-only data", () => {
    const tier3 = filterSummaryForTier(
      patient.patientId,
      patient.summary,
      patient.policy,
      3,
    );

    expect(tier3).not.toHaveProperty("documents");
    expect(
      (tier3.medications as { critical: boolean }[]).every(
        (item) => item.critical,
      ),
    ).toBe(true);
  });
});
