"use client";

import Link from "next/link";
import { FadeIn } from "@/components/landing/motion";
import { CopyNumberButton } from "@/components/landing/copy-number";
import { QrCard } from "@/components/landing/qr-card";

const SMS_HREF = "sms:+447700900099?body=Emergency%20access%20request";

const ImsgIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20 12c0 4.4-3.6 8-8 8-1.4 0-2.8-.4-4-1l-4 1 1-3.6c-.6-1.3-1-2.8-1-4.4 0-4.4 3.6-8 8-8s8 3.6 8 8z" />
  </svg>
);

export function AnimatedStart() {
  return (
    <section className="sec" style={{ paddingTop: 32 }}>
      <div className="container">
        <div className="start">
          <div>
            <FadeIn>
              <span className="eyebrow">Start a conversation</span>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h3>Text MedAgent. Get a record back in seconds.</h3>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p>
                Save the number, send a message, watch the agent verify, route,
                and respond — with the audit row hitting Solana before you blink.
              </p>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="num-display">
                <div>
                  <div className="label">MedAgent &middot; iMessage / SMS</div>
                  <div className="number">+44 7700 900099</div>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.4}>
              <div className="start-actions">
                <Link className="btn btn-imsg btn-lg" href={SMS_HREF}>
                  <ImsgIcon />
                  Text MedAgent
                </Link>
                <CopyNumberButton
                  value="+447700900099"
                  className="btn btn-ghost btn-lg"
                >
                  Copy number
                </CopyNumberButton>
              </div>
              <div className="start-fineprint">
                Demo number &middot; HackBelfast 2026 &middot; No PHI sent —
                fictional patients only
              </div>
            </FadeIn>
          </div>

          <FadeIn direction="right" delay={0.3}>
            <QrCard />
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
