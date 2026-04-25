"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FadeIn } from "@/components/landing/motion";

const SMS_HREF = "sms:+447700900099?body=Emergency%20access%20request";

const ArrowRight = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export function AnimatedCta() {
  return (
    <section className="cta-final" style={{ position: "relative", overflow: "hidden" }}>
      {/* Ambient gradient background */}
      <motion.div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            top: "-30%",
            left: "30%",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(14,116,144,0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
          animate={{
            x: [0, 40, 0],
            y: [0, -20, 0],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <FadeIn>
          <h2 className="display">Send a text. See what happens.</h2>
        </FadeIn>
        <FadeIn delay={0.15}>
          <p>
            The whole demo runs over your phone&apos;s existing messaging app.
            No installs, no signup, no learning curve.
          </p>
        </FadeIn>
        <FadeIn delay={0.3}>
          <div className="actions">
            <Link className="btn btn-primary btn-lg" href={SMS_HREF}>
              Text MedAgent
              <ArrowRight />
            </Link>
            <Link className="btn btn-ghost btn-lg" href="/how-it-works">
              See how it works
            </Link>
          </div>
        </FadeIn>
        <FadeIn delay={0.4}>
          <div className="foot">
            <span>iMessage &middot; WhatsApp &middot; SMS</span>
            <span>Solana devnet</span>
            <span>Open source</span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
