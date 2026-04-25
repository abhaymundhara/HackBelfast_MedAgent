import { pathToFileURL } from "url";

import { config } from "dotenv";

import {
  deletePatientDocuments,
  savePatientDocumentMetadata,
  savePatientPolicy,
  setAppConfig,
  upsertIssuerRegistry,
  upsertPatient,
  writeEncryptedDocument,
} from "@/lib/db";
import { encryptBuffer, encryptJson, sha256Hash } from "@/lib/crypto";
import { DEMO_CLINICIANS, DEMO_PATIENTS } from "@/lib/ips/seed";

config({ path: ".env.local" });
config();

// Cross-jurisdiction metadata per issuer for the Belfast 2036 demo.
const ISSUER_METADATA: Record<string, { jurisdiction: string; requiresCrossSystemApproval: boolean }> = {
  "dr-murphy": { jurisdiction: "ROI", requiresCrossSystemApproval: false },
  "dr-okonkwo": { jurisdiction: "NI", requiresCrossSystemApproval: true },
  "unknown-emergency": { jurisdiction: "unknown", requiresCrossSystemApproval: false },
};

export async function seedDemo() {
  const db = (await import("@/lib/db")).getDb();

  for (const clinician of DEMO_CLINICIANS) {
    upsertIssuerRegistry(clinician, null);
    const meta = ISSUER_METADATA[clinician.id];
    if (meta) {
      db.prepare(
        "UPDATE issuer_registry SET jurisdiction = ?, requires_cross_system_approval = ? WHERE id = ?"
      ).run(meta.jurisdiction, meta.requiresCrossSystemApproval ? 1 : 0, clinician.id);
    }
  }

  for (const patient of DEMO_PATIENTS) {
    upsertPatient({
      patientId: patient.patientId,
      localIdentity: patient.localIdentity,
      encryptedSummary: encryptJson(patient.summary),
      patientHash: sha256Hash(`${patient.patientId}:${patient.summary.demographics.email}`),
      chainIdentity: null,
      registryAccountId: null,
      auditRef: null,
    });
    savePatientPolicy(patient.patientId, patient.policy);
    deletePatientDocuments(patient.patientId);

    for (const doc of patient.docs) {
      const storagePath = writeEncryptedDocument(
        patient.patientId,
        doc.id,
        encryptBuffer(Buffer.from(doc.content, "utf8")),
      );
      savePatientDocumentMetadata({
        id: doc.id,
        patientId: patient.patientId,
        title: doc.title,
        mimeType: doc.mimeType,
        storagePath,
        patientApproved: doc.patientApprovedForTier1Or2,
      });
    }
  }

  setAppConfig("demo.seededAt", new Date().toISOString());

  return {
    patients: DEMO_PATIENTS.length,
    clinicians: DEMO_CLINICIANS.length,
    audit: "solana",
  };
}

async function main() {
  const result = await seedDemo();
  console.log("Demo seeded");
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
