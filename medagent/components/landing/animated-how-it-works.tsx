"use client";

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/landing/motion";

const cards = [
  {
    num: "01",
    title: "The record is one text away.",
    body: 'No portal. No login. No "press three to speak to the on-call." iMessage your request and get plain-text back in seconds.',
  },
  {
    num: "02",
    title: "The patient stays in the loop.",
    body: "Cross-jurisdiction requests pause for patient consent on the same channel. They reply YES, NO, or stay silent \u2014 and the agent honours it.",
  },
  {
    num: "03",
    title: "Every access is on a public ledger.",
    body: "Logged on Solana via our Anchor program. Patients verify exactly who opened their record, when, and under what authority. PHI never goes on chain.",
  },
];

export function AnimatedHowItWorksContent() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <FadeIn>
            <span className="eyebrow">How it works</span>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="display-md">
              Built for the 90 seconds before the patient is in the bay.
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="lead">
              MedAgent is a deterministic agent. The LLM never decides who can
              see what — policy does. Three stages, every one of them text-first.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 24 }}>
        <div className="container">
          <StaggerContainer className="why" stagger={0.15}>
            {cards.map((c) => (
              <StaggerItem key={c.num} className="why-card">
                <div className="why-num">{c.num}</div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>
    </>
  );
}
