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
  it("marks the trusted demo clinician as a trusted requester", async () => {
    const result = await verifyRequester({
      requesterId: DEMO_CLINICIANS[0].requesterId,
    });

    expect(result.verified).toBe(true);
    expect(result.trustLevel).toBe("trusted_requester");
    expect(result.registryAnchored).toBe(true);
  });

  it("marks a trusted cross-jurisdiction clinician as verified", async () => {
    const result = await verifyRequester({
      requesterId: DEMO_CLINICIANS[1].requesterId,
    });

    expect(result.verified).toBe(true);
    expect(result.trustLevel).toBe("trusted_requester");
  });

  it("recognizes a credential that points to a trusted issuer without upgrading the requester", async () => {
    const result = await verifyRequester({
      requesterId: "did:solana:3yPCnb5XQAJcvqmVz1xjUrL9iE24oUAX6LkycfWw5NKX",
      presentedCredential:
        "Issuer: HSE Ireland (St. James's Hospital, Dublin); badge-owner: temporary-locum",
    });

    expect(result.verified).toBe(false);
    expect(result.trustLevel).toBe("trusted_issuer_unrecognized_requester");
    expect(result.registryAnchored).toBe(true);
  });
});
