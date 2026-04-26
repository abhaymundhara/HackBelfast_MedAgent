import { beforeEach, describe, expect, it } from "vitest";

import { resetDatabase } from "@/lib/db";
import { lookupDoctor } from "@/lib/verification/lookupDoctor";
import { createOtpRecord, generateOtp, verifyOtp } from "@/lib/verification/otp";
import { createDoctorSession, validateDoctorSession } from "@/lib/verification/session";
import { seedDemo } from "@/scripts/seed-demo";

beforeEach(async () => {
  resetDatabase();
  await seedDemo();
});

describe("doctor board verification", () => {
  it("looks up seeded doctors by exact, partial, and fuzzy inputs", () => {
    expect(lookupDoctor("MC12345")?.name).toBe("Dr. Aoife Murphy");
    expect(lookupDoctor("4921847")?.name).toBe("Dr. Chidi Okonkwo");
    expect(lookupDoctor("siobhan kelly")?.regNumber).toBe("MC99999");
  });

  it("validates one-time OTPs once and rejects reuse", () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);

    createOtpRecord("MC12345", "aoife.murphy@stjames.ie", otp);
    expect(verifyOtp("MC12345", otp)).toEqual({ valid: true });
    expect(verifyOtp("MC12345", otp).valid).toBe(false);
  });

  it("issues and validates a four-hour doctor JWT", () => {
    const session = createDoctorSession("MC12345", "Dr. Aoife Murphy");
    const validated = validateDoctorSession(session.jwt);

    expect(validated).toMatchObject({
      valid: true,
      regNumber: "MC12345",
      name: "Dr. Aoife Murphy",
    });
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
