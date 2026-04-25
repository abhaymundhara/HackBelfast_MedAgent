"use client";

import { CountUp, GlowPulse, FadeIn } from "@/components/landing/motion";

const stats = [
  { value: 30, prefix: "", suffix: "k+", label: "Daily NI \u2194 ROI crossings" },
  { value: 2, prefix: "< ", suffix: "s", label: "Avg agent response time" },
  { value: 100, prefix: "", suffix: "%", label: "Accesses logged on-chain" },
];

export function AnimatedStats() {
  return (
    <section className="bigstats" id="audit">
      <div className="container">
        <FadeIn>
          <h2>Built for the scale of cross-border care.</h2>
        </FadeIn>
        <div className="row">
          {stats.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.15} className="bigstat">
              <GlowPulse
                color={
                  i === 0
                    ? "rgba(14,116,144,0.25)"
                    : i === 1
                      ? "rgba(37,99,235,0.2)"
                      : "rgba(34,197,94,0.2)"
                }
              >
                <div className="n">
                  <CountUp
                    to={s.value}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    duration={2}
                  />
                </div>
              </GlowPulse>
              <div className="l">{s.label}</div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
