import { pathToFileURL } from "url";

import { config } from "dotenv";

import {
  deletePatientDocuments,
  savePatientDocumentMetadata,
  savePatientPolicy,
  setAppConfig,
  upsertAppointmentSlot,
  upsertIssuerRegistry,
  upsertPatient,
  writeEncryptedDocument,
} from "@/lib/db";
import { encryptBuffer, encryptJson, sha256Hash } from "@/lib/crypto";
import { DEMO_CLINICIANS, DEMO_DOCTORS, DEMO_PATIENTS } from "@/lib/ips/seed";

config({ path: ".env.local" });
config();

// Cross-jurisdiction metadata per issuer for the Belfast 2036 demo.
const ISSUER_METADATA: Record<string, { jurisdiction: string; requiresCrossSystemApproval: boolean }> = {
  "dr-murphy": { jurisdiction: "ROI", requiresCrossSystemApproval: false },
  "dr-okonkwo": { jurisdiction: "NI", requiresCrossSystemApproval: true },
  "unknown-emergency": { jurisdiction: "unknown", requiresCrossSystemApproval: false },
};

function appointmentDate(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function seedAppointmentSlot(input: {
  id: string;
  doctorRegNumber: string;
  doctorName: string;
  doctorEmail: string;
  specialty: string | null;
  clinic: string;
  dayOffset: number;
  hour: number;
  minute?: number;
  reasonTags: string[];
}) {
  const startsAt = appointmentDate(input.dayOffset, input.hour, input.minute ?? 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  upsertAppointmentSlot({
    id: input.id,
    doctorRegNumber: input.doctorRegNumber,
    doctorName: input.doctorName,
    doctorEmail: input.doctorEmail,
    specialty: input.specialty,
    clinic: input.clinic,
    jurisdiction: "NI",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    reasonTags: input.reasonTags,
  });
}

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

  for (const doctor of DEMO_DOCTORS) {
    db.prepare(
      `INSERT INTO doctor_registry (reg_number, reg_body, name, email, specialty, hospital, jurisdiction, status)
       VALUES (@regNumber, @regBody, @name, @email, @specialty, @hospital, @jurisdiction, 'active')
       ON CONFLICT(reg_number) DO UPDATE SET
         reg_body = excluded.reg_body,
         name = excluded.name,
         email = excluded.email,
         specialty = excluded.specialty,
         hospital = excluded.hospital,
         jurisdiction = excluded.jurisdiction,
         status = excluded.status`
    ).run(doctor);
  }

  // Musgrave Park Hospital — Regional Orthopaedic Centre (MSK/knee specialist)
  seedAppointmentSlot({
    id: "musgrave-msk-today-1",
    doctorRegNumber: "GMC5318264",
    doctorName: "Mr. Conor Wilson",
    doctorEmail: "conor.wilson@belfasttrust.hscni.net",
    specialty: "Orthopaedics / MSK",
    clinic: "Musgrave Park Hospital, 20 Stockmans Lane, Belfast",
    dayOffset: 0,
    hour: 15,
    reasonTags: ["knee", "injury", "msk", "pain", "orthopaedic", "joint"],
  });
  // Ormeau Health Centre — GP Practice (general + knee/injury)
  seedAppointmentSlot({
    id: "ormeau-gp-tomorrow-1",
    doctorRegNumber: "GMC4756091",
    doctorName: "Dr. Aisling Donaghy",
    doctorEmail: "aisling.donaghy@ormeauhc.hscni.net",
    specialty: "General Practice",
    clinic: "Ormeau Health Centre, 120 Ormeau Road, Belfast",
    dayOffset: 1,
    hour: 10,
    reasonTags: ["knee", "injury", "pain", "general", "gp"],
  });
  // Royal Victoria Hospital — A&E / Trauma
  seedAppointmentSlot({
    id: "rvh-ae-tomorrow-1",
    doctorRegNumber: "GMC4921847",
    doctorName: "Dr. Chidi Okonkwo",
    doctorEmail: "chidi.okonkwo@belfasttrust.hscni.net",
    specialty: "Emergency Medicine / A&E",
    clinic: "Royal Victoria Hospital, 274 Grosvenor Road, Belfast",
    dayOffset: 1,
    hour: 14,
    reasonTags: ["emergency", "trauma", "injury", "pain", "urgent"],
  });
  // Musgrave Park Hospital — future orthopaedic follow-up
  seedAppointmentSlot({
    id: "musgrave-msk-future-1",
    doctorRegNumber: "GMC5318264",
    doctorName: "Mr. Conor Wilson",
    doctorEmail: "conor.wilson@belfasttrust.hscni.net",
    specialty: "Orthopaedics / MSK",
    clinic: "Musgrave Park Hospital, 20 Stockmans Lane, Belfast",
    dayOffset: 3,
    hour: 14,
    reasonTags: ["knee", "injury", "msk", "pain", "orthopaedic", "joint", "follow-up"],
  });
  // Mater Hospital — general medicine slot
  seedAppointmentSlot({
    id: "mater-gen-future-1",
    doctorRegNumber: "GMC6187432",
    doctorName: "Dr. Roisin McAlister",
    doctorEmail: "roisin.mcalister@belfasttrust.hscni.net",
    specialty: "General Medicine / Respiratory",
    clinic: "Mater Infirmorum Hospital, 45-51 Crumlin Road, Belfast",
    dayOffset: 2,
    hour: 11,
    reasonTags: ["general", "respiratory", "breathing", "chest", "cough"],
  });

  setAppConfig("demo.seededAt", new Date().toISOString());

  return {
    patients: DEMO_PATIENTS.length,
    clinicians: DEMO_CLINICIANS.length,
    appointmentSlots: 5,
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
