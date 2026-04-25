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
          <h1 className="display-md">Built for the 90 seconds before the patient is in the bay.</h1>
          <p className="lead">
            MedAgent is a deterministic agent. The LLM never decides who can see what — policy does.
            Three stages, every one of them text-first.
          </p>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 24 }}>
        <div className="container">
          <div className="why">
            <div className="why-card">
              <div className="why-num">01</div>
              <h3>The record is one text away.</h3>
              <p>
                No portal. No login. No &quot;press three to speak to the on-call.&quot; iMessage your
                request and get plain-text back in seconds.
              </p>
            </div>
            <div className="why-card">
              <div className="why-num">02</div>
              <h3>The patient stays in the loop.</h3>
              <p>
                Cross-jurisdiction requests pause for patient consent on the same channel. They reply
                YES, NO, or stay silent — and the agent honours it.
              </p>
            </div>
            <div className="why-card">
              <div className="why-num">03</div>
              <h3>Every access is on a public ledger.</h3>
              <p>
                Logged on Solana via our Anchor program. Patients verify exactly who opened their
                record, when, and under what authority. PHI never goes on chain.
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
