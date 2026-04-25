type RecentRow = {
  initials: string;
  tone: "green" | "amber" | "red" | "grey";
  name: string;
  org: string;
  detail: string;
  status: "GRANTED" | "PENDING CONSENT" | "EMERGENCY" | "DENIED";
  time: string;
};

const recentRows: RecentRow[] = [
  {
    initials: "AM",
    tone: "green",
    name: "Dr. Aoife Murphy",
    org: "HSE Ireland",
    detail: "Patient SARAHB · M1 incident",
    status: "GRANTED",
    time: "14:02",
  },
  {
    initials: "CO",
    tone: "amber",
    name: "Dr. Chidi Okonkwo",
    org: "NHS NI",
    detail: "Patient SARAHB · stroke workup",
    status: "PENDING CONSENT",
    time: "13:47",
  },
  {
    initials: "??",
    tone: "grey",
    name: "Roadside clinician",
    org: "unverified",
    detail: "BREAK GLASS · A1 RTA",
    status: "EMERGENCY",
    time: "13:21",
  },
  {
    initials: "CO",
    tone: "red",
    name: "Dr. Chidi Okonkwo",
    org: "NHS NI",
    detail: "Patient OMARH · routine",
    status: "DENIED",
    time: "12:58",
  },
  {
    initials: "AM",
    tone: "green",
    name: "Dr. Aoife Murphy",
    org: "HSE Ireland",
    detail: "Patient LUCIAM · Newry GP",
    status: "GRANTED",
    time: "12:44",
  },
];

const pillClass = (status: RecentRow["status"]) => {
  if (status === "GRANTED") return "pill pill-green";
  if (status === "DENIED") return "pill pill-red";
  return "pill pill-amber";
};

const chartBars: Array<{ h: number; hi?: boolean }> = [
  { h: 30 },
  { h: 42 },
  { h: 35 },
  { h: 55 },
  { h: 48 },
  { h: 78, hi: true },
  { h: 92, hi: true },
  { h: 84, hi: true },
  { h: 60 },
  { h: 52 },
  { h: 68 },
  { h: 88, hi: true },
  { h: 46 },
  { h: 38 },
  { h: 30 },
  { h: 22 },
];

const requesters: Array<{ label: string; pct: number; n: number }> = [
  { label: "RVH", pct: 90, n: 68 },
  { label: "SJH", pct: 74, n: 52 },
  { label: "Mater", pct: 50, n: 35 },
  { label: "NIAS", pct: 38, n: 26 },
  { label: "Daisy", pct: 22, n: 15 },
];

export function DashboardMock() {
  return (
    <div className="dash">
      <div className="dash-head">
        <div className="title">
          MedAgent Console <small>· Audit & activity</small>
        </div>
        <div className="dash-tabs">
          <button type="button" className="dash-tab active">Overview</button>
          <button type="button" className="dash-tab">Requests</button>
          <button type="button" className="dash-tab">Audit log</button>
        </div>
      </div>

      <div className="dash-stats">
        <div className="stat-card">
          <div className="lbl">
            Granted today <span className="delta">+18%</span>
          </div>
          <div className="val">142</div>
        </div>
        <div className="stat-card">
          <div className="lbl">
            Avg response <span className="delta">−0.3s</span>
          </div>
          <div className="val">
            1.8<small>s</small>
          </div>
        </div>
        <div className="stat-card">
          <div className="lbl">
            Logged on-chain <span className="delta">100%</span>
          </div>
          <div className="val">
            142<small>/142</small>
          </div>
        </div>
        <div className="stat-card">
          <div className="lbl">
            Pending consent <span className="delta minus">3</span>
          </div>
          <div className="val">3</div>
        </div>
      </div>

      <div className="dash-row">
        <div className="dash-card">
          <h5>Request activity</h5>
          <div className="sub">Last 24 hours · NI ↔ ROI</div>
          <div className="chart">
            {chartBars.map((b, i) => (
              <div
                key={i}
                className={`bar${b.hi ? " hi" : ""}`}
                style={{ height: `${b.h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="dash-card">
          <h5>Top requesters</h5>
          <div className="sub">Last 7 days</div>
          <div className="hours">
            {requesters.map((r) => (
              <div className="hour-row" key={r.label}>
                <span className="h">{r.label}</span>
                <div className="bar-wrap">
                  <span style={{ width: `${r.pct}%` }} />
                </div>
                <span className="n">{r.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0 }}>
        <div className="recent-head">
          <h5>Recent requests</h5>
          <span className="sub">7 in the last hour</span>
        </div>
        <div className="recent">
          {recentRows.map((r) => (
            <div className="recent-row" key={`${r.initials}-${r.time}`}>
              <div className={`avatar ${r.tone === "green" ? "green" : r.tone === "amber" ? "amber" : r.tone === "red" ? "red" : "grey"}`}>
                {r.initials}
              </div>
              <div>
                <div className="recent-name">
                  {r.name} <span className="recent-sub">· {r.org}</span>
                </div>
                <div className="recent-sub">{r.detail}</div>
              </div>
              <span className={pillClass(r.status)}>{r.status}</span>
              <span className="recent-sub">{r.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
