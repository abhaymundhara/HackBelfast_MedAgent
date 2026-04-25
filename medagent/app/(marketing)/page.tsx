import Link from "next/link";

import { AnimatedHero } from "@/components/landing/animated-hero";
import { AnimatedShowcase } from "@/components/landing/animated-showcase";
import { AnimatedStickyNotes } from "@/components/landing/animated-sticky-notes";
import { AnimatedWorkflow } from "@/components/landing/animated-workflow";
import { AnimatedStats } from "@/components/landing/animated-stats";
import { AnimatedIntegrations } from "@/components/landing/animated-integrations";
import { AnimatedCta } from "@/components/landing/animated-cta";
import { AnimatedStart } from "@/components/landing/animated-start";
import { AnimatedTrust } from "@/components/landing/animated-trust";
import { AnimatedPrivacyFlow } from "@/components/landing/animated-privacy-flow";

export const dynamic = "force-static";

export default function HomePage() {
  return (
    <>
      <AnimatedHero />

      <section className="showcase">
        <div className="container">
          <AnimatedShowcase />
        </div>
      </section>

      <AnimatedTrust />

      <AnimatedIntegrations />

      <AnimatedStickyNotes />

      <section className="sec wf-sec">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow">How the agent thinks</span>
            <h2 className="display-md">
              A three-stage agent for the messy bit of emergency care.
            </h2>
            <p>
              From clinician text to on-chain audit — every step deterministic,
              every decision logged.
            </p>
          </div>
          <AnimatedWorkflow />
        </div>
      </section>

      <AnimatedStats />

      <AnimatedPrivacyFlow />

      <AnimatedStart />

      <AnimatedCta />
    </>
  );
}
