export function PhoneDemo() {
  return (
    <div className="phone-col">
      <div className="phone">
        <div className="phone-screen">
          <div className="imsg-head">
            <div className="av">M</div>
            <div className="nm">MedAgent</div>
            <div className="meta">+44 7700 900099</div>
          </div>
          <div className="chat">
            <div className="ts">Today 14:02</div>
            <div className="bub from b1">Emergency access for SARAHB. RTA on M1, GCS 13.</div>
            <div className="typing">
              <span />
              <span />
              <span />
            </div>
            <div className="bub sys b2">{`✓ Access granted · 30 min

Patient: Sarah Bennett, 34, O−
Jurisdiction: NI ↔ ROI

⚠ CRITICAL
• Allergy: penicillin (anaphylaxis)
• Med: warfarin 5mg OD
• Alert: anticoagulants

Solana audit ↗ solscan/4kPq…`}</div>
            <div className="bub from b3">Recent admissions?</div>
            <div className="bub sys b4">{`Belfast City A&E · 2025-11-14
Post-syncope, cleared.
Started warfarin for newly dx AF.`}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
