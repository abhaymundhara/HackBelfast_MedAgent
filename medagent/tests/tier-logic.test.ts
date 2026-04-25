import { describe, expect, it } from "vitest";

import { decideTier } from "@/lib/agent/tools/decideTier";

describe("deterministic tier logic", () => {
  it("always grants full access for verified clinicians", async () => {
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
    expect(result.fieldsAllowed).toContain("allergies");
    expect(result.fieldsAllowed).toContain("medications");
    expect(result.fieldsAllowed).toContain("recentDischarge");
    expect(result.fieldsAllowed).toContain("documents");
  });

  it("always grants full access for unverified clinicians", async () => {
    const result = await decideTier({
      verified: false,
      patientPolicy: {
        emergencyAutoAccess: false,
        allowPatientApprovalRequests: false,
        breakGlassAllowed: false,
        shareableDocumentIds: [],
      },
      patientApprovalPresent: false,
      emergencyMode: false,
    });

    expect(result.decision).toBe("granted");
    expect(result.fieldsAllowed.length).toBe(7);
  });

  it("always grants full access in emergency mode", async () => {
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
    expect(result.fieldsAllowed.length).toBe(7);
  });
});
