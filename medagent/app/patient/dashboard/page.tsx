import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { validatePatientJwt } from "@/lib/auth/patientAuth";
import {
  getAppointment,
  getPatientAccountByPatientId,
  getPatientSummary,
  listAuditEvents,
  listDoctorRegistry,
  listSharedRecords,
} from "@/lib/db";
import { sha256Hash } from "@/lib/crypto";
import { RevokeShareButton } from "@/components/app/revoke-share-button";
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

type DoctorInfo = { name: string; jurisdiction: string | null };

function buildDoctorInfoByHash() {
  const info = new Map<string, DoctorInfo>();
  const doctors = listDoctorRegistry();

  for (const doctor of doctors) {
    info.set(sha256Hash(doctor.reg_number), {
      name: doctor.name,
      jurisdiction: doctor.jurisdiction,
    });
  }

  for (const persona of DEMO_CLINICIANS) {
    const doctor =
      doctors.find((c) => c.reg_number === persona.requesterId) ?? null;
    const label = doctor?.name ?? persona.requesterLabel;
    const jurisdiction = doctor?.jurisdiction ?? null;
    info.set(sha256Hash(persona.id), { name: label, jurisdiction });
    info.set(sha256Hash(persona.requesterId), { name: label, jurisdiction });
  }

  return info;
}

function isEmergencyAccess(doctorHash: string) {
  const emergencyPersona = DEMO_CLINICIANS.find(
    (c) => c.id === "unknown-emergency",
  );
  if (!emergencyPersona) return false;
  return (
    doctorHash === sha256Hash(emergencyPersona.id) ||
    doctorHash === sha256Hash(emergencyPersona.requesterId)
  );
}

const ESTIMATED_COST_PER_EVENT_USD = 0.001;

export default async function PatientDashboardPage() {
  const token = cookies().get("patient_token")?.value;
  if (!token) redirect("/patient/login");

  const session = validatePatientJwt(token);
  if (!session.valid || !session.patientId) redirect("/patient/login");

  const account = getPatientAccountByPatientId(session.patientId);
  if (!account) redirect("/patient/login");

  const events = listAuditEvents(session.patientId);
  const shares = listSharedRecords(session.patientId);
  const summary = getPatientSummary(session.patientId);
  const patientJurisdiction =
    summary?.demographics?.homeJurisdiction ?? "unknown";
  const doctorInfoByHash = buildDoctorInfoByHash();
  const uniqueDoctors = new Set(events.map((e) => e.doctorHash)).size;
  const lastAccess = events.length > 0 ? events[0]?.createdAt : null;
  const onChainCount = events.filter(
    (e) => !e.chainRef.startsWith("local-solana:"),
  ).length;
  const totalCostUsd = events.length * ESTIMATED_COST_PER_EVENT_USD;

  const qrPayload = JSON.stringify({
    patientId: session.patientId,
    solanaLogPda: account.solana_log_pda,
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    margin: 1,
    width: 192,
  });

  return (
    <main className="min-h-[calc(100vh-3.5rem)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Patient Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Patient ID: {session.patientId} &middot; Jurisdiction:{" "}
              {patientJurisdiction}
            </p>
          </div>
          <form action="/patient/login">
            <button className="text-sm text-slate-500 hover:text-slate-700">
              Log out
            </button>
          </form>
        </div>

        {/* Stats cards — 2 cols mobile, 4 cols desktop */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div className="rounded-xl border bg-white p-3 shadow-sm sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">
              Total Interactions
            </p>
            <p className="text-2xl font-semibold sm:text-3xl">
              {events.length}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-sm sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">Unique Doctors</p>
            <p className="text-2xl font-semibold sm:text-3xl">
              {uniqueDoctors}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-sm sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">Last Access</p>
            <p className="mt-1 text-xs font-medium sm:text-sm">
              {lastAccess
                ? new Date(lastAccess).toLocaleString()
                : "No accesses yet"}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-sm sm:p-4">
            <p className="text-xs text-slate-500 sm:text-sm">
              Solana Audit Cost
            </p>
            <p className="text-2xl font-semibold sm:text-3xl">
              ${totalCostUsd.toFixed(4)}
            </p>
            <p className="text-[10px] text-slate-400">
              {onChainCount}/{events.length} on-chain &middot; ~$
              {ESTIMATED_COST_PER_EVENT_USD}/event
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
          <div className="space-y-6">
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
                  const solscanUrl = !isLocal
                    ? getSolscanTxUrl(event.chainRef)
                    : null;
                  const isEmergency = isEmergencyAccess(event.doctorHash);
                  const doctorInfo = doctorInfoByHash.get(event.doctorHash);
                  const doctorJurisdiction = doctorInfo?.jurisdiction;
                  const isCrossBorder =
                    doctorJurisdiction &&
                    patientJurisdiction !== "unknown" &&
                    doctorJurisdiction !== "unknown" &&
                    doctorJurisdiction !== patientJurisdiction;

                  return (
                    <div
                      key={event.id}
                      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                        isEmergency ? "bg-red-50/50" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium capitalize text-slate-900">
                          {getInteractionType(event.payload, event.eventType)}

                          {/* Decision badge */}
                          {isEmergency ? (
                            <span className="ml-2 inline-block rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                              Emergency Access
                            </span>
                          ) : event.decision ? (
                            <span
                              className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                event.decision === "allow"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {event.decision}
                            </span>
                          ) : null}

                          {/* Cross-border badge */}
                          {isCrossBorder && (
                            <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Cross-border
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {doctorInfo?.name ??
                            `Doctor ${event.doctorHash.slice(0, 12)}...`}{" "}
                          &middot; {event.jurisdiction} &middot;{" "}
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">
                          Fields: {getFieldsAccessed(event.payload)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
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
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-medium text-slate-900">
                Live Record Shares
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Revocation blocks future live access only. It cannot erase data already viewed or downloaded.
              </p>
            </div>
            {shares.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No live shares yet.
              </div>
            ) : (
              <div className="divide-y">
                {shares.map((share) => {
                  const appointment = share.appointment_id
                    ? getAppointment(share.appointment_id)
                    : null;
                  const isActive =
                    share.status === "active" &&
                    new Date(share.expires_at) > new Date();
                  const scope =
                    share.share_scope === "full_record"
                      ? "Full medical record"
                      : "Selected fields";
                  return (
                    <div
                      key={share.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {scope} shared with {share.doctor_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {appointment
                            ? `${appointment.clinic} · ${new Date(appointment.startsAt).toLocaleString()}`
                            : share.doctor_email}
                        </p>
                        <p className="text-xs text-slate-500">
                          Status: {share.status} · Expires{" "}
                          {new Date(share.expires_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            isActive
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {isActive ? "Live" : share.status}
                        </span>
                        {isActive ? <RevokeShareButton shareId={share.id} /> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-900">
                Solana Log PDA
              </h2>
              <p className="mt-1 break-all font-mono text-xs text-slate-600">
                {account.solana_log_pda ??
                  "Pending first configured on-chain write"}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-900">
                Clinician QR
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Patient ID + Solana PDA for demo scanning.
              </p>
              <Image
                src={qrDataUrl}
                alt="Patient QR code"
                width={192}
                height={192}
                className="mt-3 rounded-lg border"
                unoptimized
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
