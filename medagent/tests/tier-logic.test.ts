import { describe, expect, it } from "vitest";

import { decideTier } from "@/lib/agent/tools/decideTier";

describe("deterministic tier logic", () => {
  it("grants Tier 1 to a verified clinician with auto-access", async () => {
    const result = await decideTier({
      verified: true,
      patientPolicy: {
        emergencyAutoAccess: true,
        allowPatientApprovalRequests: true,
        breakGlassAllowed: true,
        shareableDocumentIds: [],
      },
      patientApprovalPresent: false,
      emergencyMode: false,
    });

    expect(result.decision).toBe("granted");
    expect(result.tier).toBe(1);
    expect(result.ttlSeconds).toBe(1800);
  });

  it("pauses for Tier 2 approval when verification is weak", async () => {
    const result = await decideTier({
      verified: false,
      patientPolicy: {
        emergencyAutoAccess: true,
        allowPatientApprovalRequests: true,
        breakGlassAllowed: true,
        shareableDocumentIds: [],
      },
      patientApprovalPresent: false,
      emergencyMode: false,
    });

    expect(result.decision).toBe("awaiting_human");
    expect(result.tier).toBe(2);
  });

  it("grants Tier 3 on break-glass when policy allows it", async () => {
    const result = await decideTier({
      verified: false,
      patientPolicy: {
        emergencyAutoAccess: false,
        allowPatientApprovalRequests: false,
        breakGlassAllowed: true,
        shareableDocumentIds: [],
      },
      patientApprovalPresent: false,
      emergencyMode: true,
    });

    expect(result.decision).toBe("granted");
    expect(result.tier).toBe(3);
    expect(result.ttlSeconds).toBe(1200);
  });
});
