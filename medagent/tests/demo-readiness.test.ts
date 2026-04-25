import { beforeAll, describe, expect, it } from "vitest";

import { runDemoReadinessCheck } from "@/lib/solana/readiness";
import { resetDatabase } from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";

beforeAll(async () => {
  resetDatabase();
  await seedDemo();
});

describe("demo readiness", () => {
  it("reports fallback mode when live Solana credentials are missing", async () => {
    const originalPrivateKey = process.env.SOLANA_PRIVATE_KEY;
    const originalKeypairPath = process.env.SOLANA_KEYPAIR_PATH;

    delete process.env.SOLANA_PRIVATE_KEY;
    process.env.SOLANA_KEYPAIR_PATH = "/tmp/medagent-missing-keypair.json";

    try {
      const result = await runDemoReadinessCheck();

      expect(result.mode).toBe("fallback");
      expect(result.ready).toBe(false);
      expect(
        result.checks.find((check) => check.key === "credentials")?.passed,
      ).toBe(false);
    } finally {
      if (originalPrivateKey === undefined) {
        delete process.env.SOLANA_PRIVATE_KEY;
      } else {
        process.env.SOLANA_PRIVATE_KEY = originalPrivateKey;
      }
      if (originalKeypairPath === undefined) {
        delete process.env.SOLANA_KEYPAIR_PATH;
      } else {
        process.env.SOLANA_KEYPAIR_PATH = originalKeypairPath;
      }
    }
  });
});
