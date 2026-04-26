"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const PATIENT = {
  name: "Aoife O'Connor",
  initials: "AO",
  dob: "1992-04-17",
  mrn: "MRN-7741-IE",
  bloodType: "O+",
  allergies: "Penicillin",
  pdf: {
    name: "medical-record-2026.pdf",
    size: "1.2 MB",
    href: "#",
  },
};

const UPCOMING = [
  {
    day: "12",
    month: "May",
    title: "Cardiology consult — Dr. Murphy",
    sub: "Belfast City Hospital · 09:30",
    status: "Confirmed",
  },
  {
    day: "03",
    month: "Jun",
    title: "Annual check-up — Dr. Hayes",
    sub: "Royal Victoria · 14:00",
    status: "Pending",
  },
];

const PAST = [
  {
    day: "21",
    month: "Mar",
    title: "Bloodwork panel",
    sub: "Mater Misericordiae · Completed",
  },
  {
    day: "08",
    month: "Feb",
    title: "GP follow-up — Dr. Hayes",
    sub: "Royal Victoria · Completed",
  },
  {
    day: "14",
    month: "Jan",
    title: "MRI scan — neurology",
    sub: "Beaumont Hospital · Completed",
  },
];

export default function PortalDashboardPage() {
  const router = useRouter();

  return (
    <div className="portal-shell">
      <div className="portal-topbar">
        <div className="portal-user">
          <div className="portal-avatar">{PATIENT.initials}</div>
          <div className="portal-user-meta">
            <div className="name">{PATIENT.name}</div>
            <div className="role">Patient · {PATIENT.mrn}</div>
          </div>
        </div>
        <button
          className="portal-signout"
          onClick={() => router.push("/portal/login")}
        >
          Sign out
        </button>
      </div>

      <div className="portal-card portal-hero-banner">
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2>Welcome back, {PATIENT.name.split(" ")[0]}.</h2>
          <p>Pulled from your last MedAgent conversation · synced now.</p>
        </div>
        <div className="portal-hero-tag">
          <span className="live" /> Live · synced
        </div>
      </div>

      <div className="portal-grid">
        <section className="portal-card portal-section">
          <h3>Personal information</h3>
          <p className="section-sub">From verified MedAgent chat history</p>
          <div className="portal-info-rows">
            <div className="portal-info">
              <div className="lbl">Full name</div>
              <div className="val">{PATIENT.name}</div>
            </div>
            <div className="portal-info">
              <div className="lbl">Date of birth</div>
              <div className="val">{PATIENT.dob}</div>
            </div>
            <div className="portal-info">
              <div className="lbl">Blood type</div>
              <div className="val">{PATIENT.bloodType}</div>
            </div>
            <div className="portal-info">
              <div className="lbl">Allergies</div>
              <div className="val">{PATIENT.allergies}</div>
            </div>
          </div>

          <Link href={PATIENT.pdf.href} className="portal-pdf">
            <div className="portal-pdf-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="9" y1="17" x2="15" y2="17" />
              </svg>
            </div>
            <div className="portal-pdf-meta">
              <div className="nm">{PATIENT.pdf.name}</div>
              <div className="sz">PDF · {PATIENT.pdf.size}</div>
            </div>
            <div className="portal-pdf-action">View →</div>
          </Link>
        </section>

        <section className="portal-card portal-section">
          <h3>Upcoming appointments</h3>
          <p className="section-sub">Synced via MedAgent · {UPCOMING.length} scheduled</p>
          <div className="portal-appt-list">
            {UPCOMING.length === 0 && (
              <div className="portal-empty">No upcoming appointments</div>
            )}
            {UPCOMING.map((a, i) => (
              <div key={i} className="portal-appt">
                <div className="portal-appt-date">
                  <div className="d">{a.day}</div>
                  <div className="m">{a.month}</div>
                </div>
                <div className="portal-appt-meta">
                  <div className="t">{a.title}</div>
                  <div className="s">{a.sub}</div>
                </div>
                <div className="portal-appt-pill upcoming">{a.status}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="portal-card portal-section"
          style={{ gridColumn: "1 / -1" }}
        >
          <h3>Past appointments</h3>
          <p className="section-sub">Last 90 days · {PAST.length} visits</p>
          <div className="portal-appt-list">
            {PAST.length === 0 && (
              <div className="portal-empty">No past appointments</div>
            )}
            {PAST.map((a, i) => (
              <div key={i} className="portal-appt">
                <div className="portal-appt-date">
                  <div className="d">{a.day}</div>
                  <div className="m">{a.month}</div>
                </div>
                <div className="portal-appt-meta">
                  <div className="t">{a.title}</div>
                  <div className="s">{a.sub}</div>
                </div>
                <div className="portal-appt-pill past">Completed</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
