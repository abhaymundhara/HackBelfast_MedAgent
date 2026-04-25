import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/actions/share/[id]/route";
import { createShareRecord } from "@/lib/sharing/createShare";
import { revokeShareRecord } from "@/lib/sharing/revokeShare";
import { setupFullRecordShareFixture } from "./share-fixture";

async function getDescriptor(shareId: string) {
  const response = await GET(new Request(`http://localhost/api/actions/share/${shareId}`) as never, {
    params: { id: shareId },
  });
  return response.json();
}

describe("share action descriptor", () => {
  it("labels full-record appointment shares and remains non-auth-bearing", async () => {
    const fixture = setupFullRecordShareFixture();
    const share = await createShareRecord({
      patientId: fixture.patientId,
      doctorName: fixture.appointment.doctorName,
      doctorEmail: fixture.appointment.doctorEmail,
      fieldsToShare: [],
      ttlHours: 24,
      shareScope: "full_record",
      appointmentId: fixture.appointment.id,
    });

    const descriptor = await getDescriptor(share.shareId);

    expect(descriptor.description).toContain("Full medical record");
    expect(descriptor.description).toContain(fixture.appointment.doctorName);
    expect(descriptor.description).toContain(fixture.appointment.clinic);
    expect(descriptor.links.actions[0].href).toBe(`/share/${share.shareId}`);
    expect(descriptor.links.actions[0].href).not.toContain("token=");
    expect(descriptor.disabled).toBe(false);
  });

  it("disables revoked shares", async () => {
    const fixture = setupFullRecordShareFixture();
    const share = await createShareRecord({
      patientId: fixture.patientId,
      doctorName: fixture.appointment.doctorName,
      doctorEmail: fixture.appointment.doctorEmail,
      fieldsToShare: [],
      ttlHours: 24,
      shareScope: "full_record",
      appointmentId: fixture.appointment.id,
    });
    await revokeShareRecord({ shareId: share.shareId, patientId: fixture.patientId });

    const descriptor = await getDescriptor(share.shareId);

    expect(descriptor.disabled).toBe(true);
    expect(descriptor.error.message).toContain("revoked");
  });
});

