"use client";

import { motion, type Variants } from "framer-motion";
import { FadeIn } from "@/components/landing/motion";

const notes = [
  {
    from: "ED Reg \u00b7 Belfast",
    msg: "RTA on M1, GCS 13. Need warfarin status + allergies for SARAHB.",
    time: "14:02",
    rotate: -1.5,
  },
  {
    from: "Paramedic \u00b7 Donegal",
    msg: "Cross-border transfer. Pt unconscious. Anticoagulants?",
    time: "09:47",
    rotate: 1,
  },
  {
    from: "GP \u00b7 Newry",
    msg: "Patient holiday in Dublin, ran out of meds. Last script?",
    time: "11:20",
    rotate: -0.5,
  },
  {
    from: "A&E Nurse \u00b7 Dublin",
    msg: "NI patient post-fall. Recent admissions in last 30 days?",
    time: "22:15",
    rotate: 1.5,
  },
];

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

export function AnimatedStickyNotes() {
  return (
    <section className="stickies">
      <div className="container">
        <div className="sec-head">
          <FadeIn>
            <span className="eyebrow">Real requests, real conversations</span>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="display-md">
              Just text what you&apos;d say out loud.
            </h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p>
              No forms. No portals. The agent handles consent, jurisdiction, and
              audit — you handle the patient.
            </p>
          </FadeIn>
        </div>
        <motion.div
          className="stickies-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {notes.map((note) => (
            <motion.div
              key={note.from}
              className="sticky"
              variants={cardVariants}
              whileHover={{
                y: -6,
                rotate: 0,
                scale: 1.03,
                transition: { duration: 0.2 },
              }}
              style={{ rotate: note.rotate }}
            >
              <div>
                <div className="from">{note.from}</div>
                <div className="msg">&ldquo;{note.msg}&rdquo;</div>
              </div>
              <div className="time">{note.time}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
