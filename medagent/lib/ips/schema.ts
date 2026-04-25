import { z } from "zod";

import {
  EmergencySummary,
  PatientPolicy,
  ReleasedFieldSchema,
} from "@/lib/types";

export const UploadMetadataSchema = z.object({
  title: z.string().min(1),
  patientApprovedForTier1Or2: z.boolean().default(true),
});

export const PatientCreateSchema = z.object({
  patientId: z.string().min(1),
  localIdentity: z.string().min(1),
  summary: EmergencySummary,
  policy: PatientPolicy,
});

export const AccessRequestSchema = z.object({
  patientId: z.string().min(1),
  requesterId: z.string().min(1),
  naturalLanguageRequest: z.string().min(1),
  emergencyMode: z.boolean().default(false),
  presentedCredential: z.string().optional(),
});

export const ApprovalActionSchema = z.object({
  requestId: z.string().min(1),
  approvalToken: z.string().min(1),
  approved: z.boolean(),
});

export const FollowUpQuestionSchema = z.object({
  question: z.string().min(1),
  fieldsAllowed: z.array(ReleasedFieldSchema).optional(),
});
