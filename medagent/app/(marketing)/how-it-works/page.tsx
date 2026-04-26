import Link from "next/link";

import { TextMedAgentButton } from "@/components/landing/text-medagent-button";
import { WorkflowDiagram } from "@/components/landing/workflow-diagram";

export const metadata = {
  title: "How it works — MedAgent",
};

export default function HowItWorksPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">How it works</span>
          <h1 className="display-md">Closing three gaps where the NHS meets the HSE.</h1>
          <p className="lead">
            Speed inside the NHS, data and login security across providers, and a bridge between the
            UK and Europe — the LLM never decides who can see what, policy does. Three stages, every
            one text-first.
          </p>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 24 }}>
        <div className="container">
          <div className="why">
            <div className="why-card">
              <div className="why-num">01</div>
              <h3>NHS speed gap.</h3>
              <p>
                Faxed referrals, on-call switchboards, &quot;press three to leave a message.&quot;
                MedAgent collapses that into a text — clinician sends, agent verifies, plain-text
                record back in seconds.
              </p>
            </div>
            <div className="why-card">
              <div className="why-num">02</div>
              <h3>Data &amp; login security.</h3>
              <p>
                No new portal, no extra password. Identity is verified against IMC / GMC registries,
                consent is collected on the same thread, and every access is hashed on Solana —
                patient-auditable forever, PHI never on chain.
              </p>
            </div>
            <div className="why-card">
              <div className="why-num">03</div>
              <h3>UK ↔ Europe record transfer.</h3>
              <p>
                Cross-border care is the breaking point. MedAgent bridges NHS and HSE so a record
                follows the patient from Belfast to Dundalk to Galway — not via a fax queue, but a
                deterministic, jurisdiction-aware text exchange.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec wf-sec">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow">The three stages</span>
            <h2 className="display-md">Request → Consent → Audit.</h2>
          </div>
          <WorkflowDiagram />
        </div>
      </section>

      <section className="cta-final">
        <div className="container">
          <h2 className="display-md">Try it live.</h2>
          <p>The whole thing runs over the messaging app already on your phone.</p>
          <div className="actions">
            <TextMedAgentButton className="btn btn-primary btn-lg">
              Text MedAgent
            </TextMedAgentButton>
            <Link className="btn btn-ghost btn-lg" href="/use-cases">
              See use cases
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
