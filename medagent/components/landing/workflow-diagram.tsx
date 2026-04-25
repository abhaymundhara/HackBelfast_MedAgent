"use client";

import { useState } from "react";

type StageId = "request" | "consent" | "audit";

type Stage = {
  id: StageId;
  num: string;
  title: string;
  detail: string;
  pills: string[];
  side: string;
  tone: "blue" | "orange" | "grey";
};

const stages: Stage[] = [
  {
    id: "request",
    num: "01",
    title: "Request",
    detail: "Clinician texts MedAgent. Identity verified, jurisdiction resolved.",
    pills: ["Verify identity", "Geofence"],
    side: "Authenticate",
    tone: "blue",
  },
  {
    id: "consent",
    num: "02",
    title: "Consent",
    detail: "Patient prompted on the same channel. Break-glass when unconscious.",
    pills: ["Patient YES/NO", "Break-glass"],
    side: "Time-limit",
    tone: "orange",
  },
  {
    id: "audit",
    num: "03",
    title: "Audit",
    detail: "Decision logged on Solana. Patient sees who, when, and under what authority.",
    pills: ["Solana log", "Public ledger"],
    side: "Revoke",
    tone: "grey",
  },
];

const stageIcon = (id: StageId) => {
  if (id === "request")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  if (id === "consent")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  );
};

export function WorkflowDiagram() {
  const [active, setActive] = useState<StageId>("consent");

  return (
    <div className="wf">
      <div className="wf-legend">
        <span className="lg lg-blue">REQUEST</span>
        <span className="lg lg-orange">CONSENT</span>
        <span className="lg lg-grey">AUDIT</span>
        <span className="lg-version">v1.0</span>
      </div>

      <div className="wf-canvas" aria-label="MedAgent workflow">
        <svg className="wf-paths" viewBox="0 0 1200 520" preserveAspectRatio="none">
          <defs>
            <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#2563eb" />
            </marker>
            <marker id="arrow-orange" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#f97316" />
            </marker>
            <marker id="arrow-grey" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
            </marker>
          </defs>
          <path
            d="M 240,360 Q 360,300 520,280"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            strokeDasharray="8 6"
            markerEnd="url(#arrow-blue)"
          />
          <path
            d="M 700,280 Q 860,260 1020,300"
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
            strokeDasharray="8 6"
            markerEnd="url(#arrow-orange)"
          />
          <path
            d="M 240,460 L 1080,460"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="6 6"
            markerEnd="url(#arrow-grey)"
          />
        </svg>

        {stages.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`wf-card wf-card-${s.tone}${active === s.id ? " active" : ""} wf-pos-${i}`}
            onMouseEnter={() => setActive(s.id)}
            onFocus={() => setActive(s.id)}
            onClick={() => setActive(s.id)}
          >
            <div className="wf-card-icon">{stageIcon(s.id)}</div>
            <div className="wf-card-meta">
              <span className="wf-num">{s.num}</span>
              <span className="wf-title">{s.title}</span>
            </div>
            <div className="wf-card-detail">{s.detail}</div>
          </button>
        ))}

        <div className="wf-pill wf-pill-blue wf-pos-pill-0a">Verify identity</div>
        <div className="wf-pill wf-pill-blue wf-pos-pill-0b">Geofence</div>
        <div className="wf-pill wf-pill-orange wf-pos-pill-1a">Patient YES/NO</div>
        <div className="wf-pill wf-pill-orange wf-pos-pill-1b">Break-glass</div>
        <div className="wf-pill wf-pill-grey wf-pos-pill-2a">Solana log</div>
        <div className="wf-pill wf-pill-grey wf-pos-pill-2b">Public ledger</div>

        <div className="wf-pill wf-pill-side wf-pos-side-0">Authenticate</div>
        <div className="wf-pill wf-pill-side wf-pos-side-1">Time-limit</div>
        <div className="wf-pill wf-pill-side wf-pos-side-2">Revoke</div>
      </div>

      <div className="wf-foot">
        <span>3 STAGES · 9 ACTIONS</span>
        <span className="wf-status">
          <span className="wf-dot" /> WORKFLOW ACTIVE
        </span>
      </div>
    </div>
  );
}
