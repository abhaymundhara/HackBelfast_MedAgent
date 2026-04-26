import Image from "next/image";
import { cookies } from "next/headers";
import QRCode from "qrcode";

import { validatePatientJwt } from "@/lib/auth/patientAuth";
import {
  getAppointment,
  getPatientSummary,
  listAuditEvents,
  listDoctorRegistry,
  listSharedRecords,
} from "@/lib/db";
import { sha256Hash } from "@/lib/crypto";
import { RevokeShareButton } from "@/components/app/revoke-share-button";
import { DashboardRefresher } from "@/components/landing/dashboard-refresher";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { getMedAgentPhone } from "@/lib/contactPhone";
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

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEMO_PATIENT_ID = "sarah-bennett";

export default async function PatientDashboardPage() {
  const token = cookies().get("patient_token")?.value;
  const validated = token ? validatePatientJwt(token) : null;
  const visiblePatientId =
    validated?.valid && validated.patientId ? validated.patientId : null;
  const patientId = visiblePatientId ?? DEMO_PATIENT_ID;

  const session = { patientId } as { patientId: string };

  const events = listAuditEvents(session.patientId);
  const shares = listSharedRecords(session.patientId);
  const summary = getPatientSummary(session.patientId);
  const patientJurisdiction =
    summary?.demographics?.homeJurisdiction ?? "unknown";
  const doctorInfoByHash = buildDoctorInfoByHash();
  const uniqueDoctors = new Set(events.map((e) => e.doctorHash)).size;
  const lastAccess = events.length > 0 ? events[0]?.createdAt : null;

  const medagentPhone = getMedAgentPhone();
  const qrTarget = `sms:${medagentPhone}?body=${encodeURIComponent(
    `Patient ${session.patientId} — emergency access request`,
  )}`;
  const qrDataUrl = await QRCode.toDataURL(qrTarget, {
    margin: 1,
    width: 192,
  });

  return (
    <div className="landing-root">
      <DashboardRefresher />
      <SiteNav />
      <main className="dashb-page">
        <div className="dashb-shell">
          <div className="dashb-head">
            <div>
              <span className="eyebrow">Patient portal</span>
              <h1>Patient dashboard</h1>
              {visiblePatientId ? (
                <div className="sub">
                  Patient ID: {visiblePatientId} · Jurisdiction:{" "}
                  {patientJurisdiction}
                </div>
              ) : null}
            </div>
            <form action="/patient/login">
              <button type="submit" className="dashb-logout">
                Log out
              </button>
            </form>
          </div>

          <div className="dashb-stats">
            <div className="dashb-stat">
              <div className="dashb-stat-label">Total interactions</div>
              <div className="dashb-stat-value">{events.length}</div>
            </div>
            <div className="dashb-stat">
              <div className="dashb-stat-label">Unique doctors</div>
              <div className="dashb-stat-value">{uniqueDoctors}</div>
            </div>
            <div className="dashb-stat">
              <div className="dashb-stat-label">Last access</div>
              <div
                className="dashb-stat-value"
                style={{ fontSize: 14, marginTop: 6 }}
              >
                {lastAccess
                  ? new Date(lastAccess).toLocaleString()
                  : "No accesses yet"}
              </div>
            </div>
          </div>

          <div className="dashb-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <section className="dashb-section">
                <div className="dashb-section-head">
                  <h2>Interaction timeline</h2>
                </div>
                {events.length === 0 ? (
                  <div className="dashb-empty">No interactions recorded yet.</div>
                ) : (
                  <div>
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
                          className={`dashb-row${isEmergency ? " dashb-row-emergency" : ""}`}
                        >
                          <div className="dashb-row-main">
                            <div className="dashb-row-title">
                              <span style={{ textTransform: "capitalize" }}>
                                {getInteractionType(
                                  event.payload,
                                  event.eventType,
                                )}
                              </span>
                              {isEmergency ? (
                                <span className="dashb-tag dashb-tag-emergency">
                                  EMERGENCY
                                </span>
                              ) : event.decision ? (
                                <span
                                  className={`dashb-tag ${
                                    event.decision === "allow"
                                      ? "dashb-tag-allow"
                                      : "dashb-tag-deny"
                                  }`}
                                >
                                  {event.decision.toUpperCase()}
                                </span>
                              ) : null}
                              {isCrossBorder && (
                                <span className="dashb-tag dashb-tag-cross">
                                  CROSS-BORDER
                                </span>
                              )}
                            </div>
                            <div className="dashb-row-meta">
                              {doctorInfo?.name ??
                                `Doctor ${event.doctorHash.slice(0, 12)}…`}{" "}
                              · {event.jurisdiction} ·{" "}
                              {new Date(event.createdAt).toLocaleString()}
                            </div>
                            <div className="dashb-row-meta">
                              Fields: {getFieldsAccessed(event.payload)}
                            </div>
                          </div>
                          <div>
                            {solscanUrl ? (
                              <a
                                href={solscanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="dashb-tag dashb-tag-blue"
                                style={{
                                  textDecoration: "none",
                                  padding: "5px 12px",
                                }}
                              >
                                Verified on Solana
                              </a>
                            ) : (
                              <span className="dashb-tag dashb-tag-grey">
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

              <section className="dashb-section">
                <div className="dashb-section-head">
                  <h2>Live record shares</h2>
                  <div className="sub">
                    Revocation blocks future live access only. It cannot erase
                    data already viewed or downloaded.
                  </div>
                </div>
                {shares.length === 0 ? (
                  <div className="dashb-empty">No live shares yet.</div>
                ) : (
                  <div>
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
                        <div className="dashb-row" key={share.id}>
                          <div className="dashb-row-main">
                            <div className="dashb-row-title">
                              {scope} shared with {share.doctor_name}
                            </div>
                            <div className="dashb-row-meta">
                              {appointment
                                ? `${appointment.clinic} · ${new Date(appointment.startsAt).toLocaleString()}`
                                : share.doctor_email}
                            </div>
                            <div className="dashb-row-meta">
                              Status: {share.status} · Expires{" "}
                              {new Date(share.expires_at).toLocaleString()}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <span
                              className={`dashb-tag ${
                                isActive
                                  ? "dashb-tag-allow"
                                  : "dashb-tag-grey"
                              }`}
                            >
                              {isActive ? "LIVE" : share.status.toUpperCase()}
                            </span>
                            {isActive ? (
                              <RevokeShareButton shareId={share.id} />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside className="dashb-aside">
              <div className="dashb-card">
                <h2>Clinician QR</h2>
                <p>
                  Scan to text MedAgent ({medagentPhone}) about this patient on
                  iMessage.
                </p>
                <Image
                  src={qrDataUrl}
                  alt={`Open iMessage to MedAgent ${medagentPhone}`}
                  className="dashb-qr-image"
                  width={192}
                  height={192}
                  unoptimized
                />
              </div>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
