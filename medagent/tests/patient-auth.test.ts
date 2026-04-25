import { beforeEach, describe, expect, it } from "vitest";

import { registerPatient, loginPatient, validatePatientJwt } from "@/lib/auth/patientAuth";
import { resetDatabase, upsertPatient } from "@/lib/db";
import { encryptJson, sha256Hash } from "@/lib/crypto";
import { EmergencySummary } from "@/lib/types";

const summary = EmergencySummary.parse({
  patientId: "test-patient",
  demographics: {
    name: "Test Patient",
    dob: "1990-01-01",
    sex: "other",
    languages: ["English"],
    homeCountry: "United Kingdom",
    homeJurisdiction: "NI",
    email: "test.patient@example.com",
  },
  allergies: [],
  medications: [],
  conditions: [],
  alerts: [],
  emergencyContact: { name: "Test Contact", relation: "Friend", phone: "" },
  documents: [],
});

beforeEach(() => {
  resetDatabase();
  upsertPatient({
    patientId: "test-patient",
    localIdentity: "patient:test-patient",
    encryptedSummary: encryptJson(summary),
    patientHash: sha256Hash("test-patient:test.patient@example.com"),
  });
});

describe("patient authentication", () => {
  it("registers, logs in, and validates patient JWTs", async () => {
    const registered = await registerPatient({
      email: "test.patient@example.com",
      password: "correct horse battery staple",
      phone: "+447700900000",
      patientId: "test-patient",
    });

    expect(validatePatientJwt(registered.jwt)).toMatchObject({
      valid: true,
      patientId: "test-patient",
    });

    await expect(loginPatient("test.patient@example.com", "wrong password"))
      .resolves
      .toBeNull();

    const loggedIn = await loginPatient(
      "test.patient@example.com",
      "correct horse battery staple",
    );
    expect(loggedIn?.patientId).toBe("test-patient");
    expect(validatePatientJwt(loggedIn!.jwt).valid).toBe(true);
  });
});
