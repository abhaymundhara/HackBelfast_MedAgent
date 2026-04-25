const notes = [
  {
    from: "ED Reg · Belfast",
    msg: "RTA on M1, GCS 13. Need warfarin status + allergies for SARAHB.",
    time: "14:02",
  },
  {
    from: "Paramedic · Donegal",
    msg: "Cross-border transfer. Pt unconscious. Anticoagulants?",
    time: "09:47",
  },
  {
    from: "GP · Newry",
    msg: "Patient holiday in Dublin, ran out of meds. Last script?",
    time: "11:20",
  },
  {
    from: "A&E Nurse · Dublin",
    msg: "NI patient post-fall. Recent admissions in last 30 days?",
    time: "22:15",
  },
];

export function StickyNotes() {
  return (
    <section className="stickies">
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">Real requests, real conversations</span>
          <h2 className="display-md">Just text what you&apos;d say out loud.</h2>
          <p>
            No forms. No portals. The agent handles consent, jurisdiction, and audit — you handle
            the patient.
          </p>
        </div>
        <div className="stickies-grid">
          {notes.map((note) => (
            <div key={note.from} className="sticky">
              <div>
                <div className="from">{note.from}</div>
                <div className="msg">&ldquo;{note.msg}&rdquo;</div>
              </div>
              <div className="time">{note.time}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
