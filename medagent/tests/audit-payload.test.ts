import { beforeAll, describe, expect, it } from "vitest";

import { buildAuditEvent } from "@/lib/agent/tools/logAuditOnChain";
import { resetDatabase } from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";

beforeAll(async () => {
  await resetDatabase();
  await seedDemo();
});

describe("audit payload", () => {
  it("contains hashes and metadata only, not PHI values", () => {
    const payload = buildAuditEvent({
      eventType: "access_decision",
      requestId: "req-1",
      patientId: "sarah-bennett",
      requesterId: "did:solana:demo:doctor-1",
      decision: "granted",
      tokenExpiry: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      jurisdiction: "es",
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("Sarah Bennett");
    expect(serialized).not.toContain("Penicillin");
    expect(serialized).toContain("patient_hash");
    expect(serialized).toContain("doctor_hash");
    expect(serialized).toContain("event_type");
  });
});
