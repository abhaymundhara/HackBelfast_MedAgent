import crypto from "crypto";

import { createAppointment, getAppointmentSlot, getPatientRow } from "@/lib/db";
import { sha256Hash } from "@/lib/crypto";
import { solanaAuditStore } from "@/lib/solana/auditStore";

export async function bookAppointmentSlot(input: {
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

  let chainRef: string | null = null;
  try {
    const patient = getPatientRow(input.patientId);
    const patientHash = patient?.patient_hash ?? sha256Hash(input.patientId);
    const doctorHash = sha256Hash(slot.doctorEmail);
    const auditResult = await solanaAuditStore.writeAuditEvent({
      requestId: appointment.id,
      patientId: input.patientId,
      event: {
        event_type: "appointment_booked",
        request_id: appointment.id,
        doctor_hash: doctorHash,
        patient_hash: patientHash,
        jurisdiction: "GB-NIR",
        decision: "allow",
        token_expiry: null,
        timestamp: new Date().toISOString(),
        interaction_type: "appointment",
        summary_hash: sha256Hash(`${input.patientId}:${slot.startsAt}`),
      },
    });
    chainRef = auditResult.chainRef;
  } catch (err) {
    // Non-blocking — Solana failure doesn't break appointment booking
  }

  return { ...appointment, chainRef };
}

