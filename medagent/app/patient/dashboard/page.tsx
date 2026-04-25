import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { validatePatientJwt } from "@/lib/auth/patientAuth";
import {
  getPatientAccountByPatientId,
  listAuditEvents,
  listDoctorRegistry,
  listSharedRecords,
} from "@/lib/db";
import { sha256Hash } from "@/lib/crypto";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";
import { getSolscanTxUrl } from "@/lib/solana/client";
import { ShareForm } from "@/components/app/share-form";

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

function eventBadge(eventType: string, decision: string | null) {
  if (eventType === "record_shared") {
    return { color: "bg-purple-100 text-purple-700", label: "Shared" };
  }
  if (eventType === "record_accessed") {
    return { color: "bg-blue-100 text-blue-700", label: "Viewed" };
  }
  if (eventType === "share_revoked") {
    return { color: "bg-red-100 text-red-700", label: "Revoked" };
  }
  if (decision === "allow") {
    return { color: "bg-green-100 text-green-700", label: "allow" };
  }
  if (decision === "deny") {
    return { color: "bg-red-100 text-red-700", label: "deny" };
  }
  return null;
}

function shareStatusBadge(status: string, expiresAt: string) {
  if (status === "revoked") {
    return { color: "bg-red-100 text-red-700 border-red-200", label: "Revoked" };
  }
  if (new Date(expiresAt) <= new Date()) {
    return { color: "bg-slate-100 text-slate-500 border-slate-200", label: "Expired" };
  }
  return { color: "bg-green-100 text-green-700 border-green-200", label: "Active" };
}

export default async function PatientDashboardPage() {
  const token = cookies().get("patient_token")?.value;
  if (!token) redirect("/patient/login");

  const session = validatePatientJwt(token);
  if (!session.valid || !session.patientId) redirect("/patient/login");

  const account = getPatientAccountByPatientId(session.patientId);
  if (!account) redirect("/patient/login");

  const events = listAuditEvents(session.patientId);
  const shares = listSharedRecords(session.patientId);
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
            <p className="text-sm text-slate-500">Active Shares</p>
            <p className="text-3xl font-semibold">
              {shares.filter(
                (s) => s.status === "active" && new Date(s.expires_at) > new Date(),
              ).length}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            {/* Share Form */}
            <section className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-medium text-slate-900">
                  Share Your Records
                </h2>
                <p className="text-xs text-slate-500">
                  Create a secure link for a doctor to view selected medical fields
                </p>
              </div>
              <div className="p-4">
                <ShareForm />
              </div>
            </section>

            {/* Shared Records */}
            {shares.length > 0 && (
              <section className="rounded-xl border bg-white shadow-sm">
                <div className="border-b px-4 py-3">
                  <h2 className="text-sm font-medium text-slate-900">
                    Shared Records
                  </h2>
                </div>
                <div className="divide-y">
                  {shares.map((share) => {
                    const badge = shareStatusBadge(share.status, share.expires_at);
                    const fields: string[] = JSON.parse(share.fields_shared);
                    const isLocal =
                      share.share_chain_ref?.startsWith("local-solana:") ?? true;
                    const solscanUrl =
                      share.share_chain_ref && !isLocal
                        ? getSolscanTxUrl(share.share_chain_ref)
                        : null;

                    return (
                      <div
                        key={share.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900">
                              {share.doctor_name}
                            </p>
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {fields.join(", ")} &middot;{" "}
                            {new Date(share.created_at).toLocaleDateString()} &middot;{" "}
                            {share.access_count}/{share.max_access_count} views
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {solscanUrl && (
                            <a
                              href={solscanUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              Solscan
                            </a>
                          )}
                          {share.status === "active" &&
                            new Date(share.expires_at) > new Date() && (
                              <RevokeButton shareId={share.id} />
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Interaction Timeline */}
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
                    const badge = eventBadge(event.eventType, event.decision);
                    return (
                      <div
                        key={event.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium capitalize text-slate-900">
                            {getInteractionType(event.payload, event.eventType)}
                            {badge && (
                              <span
                                className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
                              >
                                {badge.label}
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
                          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-600">
                            Pending confirmation
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Solana Log PDA</p>
              <p className="mt-1 break-all font-mono text-xs">
                {account.solana_log_pda ?? "Awaiting first audit event"}
              </p>
            </div>

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
      </div>
    </main>
  );
}

function RevokeButton({ shareId }: { shareId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const { cookies } = await import("next/headers");
        const token = cookies().get("patient_token")?.value;
        if (!token) return;
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/share/${shareId}/revoke`, {
          method: "POST",
          headers: { Cookie: `patient_token=${token}` },
        });
        const { revalidatePath } = await import("next/cache");
        revalidatePath("/patient/dashboard");
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Revoke
      </button>
    </form>
  );
}
