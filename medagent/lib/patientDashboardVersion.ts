import { listAuditEvents, listSharedRecords } from "@/lib/db";

export type PatientDashboardVersion = {
  version: string;
  auditEventCount: number;
  shareCount: number;
};

export function getPatientDashboardVersion(
  patientId: string,
): PatientDashboardVersion {
  const events = listAuditEvents(patientId);
  const shares = listSharedRecords(patientId);
  const latestEventAt = events[0]?.createdAt ?? "";
  const latestShareAt = shares[0]?.updated_at ?? shares[0]?.created_at ?? "";

  return {
    version: [
      events.length,
      latestEventAt,
      shares.length,
      latestShareAt,
    ].join(":"),
    auditEventCount: events.length,
    shareCount: shares.length,
  };
}
