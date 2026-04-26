import Link from "next/link";

import { AnimatedNav } from "@/components/landing/animated-nav";
import { CopyNumberButton } from "@/components/landing/copy-number";
import { QrCard } from "@/components/landing/qr-card";
import { Reveal } from "@/components/landing/reveal";
import { ShowcaseOverlap } from "@/components/landing/showcase-overlap";
import { SiteFooter } from "@/components/landing/site-footer";
import { StickyNotes } from "@/components/landing/sticky-notes";
import { TextMedAgentButton } from "@/components/landing/text-medagent-button";
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
    <div className="landing-root">
      <AnimatedNav />
      <main>
      <section className="hero">
        <div className="container">
          <Link href="/how-it-works" className="pill-link">
            <span className="tag">NEW</span>
            <span>NHS ↔ HSE — closing three gaps in one thread →</span>
          </Link>

          <span
            style={{
              display: "block",
              marginBottom: 12,
              fontSize: "clamp(30px, 4.2vw, 48px)",
              fontWeight: 600,
              letterSpacing: "0.08em",
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            MEDAGENT <span style={{ color: "#dc2626", fontWeight: 700 }}>+</span>
          </span>

          <h1 className="display" style={{ fontSize: "clamp(20px, 2.4vw, 30px)", maxWidth: 640 }}>
            Where the NHS meets HSE
          </h1>
          <p className="lead">
            Three gaps, one text message. Speed inside the NHS, data and login security across
            providers, and a bridge from the UK to Ireland so a patient&apos;s medical record can
            cross the border as fast as the patient does.
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
              No app · No login
            </span>
            <span>
              <span className="dot dot-grey" />
              Solana-audited
            </span>
          </div>
        </div>
      </section>

      <section className="showcase">
        <div className="container">
          <Reveal>
            <ShowcaseOverlap />
          </Reveal>
        </div>
      </section>

      <div className="container">
        <div className="trust">
          <span className="item">NHS speed gap</span>
          <span className="item">Data &amp; login security</span>
          <span className="item">UK to Ireland record transfer</span>
          <span className="item">Built for HackBelfast 2026</span>
        </div>
      </div>
      <StickyNotes />

      <section className="bigstats" id="audit">
        <div className="container">
          <h2>Built for the scale of cross-border care.</h2>
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
              <h3>Text MedAgent. Get a record back in seconds.</h3>
              <p>
                Save the number, send a message, watch the agent verify, route, and respond — with the
                audit row hitting Solana before you blink.
              </p>

              <div className="num-display">
                <div>
                  <div className="label">MedAgent · iMessage</div>
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
          <h2 className="display">Send a text. See what happens.</h2>
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
            <span>iMessage only</span>
            <span>Solana devnet</span>
            <span>Open source</span>
          </div>
        </div>
      </section>
      </main>
      <SiteFooter />
    </div>
  );
}
