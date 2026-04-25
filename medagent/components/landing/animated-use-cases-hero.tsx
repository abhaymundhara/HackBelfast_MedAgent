"use client";

import { FadeIn } from "@/components/landing/motion";

export function AnimatedUseCasesHero() {
  return (
    <section className="page-hero">
      <div className="container">
        <FadeIn>
          <span className="eyebrow">Use cases</span>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h1 className="display-md">
            Built for every clinician on the island.
          </h1>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="lead">
            Different roles, different urgencies, the same plain-text interface.
            From A&amp;E to paramedics to the patients themselves.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
