import { beforeAll, describe, expect, it } from "vitest";

import { verifyRequester } from "@/lib/agent/tools/verifyRequester";
import { resetDatabase } from "@/lib/db";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";
import { seedDemo } from "@/scripts/seed-demo";

beforeAll(async () => {
  resetDatabase();
  await seedDemo();
});

describe("requester verification", () => {
  it("verifies the HSE demo clinician via IMC registration", async () => {
    const result = await verifyRequester({
      requesterId: DEMO_CLINICIANS[0].requesterId,
    });

    expect(result.verified).toBe(true);
    expect(result.trustLevel).toBe("trusted_requester");
    expect(result.verificationMode).toBe("doctor_registry");
    expect(result.verificationReason).toContain("IMC");
  });

  it("maps iMessage persona IDs to board registration records", async () => {
    const result = await verifyRequester({ requesterId: "dr-okonkwo" });

    expect(result.verified).toBe(true);
    expect(result.requesterLabel).toBe("Dr. Chidi Okonkwo");
    expect(result.verificationReason).toContain("GMC4921847");
  });

  it("recognizes a credential issuer hint without using legacy DID trust for verification", async () => {
    const result = await verifyRequester({
      requesterId: "did:solana:3yPCnb5XQAJcvqmVz1xjUrL9sB4uY3nQ8rP2mK6tFvA",
      presentedCredential:
        "Issuer: HSE Ireland (St. James's Hospital, Dublin); badge-owner: temporary-locum",
    });

    expect(result.verified).toBe(false);
    expect(result.trustLevel).toBe("trusted_issuer_unrecognized_requester");
    expect(result.registryAnchored).toBe(true);
  });
});
