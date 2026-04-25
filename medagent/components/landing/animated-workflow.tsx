"use client";

import { useState, useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";

type StageId = "request" | "consent" | "audit";

type Stage = {
  id: StageId;
  num: string;
  title: string;
  detail: string;
  tone: "blue" | "orange" | "grey";
};

const stages: Stage[] = [
  {
    id: "request",
    num: "01",
    title: "Request",
    detail:
      "Clinician texts MedAgent. Identity verified, jurisdiction resolved.",
    tone: "blue",
  },
  {
    id: "consent",
    num: "02",
    title: "Consent",
    detail:
      "Patient prompted on the same channel. Break-glass when unconscious.",
    tone: "orange",
  },
  {
    id: "audit",
    num: "03",
    title: "Audit",
    detail:
      "Decision logged on Solana. Patient sees who, when, and under what authority.",
    tone: "grey",
  },
];

const stageIcon = (id: StageId) => {
  if (id === "request")
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  if (id === "consent")
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21z" />
      </svg>
    );
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  );
};

const pills: Array<{
  label: string;
  tone: string;
  posClass: string;
}> = [
  { label: "Verify identity", tone: "blue", posClass: "wf-pos-pill-0a" },
  { label: "Geofence", tone: "blue", posClass: "wf-pos-pill-0b" },
  { label: "Patient YES/NO", tone: "orange", posClass: "wf-pos-pill-1a" },
  { label: "Break-glass", tone: "orange", posClass: "wf-pos-pill-1b" },
  { label: "Solana log", tone: "grey", posClass: "wf-pos-pill-2a" },
  { label: "Public ledger", tone: "grey", posClass: "wf-pos-pill-2b" },
];

const sidePills: Array<{ label: string; posClass: string }> = [
  { label: "Authenticate", posClass: "wf-pos-side-0" },
  { label: "Time-limit", posClass: "wf-pos-side-1" },
  { label: "Revoke", posClass: "wf-pos-side-2" },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      delay: 0.3 + i * 0.2,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const pillVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.9 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.8 + i * 0.1,
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  }),
};

const pathStrokes: Record<string, string> = {
  blue: "#2563eb",
  orange: "#f97316",
  grey: "#94a3b8",
};

const svgPaths = [
  {
    d: "M 240,360 Q 360,300 520,280",
    stroke: pathStrokes.blue,
    marker: "arrow-blue",
  },
  {
    d: "M 700,280 Q 860,260 1020,300",
    stroke: pathStrokes.orange,
    marker: "arrow-orange",
  },
  {
    d: "M 240,460 L 1080,460",
    stroke: pathStrokes.grey,
    marker: "arrow-grey",
  },
];

export function AnimatedWorkflow() {
  const [active, setActive] = useState<StageId>("consent");
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <div className="wf" ref={ref}>
      <motion.div
        className="wf-legend"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : undefined}
        transition={{ duration: 0.5 }}
      >
        <span className="lg lg-blue">REQUEST</span>
        <span className="lg lg-orange">CONSENT</span>
        <span className="lg lg-grey">AUDIT</span>
        <span className="lg-version">v1.0</span>
      </motion.div>

      <div className="wf-canvas" aria-label="MedAgent workflow">
        <svg
          className="wf-paths"
          viewBox="0 0 1200 520"
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id="arrow-blue"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#2563eb" />
            </marker>
            <marker
              id="arrow-orange"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#f97316" />
            </marker>
            <marker
              id="arrow-grey"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
            </marker>
          </defs>

          {svgPaths.map((p, i) => (
            <motion.path
              key={i}
              d={p.d}
              fill="none"
              stroke={p.stroke}
              strokeWidth="2"
              strokeDasharray="8 6"
              markerEnd={`url(#${p.marker})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={
                isInView
                  ? { pathLength: 1, opacity: 1 }
                  : undefined
              }
              transition={{
                duration: 1.2,
                delay: 0.2 + i * 0.3,
                ease: "easeInOut",
              }}
            />
          ))}
        </svg>

        {stages.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            className={`wf-card wf-card-${s.tone}${active === s.id ? " active" : ""} wf-pos-${i}`}
            onMouseEnter={() => setActive(s.id)}
            onFocus={() => setActive(s.id)}
            onClick={() => setActive(s.id)}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate={isInView ? "show" : undefined}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
          >
            <div className="wf-card-icon">{stageIcon(s.id)}</div>
            <div className="wf-card-meta">
              <span className="wf-num">{s.num}</span>
              <span className="wf-title">{s.title}</span>
            </div>
            <div className="wf-card-detail">{s.detail}</div>
          </motion.button>
        ))}

        {pills.map((p, i) => (
          <motion.div
            key={p.label}
            className={`wf-pill wf-pill-${p.tone} ${p.posClass}`}
            custom={i}
            variants={pillVariants}
            initial="hidden"
            animate={isInView ? "show" : undefined}
          >
            {p.label}
          </motion.div>
        ))}

        {sidePills.map((p, i) => (
          <motion.div
            key={p.label}
            className={`wf-pill wf-pill-side ${p.posClass}`}
            custom={i + pills.length}
            variants={pillVariants}
            initial="hidden"
            animate={isInView ? "show" : undefined}
          >
            {p.label}
          </motion.div>
        ))}
      </div>

      <motion.div
        className="wf-foot"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : undefined}
        transition={{ duration: 0.6, delay: 1.5 }}
      >
        <span>3 STAGES &middot; 9 ACTIONS</span>
        <span className="wf-status">
          <motion.span
            className="wf-dot"
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(34,197,94,0.4)",
                "0 0 0 6px rgba(34,197,94,0)",
                "0 0 0 0 rgba(34,197,94,0)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ display: "inline-block" }}
          />{" "}
          WORKFLOW ACTIVE
        </span>
      </motion.div>
    </div>
  );
}
