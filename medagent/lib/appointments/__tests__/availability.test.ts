import { beforeEach, describe, expect, it } from "vitest";

import { resetDatabase, upsertAppointmentSlot } from "@/lib/db";
import { searchAppointmentSlots } from "@/lib/appointments/availability";

function iso(dayOffset: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

beforeEach(() => {
  resetDatabase();
  upsertAppointmentSlot({
    id: "today-knee",
    doctorRegNumber: "GMC1",
    doctorName: "Dr. Knee",
    doctorEmail: "knee@example.test",
    specialty: "MSK",
    clinic: "Belfast MSK",
    jurisdiction: "NI",
    startsAt: iso(0, 15),
    endsAt: iso(0, 15),
    reasonTags: ["knee"],
  });
  upsertAppointmentSlot({
    id: "tomorrow-knee",
    doctorRegNumber: "GMC2",
    doctorName: "Dr. Tomorrow",
    doctorEmail: "tomorrow@example.test",
    specialty: "GP",
    clinic: "Belfast GP",
    jurisdiction: "NI",
    startsAt: iso(1, 10),
    endsAt: iso(1, 10),
    reasonTags: ["knee"],
  });
});

describe("appointment availability", () => {
  it("returns Belfast knee slots for today and tomorrow", () => {
    const slots = searchAppointmentSlots({
      patientId: "patient-1",
      location: "Belfast",
      reason: "knee injury spike",
    });

    expect(slots.map((slot) => slot.id)).toEqual([
      "today-knee",
      "tomorrow-knee",
    ]);
  });

  it("returns slots for a requested future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    future.setHours(9, 0, 0, 0);
    const requestedDate = future.toISOString().slice(0, 10);

    upsertAppointmentSlot({
      id: "future-knee",
      doctorRegNumber: "GMC3",
      doctorName: "Dr. Future",
      doctorEmail: "future@example.test",
      specialty: "MSK",
      clinic: "Belfast Future",
      jurisdiction: "NI",
      startsAt: future.toISOString(),
      endsAt: new Date(future.getTime() + 30 * 60 * 1000).toISOString(),
      reasonTags: ["knee"],
    });

    const slots = searchAppointmentSlots({
      patientId: "patient-1",
      location: "Belfast",
      reason: "knee pain",
      requestedDate,
    });

    expect(slots.map((slot) => slot.id)).toEqual(["future-knee"]);
  });
});

