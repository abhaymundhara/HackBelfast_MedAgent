import { beforeEach, describe, expect, it } from "vitest";

import { bookAppointmentSlot } from "@/lib/appointments/bookAppointment";
import {
  getAppointmentSlot,
  resetDatabase,
  upsertAppointmentSlot,
  upsertPatient,
} from "@/lib/db";
import { encryptJson, sha256Hash } from "@/lib/crypto";
import { EmergencySummary } from "@/lib/types";

beforeEach(() => {
  resetDatabase();
  const summary = EmergencySummary.parse({
    patientId: "patient-1",
    demographics: {
      name: "Patient One",
      dob: "1990-01-01",
      sex: "other",
      languages: ["English"],
      homeCountry: "Ireland",
      email: "patient.one@example.test",
    },
    allergies: [],
    medications: [],
    conditions: [],
    alerts: [],
    emergencyContact: { name: "Contact", relation: "Friend", phone: "" },
    documents: [],
  });
  upsertPatient({
    patientId: "patient-1",
    localIdentity: "patient:patient-1",
    encryptedSummary: encryptJson(summary),
    patientHash: sha256Hash("patient-1:patient.one@example.test"),
  });
  upsertAppointmentSlot({
    id: "slot-1",
    doctorRegNumber: "GMC1",
    doctorName: "Dr. Book",
    doctorEmail: "book@example.test",
    specialty: "MSK",
    clinic: "Belfast MSK",
    jurisdiction: "NI",
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reasonTags: ["knee"],
  });
});

describe("bookAppointmentSlot", () => {
  it("confirms appointment and marks slot booked", async () => {
    process.env.MEDAGENT_FORCE_LOCAL_AUDIT = "1";
    const appointment = await bookAppointmentSlot({
      patientId: "patient-1",
      slotId: "slot-1",
      symptomSummary: "knee pain",
    });

    expect(appointment.patientId).toBe("patient-1");
    expect(appointment.status).toBe("confirmed");
    expect(getAppointmentSlot("slot-1")?.status).toBe("booked");
    delete process.env.MEDAGENT_FORCE_LOCAL_AUDIT;
  });
});
