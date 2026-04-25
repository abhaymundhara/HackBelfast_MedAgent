import Link from "next/link";

import { CaseTabs } from "@/components/landing/case-tabs";

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
            <Link className="btn btn-primary btn-lg" href="sms:+447700900099?body=Emergency%20access%20request">
              Text MedAgent
            </Link>
            <Link className="btn btn-ghost btn-lg" href="/how-it-works">
              How it works
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
