import type { Appointment, AppointmentSlot } from "@/lib/db";
import type { AppointmentCandidate } from "./types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function formatAppointmentOptions(slots: Array<AppointmentSlot | AppointmentCandidate>) {
  if (slots.length === 0) {
    return "I couldn't find an available Belfast appointment for that date. Send another date like 2026-04-27 and I'll check again.";
  }
  return [
    "I found these Belfast appointment slots:",
    "",
    ...slots.map(
      (slot, index) =>
        `${index + 1}. ${formatDateTime(slot.startsAt)} — ${slot.doctorName}, ${slot.specialty ?? "General Practice"} at ${slot.clinic}`,
    ),
    "",
    "Reply with a number to book, or send a future date in YYYY-MM-DD format.",
  ].join("\n");
}

export function formatAppointmentConfirmation(appointment: Appointment & { chainRef?: string | null }) {
  const lines = [
    "Appointment confirmed.",
    `Doctor: ${appointment.doctorName}`,
    `When: ${formatDateTime(appointment.startsAt)}`,
    `Where: ${appointment.clinic}`,
  ];
  if (appointment.chainRef) {
    if (appointment.chainRef.startsWith("local-solana:")) {
      lines.push("", "your appointment has been logged securely. blockchain confirmation is pending.");
    } else {
      lines.push(
        "",
        "your appointment has been securely logged on a permanent ledger — no one can tamper with it.",
        `proof: https://solscan.io/tx/${appointment.chainRef}?cluster=devnet`,
      );
    }
  }
  lines.push(
    "",
    "Booking does not share your medical data.",
    `Do you want to share your full uploaded medical record with ${appointment.doctorName} for this appointment? Reply YES or NO.`,
  );
  return lines.join("\n");
}
