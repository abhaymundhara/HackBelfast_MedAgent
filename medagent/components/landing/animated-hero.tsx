"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const SMS_HREF = "sms:+447700900099?body=Emergency%20access%20request";

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export function AnimatedHero() {
  return (
    <section className="hero" style={{ position: "relative", overflow: "hidden" }}>
      {/* Ambient dot grid background */}
      <div
        className="hero-grid-bg"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            top: "10%",
            left: "20%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(14,116,144,0.15) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [0.9, 1.1, 0.9],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          style={{
            position: "absolute",
            bottom: "5%",
            right: "15%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
          animate={{
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
      </div>

      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease }}
        >
          <Link href="/how-it-works" className="pill-link">
            <span className="tag">NEW</span>
            <span>Read about our HackBelfast 2026 demo &rarr;</span>
          </Link>
        </motion.div>

        <motion.h1
          className="display"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease }}
        >
          Emergency medical access,
          <br />
          by text message.
        </motion.h1>

        <motion.p
          className="lead"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease }}
        >
          MedAgent is a messaging-first agent for cross-border emergency care on
          the island of Ireland. Clinicians text a request. Patients stay in
          control. Every access is logged on Solana — auditable, PHI-free.
        </motion.p>

        <motion.div
          className="hero-ctas"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease }}
        >
          <Link className="btn btn-primary btn-lg" href={SMS_HREF}>
            Text MedAgent now
            <ArrowRight />
          </Link>
          <Link className="btn btn-ghost btn-lg" href="/how-it-works">
            See how it works
          </Link>
        </motion.div>

        <motion.div
          className="hero-foot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.0, ease }}
        >
          <span>
            <motion.span
              className="dot"
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(34,197,94,0.4)",
                  "0 0 0 8px rgba(34,197,94,0)",
                  "0 0 0 0 rgba(34,197,94,0)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ display: "inline-block" }}
            />
            Live on iMessage
          </span>
          <span>
            <span className="dot dot-blue" />
            WhatsApp + SMS
          </span>
          <span>
            <span className="dot dot-grey" />
            No app &middot; No login
          </span>
        </motion.div>
      </div>
    </section>
  );
}
