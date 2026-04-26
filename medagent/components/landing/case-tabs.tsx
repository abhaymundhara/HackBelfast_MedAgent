"use client";

import { useState } from "react";

type CaseId = "ae" | "gp" | "first" | "patient";

type CasePanel = {
  id: CaseId;
  tab: string;
  label: string;
  heading: string;
  body: string;
  bullets: string[];
  quote: string;
};

const cases: CasePanel[] = [
  {
    id: "ae",
    tab: "A&E clinicians",
    label: "A&E clinicians",
    heading: "The patient just walked in.",
    body: "You're at Royal Victoria. The patient is mid-stroke, lives in Dundalk, and their record is in HSE. There's no time to fax.",
    bullets: [
      "Critical fields back in seconds",
      "Allergies, anticoagulants, recent admissions surfaced first",
      "Patient prompted on the same channel if consent is needed",
      "Every access logged on Solana",
    ],
    quote: "Need full record for SARAHB — query stroke history, MR was 14 mins ago.",
  },
  {
    id: "gp",
    tab: "Cross-border GPs",
    label: "Cross-border GPs",
    heading: "Routine, but across the border.",
    body: "You're a GP in Newry seeing a patient who lives in Belfast. The visit is routine but the record is on the other side.",
    bullets: [
      "Patient consent prompt fires automatically",
      "Time-limited access window with field-level scoping",
      "Plain English denial reasons when policy doesn't permit",
      "Works directly on iMessage — no app to install",
    ],
    quote: "Routine review for OMARH, asking about recent meds and BP trend.",
  },
  {
    id: "first",
    tab: "First responders",
    label: "First responders",
    heading: "Roadside, no ID, no time.",
    body: "You're an NIAS paramedic on the A1. Patient is unconscious. iMessage on your work phone is all you have.",
    bullets: [
      "Break-glass releases only critical fields",
      "Sub-second iMessage delivery even on flaky 4G",
      "Emergency contact and allergies surface first",
      "Patient sees the access the moment they wake",
    ],
    quote: "BREAK GLASS — patient SARAHB unconscious, RTA on A1, no ID.",
  },
  {
    id: "patient",
    tab: "Patients",
    label: "Patients",
    heading: "You stay in the loop. Always.",
    body: "You shouldn't have to chase your own records — or wonder who opened them.",
    bullets: [
      "Approve cross-border requests by replying YES or NO",
      "Confirmation message every time your record is opened",
      "Public Solana audit page for full history",
      "Revoke an active session by replying STOP",
    ],
    quote: "Dr. Okonkwo (NHS NI) is requesting access. Reply YES to approve.",
  },
];

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export function CaseTabs() {
  const [active, setActive] = useState<CaseId>("ae");
  const panel = cases.find((c) => c.id === active) ?? cases[0];

  return (
    <div className="cases">
      <div className="case-tabs" role="tablist">
        {cases.map((c) => (
          <button
            key={c.id}
            role="tab"
            type="button"
            className="case-tab"
            aria-selected={active === c.id}
            onClick={() => setActive(c.id)}
          >
            {c.tab}
            <span className="arrow">→</span>
          </button>
        ))}
      </div>
      <div className="case-panel">
        <div className="case-content">
          <div className="label">{panel.label}</div>
          <h3>{panel.heading}</h3>
          <p>{panel.body}</p>
          <ul>
            {panel.bullets.map((b) => (
              <li key={b}>
                <Check />
                {b}
              </li>
            ))}
          </ul>
          <div className="case-quote">{panel.quote}</div>
        </div>
      </div>
    </div>
  );
}
