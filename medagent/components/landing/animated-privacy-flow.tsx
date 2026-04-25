"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { FadeIn, GlowPulse } from "@/components/landing/motion";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const CHARS = "0123456789abcdef";

interface Field {
  label: string;
  readable: string;
  hash: string;
}

const fields: Field[] = [
  { label: "Patient", readable: "Sarah Bennett, 34", hash: "0x7a3f...c891" },
  { label: "Blood type", readable: "O-negative", hash: "0x2b8d...4fe2" },
  {
    label: "Allergy",
    readable: "Penicillin (anaphylaxis)",
    hash: "0xe91c...a3b7",
  },
  { label: "Medication", readable: "Warfarin 5mg OD", hash: "0x4d2e...8f15" },
  { label: "Alert", readable: "Anticoagulants", hash: "0xb6a0...d2c4" },
  {
    label: "Emergency",
    readable: "John Bennett (spouse)",
    hash: "0x8f7e...1a93",
  },
];

/* ------------------------------------------------------------------ */
/*  useScrambleText hook                                               */
/* ------------------------------------------------------------------ */

function useScrambleText(
  target: string,
  trigger: boolean,
  delay: number = 0
): string {
  const [display, setDisplay] = useState(target.replace(/./g, "\u00A0"));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!trigger) return;

    const len = target.length;
    const totalFrames = len * 3; // 3 frames per character
    let frame = 0;
    let started = false;

    const timeout = setTimeout(() => {
      started = true;
    }, delay);

    const step = () => {
      if (!started) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      const revealed = Math.floor(progress * len);

      let result = "";
      for (let i = 0; i < len; i++) {
        if (i < revealed) {
          result += target[i];
        } else if (i === revealed) {
          result += CHARS[Math.floor(Math.random() * CHARS.length)];
        } else {
          result += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }
      setDisplay(result);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(target);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [trigger, target, delay]);

  return display;
}

/* ------------------------------------------------------------------ */
/*  Scramble field component                                           */
/* ------------------------------------------------------------------ */

function ScrambleField({
  field,
  index,
  trigger,
}: {
  field: Field;
  index: number;
  trigger: boolean;
}) {
  const text = useScrambleText(field.hash, trigger, 800 + index * 250);

  return (
    <div className="pf-field">
      <span className="pf-label">{field.label}</span>
      <span className="pf-value pf-mono">{text}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flowing dots along bridge                                          */
/* ------------------------------------------------------------------ */

const dotVariants: Variants = {
  hidden: { offsetDistance: "0%", opacity: 0 },
  show: (i: number) => ({
    offsetDistance: "100%",
    opacity: [0, 1, 1, 0],
    transition: {
      duration: 2.5,
      delay: 0.8 + i * 0.5,
      repeat: Infinity,
      ease: "linear",
    },
  }),
};

function FlowBridge({ animate }: { animate: boolean }) {
  return (
    <div className="pf-bridge">
      {/* SVG curved path */}
      <svg
        className="pf-bridge-svg"
        viewBox="0 0 120 400"
        fill="none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="pf-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0E7490" stopOpacity="0" />
            <stop offset="30%" stopColor="#0E7490" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#0E7490" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#0E7490" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0E7490" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M 60,20 C 60,120 60,280 60,380"
          stroke="url(#pf-grad)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          initial={{ pathLength: 0 }}
          animate={animate ? { pathLength: 1 } : undefined}
          transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
        />
      </svg>

      {/* Flowing dots */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="pf-dot"
          custom={i}
          variants={dotVariants}
          initial="hidden"
          animate={animate ? "show" : undefined}
        />
      ))}

      {/* Shield icon at center */}
      <motion.div
        className="pf-shield"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={
          animate ? { opacity: 1, scale: 1 } : undefined
        }
        transition={{
          delay: 0.6,
          type: "spring",
          stiffness: 200,
          damping: 18,
        }}
      >
        <GlowPulse color="rgba(14, 116, 144, 0.4)">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0E7490"
            strokeWidth="1.5"
          >
            <path d="M12 3l8 4v6c0 4.5-3.5 7.5-8 8-4.5-.5-8-3.5-8-8V7l8-4z" />
            <path
              d="M8 11.5l3 3 5-5"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </GlowPulse>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card variants                                                      */
/* ------------------------------------------------------------------ */

const cardContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const fieldVariants: Variants = {
  hidden: { opacity: 0, x: -15 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AnimatedPrivacyFlow() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.25 });

  // Check prefers-reduced-motion
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  const shouldAnimate = isInView && !reduced;

  return (
    <section className="sec pf-section" ref={sectionRef}>
      <div className="container">
        {/* Header */}
        <div className="sec-head">
          <FadeIn>
            <span className="eyebrow">Privacy by design</span>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="display-md">
              Your data stays private. Only hashed metadata goes on-chain.
            </h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p>
              MedAgent shows clinicians the full record they need — but only
              logs non-identifying hashes to Solana. No PHI ever touches the
              blockchain.
            </p>
          </FadeIn>
        </div>

        {/* Three-column grid */}
        <div className="pf-grid">
          {/* Left card — readable medical data */}
          <motion.div
            className="pf-card pf-card-left"
            variants={cardContainerVariants}
            initial="hidden"
            animate={shouldAnimate ? "show" : undefined}
          >
            <div className="pf-card-header">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M12 12v6M9 15h6" />
              </svg>
              <span>Medical Record</span>
              <span className="pf-badge pf-badge-green">Authorized</span>
            </div>
            {fields.map((f) => (
              <motion.div key={f.label} className="pf-field" variants={fieldVariants}>
                <span className="pf-label">{f.label}</span>
                <span className="pf-value">{f.readable}</span>
              </motion.div>
            ))}
            <div className="pf-card-footer">
              <span className="pf-dot-live" /> Tier 1 · Same jurisdiction
            </div>
          </motion.div>

          {/* Bridge */}
          <FlowBridge animate={shouldAnimate} />

          {/* Right card — hashed data */}
          <motion.div
            className="pf-card pf-card-right"
            initial={{ opacity: 0, x: 30 }}
            animate={
              shouldAnimate
                ? { opacity: 1, x: 0 }
                : undefined
            }
            transition={{ duration: 0.6, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="pf-card-header">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="3" y="6" width="18" height="14" rx="2" />
                <path d="M3 10h18M7 15h4" />
              </svg>
              <span>Solana Audit Log</span>
              <span className="pf-badge pf-badge-teal">On-chain</span>
            </div>
            {fields.map((f, i) => (
              <ScrambleField
                key={f.label}
                field={f}
                index={i}
                trigger={shouldAnimate}
              />
            ))}
            <div className="pf-card-footer">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              PHI-free · Hashed metadata only
            </div>
          </motion.div>
        </div>

        {/* Bottom caption */}
        <FadeIn delay={1.2}>
          <div className="pf-caption">
            <span>
              Patient data is shown to authorized clinicians only.
              Solana stores requester hash, decision, jurisdiction, and slot —
              never names, dates, or diagnoses.
            </span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
