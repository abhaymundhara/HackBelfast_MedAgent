import { describe, expect, it } from "vitest";

import {
  createAppointment,
  getAppointment,
  getAppointmentSlot,
  getPatientRow,
  resetDatabase,
  touchImessageUser,
  updateImessageUser,
  upsertAppointmentSlot,
  upsertPatient,
} from "@/lib/db";
import { encryptJson, sha256Hash } from "@/lib/crypto";
import { clearOnboardedImessageState } from "@/lib/imessage/clearOnboarded";
import { EmergencySummary } from "@/lib/types";

const summary = EmergencySummary.parse({
  patientId: "clear-onboarded-patient",
  demographics: {
    name: "Clear Onboarded",
    dob: "1991-01-01",
    sex: "other",
    languages: ["English"],
    homeCountry: "Ireland",
    homeJurisdiction: "ROI",
    email: "clear@example.test",
  },
  allergies: [],
  medications: [],
  conditions: [],
  alerts: [],
  emergencyContact: { name: "Contact", relation: "Friend", phone: "+3531" },
  documents: [],
});

function setupBookedOnboardedPatient() {
  resetDatabase();
  upsertPatient({
    patientId: summary.patientId,
    localIdentity: "imessage:+353871234567",
    encryptedSummary: encryptJson(summary),
    patientHash: sha256Hash(`${summary.patientId}:${summary.demographics.email}`),
  });
  touchImessageUser("+353871234567");
  updateImessageUser("+353871234567", {
    stage: "onboarded",
    fullName: "Clear Onboarded",
    dob: "1991-01-01",
    patientId: summary.patientId,
  });
  upsertAppointmentSlot({
    id: "clear-slot",
    doctorRegNumber: "GMC-CLEAR",
    doctorName: "Dr. Clear",
    doctorEmail: "clear.doctor@example.test",
    clinic: "Belfast GP",
    jurisdiction: "NI",
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reasonTags: ["knee"],
  });
  createAppointment({
    id: "clear-appointment",
    patientId: summary.patientId,
    slotId: "clear-slot",
    doctorRegNumber: "GMC-CLEAR",
    doctorName: "Dr. Clear",
    doctorEmail: "clear.doctor@example.test",
    clinic: "Belfast GP",
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    symptomSummary: "knee pain",
  });
}

describe("clear onboarded iMessage state", () => {
  it("reports and frees booked appointment slots for onboarded patients", () => {
    setupBookedOnboardedPatient();

    const dryRun = clearOnboardedImessageState({ dryRun: true });

    expect(dryRun.mode).toBe("dry-run");
    expect(dryRun.appointmentsFreed).toBe(1);
    expect(getAppointmentSlot("clear-slot")?.status).toBe("booked");

    const deleted = clearOnboardedImessageState();

    expect(deleted.mode).toBe("delete");
    expect(deleted.onboardedDeleted).toBe(1);
    expect(deleted.appointmentsFreed).toBe(1);
    expect(getAppointmentSlot("clear-slot")?.status).toBe("available");
    expect(getAppointment("clear-appointment")).toBeNull();
    expect(getPatientRow(summary.patientId)).toBeUndefined();
  });
});
