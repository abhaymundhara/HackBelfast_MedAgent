import { describe, expect, it } from "vitest";

import { createShareRecord } from "@/lib/sharing/createShare";
import { getPatientDashboardVersion } from "@/lib/patientDashboardVersion";
import { setupFullRecordShareFixture } from "./share-fixture";

describe("patient dashboard version", () => {
  it("changes when a document share is created", async () => {
    const fixture = setupFullRecordShareFixture();
    const before = getPatientDashboardVersion(fixture.patientId);

    await createShareRecord({
      patientId: fixture.patientId,
      doctorName: fixture.appointment.doctorName,
      doctorEmail: fixture.appointment.doctorEmail,
      fieldsToShare: [],
      ttlHours: 24,
      shareScope: "full_record",
      appointmentId: fixture.appointment.id,
    });

    const after = getPatientDashboardVersion(fixture.patientId);

    expect(after.version).not.toBe(before.version);
    expect(after.shareCount).toBe(before.shareCount + 1);
  });
});
