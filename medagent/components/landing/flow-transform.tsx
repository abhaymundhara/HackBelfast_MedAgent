const INPUT_STREAM_A =
  "  iMessage · need full record SARAHB stroke workup  ◆  PDF · discharge-summary.pdf · post-syncope warfarin newly dx AF  ◆  iMessage · cross-border consent needed for routine review  ◆  voice memo · roadside A1 GCS 9 suspected stroke  ◆  iMessage · emergency access RTA M1 GCS 13  ◆  PDF · referral-letter.pdf · NIAS handover  ◆  ";

const INPUT_STREAM_B =
  "  break-glass requested · patient unconscious  ✦  consent YES from patient on iMessage  ✦  jurisdiction NI ↔ ROI verified  ✦  geofence: belfast city · 54.5973° N  ✦  identity check: clinician licence GMC 7384921  ✦  ";

const OUTPUT_STREAM_A =
  "  tx_signature  ⌗  4kPq9Hf3aB2nVxR7mWbNcLd1eE6fG8hJ5kY3sT9uX0w  ◆  slot 281,450,221  ◆  patient_hash  ⌗  sha256:e8b3a02f1d9c47b6a5fe3c4d1b7a8092f6c3e1a0  ◆  grant_token  ⌗  0x9f1a72e487c6b3d5f0a47b09a2e1d8c5  ◆  ttl 30 min  ◆  ";

const OUTPUT_STREAM_B =
  "  ALLOW  ▣  jur=NI↔ROI · tier=emergency  ◆  hash anchored on Solana devnet  ✦  no PHI on chain  ✦  block 281,450,221 · finalized  ✦  patient receipt sent  ▪  revoke ready · reply STOP  ✦  ";

export function FlowTransform() {
  return (
    <section className="ft-sec">
      <div className="container">
        <div className="ft-head">
          <span className="eyebrow">Don&apos;t query, just text</span>
          <h2 className="display-md">
            Messy clinical chat <span className="ft-arrow">→</span> verifiable on-chain audit.
          </h2>
          <p>
            Bubbles, PDFs, voice memos go in. Hashed, time-limited, patient-signed audit rows come
            out the other side. The agent never invents — it routes.
          </p>
        </div>

        <div className="ft-stage-curve">
          <svg
            className="ft-curve ft-curve-left"
            viewBox="0 0 400 520"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <path id="ft-path-l1" d="M 400 40 Q 60 120 60 260 Q 60 400 400 480" fill="none" />
              <path id="ft-path-l2" d="M 400 90 Q 130 170 130 260 Q 130 350 400 430" fill="none" />
            </defs>
            <text className="ft-stream ft-stream-serif">
              <textPath href="#ft-path-l1" startOffset="0%">
                {INPUT_STREAM_A.repeat(2)}
                <animate
                  attributeName="startOffset"
                  from="0%"
                  to="-100%"
                  dur="42s"
                  repeatCount="indefinite"
                />
              </textPath>
            </text>
            <text className="ft-stream ft-stream-serif ft-stream-faded">
              <textPath href="#ft-path-l2" startOffset="50%">
                {INPUT_STREAM_B.repeat(2)}
                <animate
                  attributeName="startOffset"
                  from="50%"
                  to="-50%"
                  dur="36s"
                  repeatCount="indefinite"
                />
              </textPath>
            </text>
          </svg>

          <div className="ft-core">
            <div className="ft-core-pill">
              <div className="ft-wave" aria-hidden="true">
                {Array.from({ length: 22 }).map((_, i) => (
                  <span key={i} style={{ animationDelay: `${(i % 11) * 0.07}s` }} />
                ))}
              </div>
            </div>
            <div className="ft-core-label">
              <span className="ft-dot" /> agent
            </div>
          </div>

          <svg
            className="ft-curve ft-curve-right"
            viewBox="0 0 400 520"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <path id="ft-path-r1" d="M 0 60 L 400 220 L 0 380" fill="none" />
              <path id="ft-path-r2" d="M 0 130 L 400 280 L 0 460" fill="none" />
            </defs>
            <text className="ft-stream ft-stream-mono">
              <textPath href="#ft-path-r1" startOffset="100%">
                {OUTPUT_STREAM_A.repeat(2)}
                <animate
                  attributeName="startOffset"
                  from="100%"
                  to="0%"
                  dur="34s"
                  repeatCount="indefinite"
                />
              </textPath>
            </text>
            <text className="ft-stream ft-stream-mono ft-stream-faded">
              <textPath href="#ft-path-r2" startOffset="60%">
                {OUTPUT_STREAM_B.repeat(2)}
                <animate
                  attributeName="startOffset"
                  from="60%"
                  to="-40%"
                  dur="40s"
                  repeatCount="indefinite"
                />
              </textPath>
            </text>
          </svg>
        </div>

        <div className="ft-foot">
          <span>MESSY INPUT  →  AGENT  →  ENCRYPTED OUTPUT</span>
          <span className="ft-foot-status">
            <span className="ft-dot" /> NO PHI ON CHAIN
          </span>
        </div>
      </div>
    </section>
  );
}
