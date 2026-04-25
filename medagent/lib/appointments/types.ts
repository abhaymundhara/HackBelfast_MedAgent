import { z } from "zod";

export const AppointmentSearchSchema = z.object({
  patientId: z.string(),
  location: z.string().default("Belfast"),
  reason: z.string(),
  requestedDate: z.string().optional(),
});

export type AppointmentSearchInput = z.infer<typeof AppointmentSearchSchema>;

export type AppointmentCandidate = {
  id: string;
  doctorName: string;
  doctorEmail: string;
  doctorRegNumber: string;
  specialty: string | null;
  clinic: string;
  jurisdiction: string;
  startsAt: string;
  endsAt: string;
  reasonTags: string[];
};

