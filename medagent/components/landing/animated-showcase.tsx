"use client";

import { motion } from "framer-motion";
import { DashboardMock } from "@/components/landing/dashboard-mock";
import { PhoneDemo } from "@/components/landing/phone-demo";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export function AnimatedShowcase() {
  return (
    <div className="showcase-overlap">
      <motion.div
        className="showcase-overlap-dash"
        initial={{ opacity: 0, x: -60 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, ease }}
      >
        <DashboardMock />
      </motion.div>
      <motion.div
        className="showcase-overlap-phone"
        initial={{ opacity: 0, y: 80 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{
          duration: 0.8,
          delay: 0.3,
          type: "spring",
          stiffness: 100,
          damping: 20,
        }}
      >
        <PhoneDemo />
      </motion.div>
    </div>
  );
}
