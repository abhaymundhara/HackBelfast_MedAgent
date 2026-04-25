import Link from "next/link";

import { CopyNumberButton } from "@/components/landing/copy-number";
import { IntegrationsStrip } from "@/components/landing/integrations-strip";
import { QrCard } from "@/components/landing/qr-card";
import { ShowcaseOverlap } from "@/components/landing/showcase-overlap";
import { StickyNotes } from "@/components/landing/sticky-notes";
import { TextMedAgentButton } from "@/components/landing/text-medagent-button";
import { WorkflowDiagram } from "@/components/landing/workflow-diagram";
import { getMedAgentPhone } from "@/lib/contactPhone";

export const dynamic = "force-static";

const MEDAGENT_PHONE = getMedAgentPhone();
const MEDAGENT_PHONE_DISPLAY = MEDAGENT_PHONE.replace(
  /^(\+\d{2})(\d{4})(\d{6})$/,
  "$1 $2 $3",
);

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const ImsgIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20 12c0 4.4-3.6 8-8 8-1.4 0-2.8-.4-4-1l-4 1 1-3.6c-.6-1.3-1-2.8-1-4.4 0-4.4 3.6-8 8-8s8 3.6 8 8z" />
  </svg>
);

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <Link href="/how-it-works" className="pill-link">
            <span className="tag">NEW</span>
            <span>Book, consent, and revoke in the HackBelfast demo →</span>
          </Link>

          <h1 className="display">
            Belfast doctor bookings,
            <br />
            by text message.
          </h1>
          <p className="lead">
            MedAgent helps Irish travelers in Belfast find verified appointment slots, confirm a
            doctor, and share their full uploaded medical record only after explicit consent —
            revocable from the dashboard and audited on Solana without PHI on-chain.
          </p>
          <div className="hero-ctas">
            <TextMedAgentButton className="btn btn-primary btn-lg">
              Text MedAgent now
              <ArrowRight />
            </TextMedAgentButton>
            <Link className="btn btn-ghost btn-lg" href="/how-it-works">
              See how it works
            </Link>
          </div>
          <div className="hero-foot">
            <span>
              <span className="dot" />
              Live on iMessage
            </span>
            <span>
              <span className="dot dot-blue" />
              NHS booking adapter
            </span>
            <span>
              <span className="dot dot-grey" />
              No app · No login
            </span>
          </div>
        </div>
      </section>

      <section className="showcase">
        <div className="container">
          <ShowcaseOverlap />
        </div>
      </section>

      <div className="container">
        <div className="trust">
          <span className="item">Built for HackBelfast 2026</span>
          <span className="item">Belfast 2036 problem statement</span>
          <span className="item">Solana devnet</span>
          <span className="item">No PHI on chain</span>
        </div>
      </div>

      <IntegrationsStrip />

      <StickyNotes />

      <section className="sec wf-sec">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow">How the agent thinks</span>
            <h2 className="display-md">A three-stage agent for cross-border appointments.</h2>
            <p>From patient text to appointment confirmation to named-doctor record sharing.</p>
          </div>
          <WorkflowDiagram />
        </div>
      </section>

      <section className="bigstats" id="audit">
        <div className="container">
          <h2>Built for cross-border care when symptoms flare away from home.</h2>
          <div className="row">
            <div className="bigstat">
              <div className="n">30k+</div>
              <div className="l">Daily NI ↔ ROI crossings</div>
            </div>
            <div className="bigstat">
              <div className="n">&lt; 2s</div>
              <div className="l">Avg agent response time</div>
            </div>
            <div className="bigstat">
              <div className="n">100%</div>
              <div className="l">Accesses logged on-chain</div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="qr" style={{ paddingTop: 32, scrollMarginTop: 80 }}>
        <div className="container">
          <div className="start">
            <div>
              <span className="eyebrow">Start a conversation</span>
              <h3>Text MedAgent. Confirm a slot before sharing records.</h3>
              <p>
                Save the number, send a message, choose a Belfast appointment, then approve the
                full-record share for the named doctor.
              </p>

              <div className="num-display">
                <div>
                  <div className="label">MedAgent · iMessage / SMS</div>
                  <div className="number">{MEDAGENT_PHONE_DISPLAY}</div>
                </div>
              </div>

              <div className="start-actions">
                <TextMedAgentButton className="btn btn-imsg btn-lg">
                  <ImsgIcon />
                  Text MedAgent
                </TextMedAgentButton>
                <CopyNumberButton value={MEDAGENT_PHONE} className="btn btn-ghost btn-lg">
                  Copy number
                </CopyNumberButton>
              </div>
              <div className="start-fineprint">
                Demo number · HackBelfast 2026 · No PHI sent — fictional patients only
              </div>
            </div>

            <QrCard />
          </div>
        </div>
      </section>

      <section className="cta-final">
        <div className="container">
          <h2 className="display">Send a text. Book the slot. Share only when ready.</h2>
          <p>
            The whole demo runs over your phone&apos;s existing messaging app. No installs, no signup, no
            learning curve.
          </p>
          <div className="actions">
            <TextMedAgentButton className="btn btn-primary btn-lg">
              Text MedAgent
              <ArrowRight />
            </TextMedAgentButton>
            <Link className="btn btn-ghost btn-lg" href="/how-it-works">
              See how it works
            </Link>
          </div>
          <div className="foot">
            <span>iMessage · WhatsApp · SMS</span>
            <span>Solana devnet</span>
            <span>Open source</span>
          </div>
        </div>
      </section>
    </>
  );
}
