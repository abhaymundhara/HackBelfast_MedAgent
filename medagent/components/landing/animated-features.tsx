"use client";

import { motion, type Variants } from "framer-motion";
import { FadeIn } from "@/components/landing/motion";

const features = [
  {
    title: "iMessage native",
    body: "Blue bubbles. Group threads. Read receipts. The interface clinicians already use 200 times a day.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M21 12c0 4.97-4.03 9-9 9-1.5 0-2.92-.36-4.16-1L3 21l1.13-4.5C3.4 15.18 3 13.64 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9z" />
      </svg>
    ),
  },
  {
    title: "Patient consent loop",
    body: "Cross-border requests pause. Patient gets a same-thread prompt. YES, NO, or silence \u2014 agent honours all three.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 3l8 4v6c0 4.5-3.5 7.5-8 8-4.5-.5-8-3.5-8-8V7l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Break-glass aware",
    body: "If the patient can\u2019t consent, only the critical fields needed to keep someone alive are released.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l3 2" />
      </svg>
    ),
  },
  {
    title: "On-chain audit",
    body: "Every request, decision, and grant logged on Solana via our Anchor program \u2014 patient-auditable forever.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="6" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </svg>
    ),
  },
  {
    title: "Time-limited tokens",
    body: "Access tokens auto-expire. 30 minutes for emergency, 5 minutes for break-glass. Defaults safe.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    title: "No PHI on chain",
    body: "Solana stores only hashed metadata: requester, patient hash, jurisdiction, decision, slot. Nothing identifying.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="4" y="11" width="16" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
  },
  {
    title: "Plain-English denials",
    body: "When policy denies access, the response is human-readable. Clinicians know why and what to do next.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6M15 9l-6 6" />
      </svg>
    ),
  },
  {
    title: "Patient revoke",
    body: "Reply STOP at any time to terminate an active session. Tokens invalidated. Audit row updated.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9h6v6H9z" />
      </svg>
    ),
  },
];

const gridVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export function AnimatedFeaturesContent() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <FadeIn>
            <span className="eyebrow">Features</span>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="display-md">
              Everything the messy bit of emergency care needs.
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="lead">
              Designed around how clinicians actually work — and around what
              patients have always deserved: visibility into who reads their
              records.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 24 }}>
        <div className="container">
          <motion.div
            className="features features-8"
            variants={gridVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
          >
            {features.map((f) => (
              <motion.div
                className="feat"
                key={f.title}
                variants={cardVariants}
                whileHover={{
                  y: -6,
                  scale: 1.02,
                  transition: { duration: 0.2 },
                }}
              >
                <div className="ic">{f.icon}</div>
                <h4>{f.title}</h4>
                <p>{f.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
