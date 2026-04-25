import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { validatePatientJwt } from "@/lib/auth/patientAuth";
import {
  getPatientAccountByPatientId,
  listAuditEvents,
  listDoctorRegistry,
} from "@/lib/db";
import { sha256Hash } from "@/lib/crypto";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";
import { getSolscanTxUrl } from "@/lib/solana/client";

function getInteractionType(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "interaction_type" in payload) {
    const value = (payload as { interaction_type?: unknown }).interaction_type;
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback.replace(/_/g, " ");
}

function getFieldsAccessed(payload: unknown) {
  if (payload && typeof payload === "object" && "fields_accessed" in payload) {
    const value = (payload as { fields_accessed?: unknown }).fields_accessed;
    if (typeof value === "string" && value.trim()) return value;
  }
  return "Not recorded";
}

function buildDoctorLabelByHash() {
  const labels = new Map<string, string>();
  const doctors = listDoctorRegistry();

  for (const doctor of doctors) {
    labels.set(sha256Hash(doctor.reg_number), doctor.name);
  }

  for (const persona of DEMO_CLINICIANS) {
    const doctor =
      doctors.find((candidate) => candidate.reg_number === persona.requesterId) ??
      null;
    const label = doctor?.name ?? persona.requesterLabel;
    labels.set(sha256Hash(persona.id), label);
    labels.set(sha256Hash(persona.requesterId), label);
  }

  return labels;
}

export default async function PatientDashboardPage() {
  const token = cookies().get("patient_token")?.value;
  if (!token) redirect("/patient/login");

  const session = validatePatientJwt(token);
  if (!session.valid || !session.patientId) redirect("/patient/login");

  const account = getPatientAccountByPatientId(session.patientId);
  if (!account) redirect("/patient/login");

  const events = listAuditEvents(session.patientId);
  const doctorLabelByHash = buildDoctorLabelByHash();
  const uniqueDoctors = new Set(events.map((event) => event.doctorHash)).size;
  const lastAccess = events.length > 0 ? events[0]?.createdAt : null;
  const qrPayload = JSON.stringify({
    patientId: session.patientId,
    solanaLogPda: account.solana_log_pda,
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 192 });

  return (
    <main className="min-h-[calc(100vh-3.5rem)] px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Patient Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Patient ID: {session.patientId}
            </p>
          </div>
          <form action="/patient/login">
            <button className="text-sm text-slate-500 hover:text-slate-700">
              Log out
            </button>
          </form>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Interactions</p>
            <p className="text-3xl font-semibold">{events.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Unique Doctors</p>
            <p className="text-3xl font-semibold">{uniqueDoctors}</p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Last Access</p>
            <p className="mt-1 text-sm font-medium">
              {lastAccess ? new Date(lastAccess).toLocaleString() : "No accesses yet"}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Solana Log PDA</p>
            <p className="mt-1 break-all font-mono text-xs">
              {account.solana_log_pda ?? "Pending first configured on-chain write"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-medium text-slate-900">
                Interaction Timeline
              </h2>
            </div>
            {events.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No interactions recorded yet.
              </div>
            ) : (
              <div className="divide-y">
                {events.map((event) => {
                  const isLocal = event.chainRef.startsWith("local-solana:");
                  const solscanUrl = !isLocal ? getSolscanTxUrl(event.chainRef) : null;
                  return (
                    <div
                      key={event.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium capitalize text-slate-900">
                          {getInteractionType(event.payload, event.eventType)}
                          {event.decision && (
                            <span
                              className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                event.decision === "allow"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {event.decision}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {doctorLabelByHash.get(event.doctorHash) ??
                            `Doctor hash ${event.doctorHash.slice(0, 18)}…`}{" "}
                          &middot; {event.jurisdiction} &middot; {new Date(event.createdAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">
                          Fields accessed: {getFieldsAccessed(event.payload)}
                        </p>
                      </div>
                      {solscanUrl ? (
                        <a
                          href={solscanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Verified on Solana
                        </a>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                          Local fallback
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium text-slate-900">Clinician QR</h2>
            <p className="mt-1 text-xs text-slate-500">
              Encodes patient ID and the current Solana audit-log PDA for demo scanning.
            </p>
            <Image
              src={qrDataUrl}
              alt="Patient QR code"
              width={192}
              height={192}
              className="mt-4 rounded-lg border"
              unoptimized
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
