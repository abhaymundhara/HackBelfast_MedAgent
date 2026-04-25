import { describe, expect, it } from "vitest";

import { accessSharedDocument } from "@/lib/sharing/accessShare";
import { revokeShareRecord } from "@/lib/sharing/revokeShare";
import { createShareRecord } from "@/lib/sharing/createShare";
import { decryptBuffer } from "@/lib/crypto";
import { getDocumentForPatient, readEncryptedDocument } from "@/lib/db";
import { setupFullRecordShareFixture } from "./share-fixture";

function tokenFromShareUrl(shareUrl: string) {
  return new URL(`http://localhost${shareUrl}`).hash.replace("#token=", "");
}

describe("shared document access", () => {
  it("serves approved document bytes while active and blocks after revocation", async () => {
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
    const token = tokenFromShareUrl(share.shareUrl);

    const document = await accessSharedDocument({
      shareId: share.shareId,
      documentId: fixture.documentId,
      accessToken: token,
    });
    expect(document.ok).toBe(true);
    if (document.ok) {
      expect(document.data.bytes.toString("utf8")).toBe(fixture.documentText);
    }

    await revokeShareRecord({ shareId: share.shareId, patientId: fixture.patientId });
    const revoked = await accessSharedDocument({
      shareId: share.shareId,
      documentId: fixture.documentId,
      accessToken: token,
    });
    expect(revoked.ok).toBe(false);
    if (!revoked.ok) {
      expect(revoked.error.code).toBe("revoked");
    }

    const stored = getDocumentForPatient(fixture.patientId, fixture.documentId)!;
    expect(decryptBuffer(readEncryptedDocument(stored.storage_path)).toString("utf8")).toBe(
      fixture.documentText,
    );
  });
});

