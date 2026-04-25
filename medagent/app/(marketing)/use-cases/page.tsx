import Link from "next/link";

import { CaseTabs } from "@/components/landing/case-tabs";
import { TextMedAgentButton } from "@/components/landing/text-medagent-button";

export const metadata = {
  title: "Use cases — MedAgent",
};

export default function UseCasesPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Use cases</span>
          <h1 className="display-md">Built for every clinician on the island.</h1>
          <p className="lead">
            Different roles, different urgencies, the same plain-text interface. From A&amp;E to
            paramedics to the patients themselves.
          </p>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 24 }}>
        <div className="container">
          <CaseTabs />
        </div>
      </section>

      <section className="cta-final">
        <div className="container">
          <h2 className="display-md">Pick the role that&apos;s yours.</h2>
          <p>The interface adapts. You don&apos;t.</p>
          <div className="actions">
            <TextMedAgentButton className="btn btn-primary btn-lg">
              Text MedAgent
            </TextMedAgentButton>
            <Link className="btn btn-ghost btn-lg" href="/how-it-works">
              How it works
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
