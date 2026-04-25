"use client";

import { motion, type Variants } from "framer-motion";

const items = [
  "Built for HackBelfast 2026",
  "Belfast 2036 problem statement",
  "Solana devnet",
  "No PHI on chain",
];

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export function AnimatedTrust() {
  return (
    <div className="container">
      <motion.div
        className="trust"
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.5 }}
      >
        {items.map((label) => (
          <motion.span key={label} className="item" variants={itemVariants}>
            {label}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}
