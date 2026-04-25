import crypto from "crypto";

import { createAppointment, getAppointmentSlot } from "@/lib/db";

export function bookAppointmentSlot(input: {
  patientId: string;
  slotId: string;
  symptomSummary: string;
}) {
  const slot = getAppointmentSlot(input.slotId);
  if (!slot) {
    throw new Error("Appointment slot not found");
  }
  if (slot.status !== "available") {
    throw new Error("Appointment slot is no longer available");
  }

  const appointment = createAppointment({
    id: crypto.randomUUID(),
    patientId: input.patientId,
    slotId: slot.id,
    doctorRegNumber: slot.doctorRegNumber,
    doctorName: slot.doctorName,
    doctorEmail: slot.doctorEmail,
    clinic: slot.clinic,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    symptomSummary: input.symptomSummary,
  });

  if (!appointment) {
    throw new Error("Appointment could not be created");
  }
  return appointment;
}

