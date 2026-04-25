import { pathToFileURL } from "url";

import { config } from "dotenv";

import { seedDemo } from "@/scripts/seed-demo";
import { createAuditEvent, getDb, getPatientRow } from "@/lib/db";
import { sha256Hash } from "@/lib/crypto";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";

config({ path: ".env.local" });
config();

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function seedDemoAuditTrail() {
  await seedDemo();

  const patient = getPatientRow("sarah-bennett");
  if (!patient) {
    console.error("Patient sarah-bennett not found after seeding");
    process.exit(1);
  }

  const murphy = DEMO_CLINICIANS.find((c) => c.id === "dr-murphy")!;
  const okonkwo = DEMO_CLINICIANS.find((c) => c.id === "dr-okonkwo")!;
  const emergency = DEMO_CLINICIANS.find((c) => c.id === "unknown-emergency")!;

  const events = [
    {
      id: "demo-evt-001",
      requestId: "demo-req-001",
      patientId: "sarah-bennett",
      eventType: "access_decision" as const,
      decision: "allow" as const,
      doctorHash: sha256Hash(murphy.requesterId),
      patientHash: patient.patient_hash,
      jurisdiction: "ROI",
      tokenExpiry: hoursAgo(-4),
      chainRef: "local-solana:demo-req-001:" + Date.now(),
      chainSequence: null,
      chainTimestamp: hoursAgo(6),
      payload: {
        event_type: "access_decision" as const,
        request_id: "demo-req-001",
        doctor_hash: sha256Hash(murphy.requesterId),
        patient_hash: patient.patient_hash,
        jurisdiction: "ROI",
        decision: "allow" as const,
        token_expiry: hoursAgo(-4),
        timestamp: hoursAgo(6),
        interaction_type: "access",
        summary_hash: sha256Hash("Emergency summary requested for cross-border patient"),
        fields_accessed: "allergies,medications,conditions,emergencyContact",
      },
      createdAt: hoursAgo(6),
    },
    {
      id: "demo-evt-002",
      requestId: "demo-req-002",
      patientId: "sarah-bennett",
      eventType: "token_issued" as const,
      decision: "allow" as const,
      doctorHash: sha256Hash(okonkwo.requesterId),
      patientHash: patient.patient_hash,
      jurisdiction: "NI",
      tokenExpiry: hoursAgo(-1),
      chainRef: "local-solana:demo-req-002:" + Date.now(),
      chainSequence: null,
      chainTimestamp: hoursAgo(3),
      payload: {
        event_type: "token_issued" as const,
        request_id: "demo-req-002",
        doctor_hash: sha256Hash(okonkwo.requesterId),
        patient_hash: patient.patient_hash,
        jurisdiction: "NI",
        decision: "allow" as const,
        token_expiry: hoursAgo(-1),
        timestamp: hoursAgo(3),
        interaction_type: "consultation",
        summary_hash: sha256Hash("A&E consultation for syncope follow-up"),
        fields_accessed: "allergies,medications,conditions,alerts,recentDischarge",
      },
      createdAt: hoursAgo(3),
    },
    {
      id: "demo-evt-003",
      requestId: "demo-req-003",
      patientId: "sarah-bennett",
      eventType: "access_decision" as const,
      decision: "allow" as const,
      doctorHash: sha256Hash(emergency.requesterId),
      patientHash: patient.patient_hash,
      jurisdiction: "unknown",
      tokenExpiry: hoursAgo(0),
      chainRef: "local-solana:demo-req-003:" + Date.now(),
      chainSequence: null,
      chainTimestamp: hoursAgo(1),
      payload: {
        event_type: "access_decision" as const,
        request_id: "demo-req-003",
        doctor_hash: sha256Hash(emergency.requesterId),
        patient_hash: patient.patient_hash,
        jurisdiction: "unknown",
        decision: "allow" as const,
        token_expiry: hoursAgo(0),
        timestamp: hoursAgo(1),
        interaction_type: "access",
        summary_hash: sha256Hash("Emergency break-glass access"),
        fields_accessed: "allergies,medications,alerts",
      },
      createdAt: hoursAgo(1),
    },
    {
      id: "demo-evt-004",
      requestId: "demo-req-004",
      patientId: "sarah-bennett",
      eventType: "access_decision" as const,
      decision: "deny" as const,
      doctorHash: sha256Hash("unknown-requester-xyz"),
      patientHash: patient.patient_hash,
      jurisdiction: "NI",
      tokenExpiry: null,
      chainRef: "local-solana:demo-req-004:" + Date.now(),
      chainSequence: null,
      chainTimestamp: hoursAgo(0.5),
      payload: {
        event_type: "access_decision" as const,
        request_id: "demo-req-004",
        doctor_hash: sha256Hash("unknown-requester-xyz"),
        patient_hash: patient.patient_hash,
        jurisdiction: "NI",
        decision: "deny" as const,
        token_expiry: null,
        timestamp: hoursAgo(0.5),
        interaction_type: "access",
        fields_accessed: "",
      },
      createdAt: hoursAgo(0.5),
    },
  ];

  const db = getDb();
  for (const evt of events) {
    const exists = db
      .prepare("SELECT id FROM audit_events WHERE id = ?")
      .get(evt.id);
    if (exists) continue;

    createAuditEvent({
      id: evt.id,
      requestId: evt.requestId,
      patientId: evt.patientId,
      eventType: evt.eventType,
      decision: evt.decision,
      doctorHash: evt.doctorHash,
      patientHash: evt.patientHash,
      jurisdiction: evt.jurisdiction,
      tokenExpiry: evt.tokenExpiry,
      payload: evt.payload,
      chainRef: evt.chainRef,
      chainSequence: evt.chainSequence,
      chainTimestamp: evt.chainTimestamp,
    });
  }

  console.log("Demo flow seeded:");
  console.log(`  - ${events.length} audit events for sarah-bennett`);
  console.log("  - Events: ROI doctor access, NI consultation, emergency break-glass, denied unknown");
}

async function main() {
  await seedDemoAuditTrail();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
