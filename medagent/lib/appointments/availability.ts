import { listAppointmentSlots } from "@/lib/db";

import { AppointmentCandidate, AppointmentSearchInput } from "./types";

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function parseRequestedDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function matchesReason(slotTags: string[], reason: string) {
  const normalizedReason = reason.toLowerCase();
  if (!slotTags.length) return true;
  // If the reason is too vague (no medical keywords), don't filter — show all available slots
  const hasAnyMedicalContext = slotTags.some((tag) => normalizedReason.includes(tag.toLowerCase()));
  const isVagueRequest = /\b(appointment|book|see a doctor|need a doctor|available|any)\b/i.test(reason) && !hasAnyMedicalContext;
  if (isVagueRequest) return true;
  return hasAnyMedicalContext;
}

function toCandidate(slot: ReturnType<typeof listAppointmentSlots>[number]): AppointmentCandidate {
  return {
    id: slot.id,
    doctorName: slot.doctorName,
    doctorEmail: slot.doctorEmail,
    doctorRegNumber: slot.doctorRegNumber,
    specialty: slot.specialty,
    clinic: slot.clinic,
    jurisdiction: slot.jurisdiction,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    reasonTags: slot.reasonTags,
  };
}

export function searchAppointmentSlots(input: AppointmentSearchInput) {
  const requestedDate = parseRequestedDate(input.requestedDate);
  const windows = requestedDate
    ? [dayBounds(requestedDate)]
    : [dayBounds(new Date()), dayBounds(new Date(Date.now() + 24 * 60 * 60 * 1000))];

  const candidates = windows.flatMap((window) =>
    listAppointmentSlots({
      jurisdiction: "NI",
      from: window.start,
      to: window.end,
      status: "available",
    })
      .filter((slot) => matchesReason(slot.reasonTags, input.reason))
      .map(toCandidate),
  );

  return candidates.slice(0, 5);
}

