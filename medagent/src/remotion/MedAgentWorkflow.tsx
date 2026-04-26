import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";

type ChatMessage = {
  id: string;
  from: number;
  side: "patient" | "baymax";
  kind?: "text" | "pdf" | "receipt";
  text?: string;
  lines?: string[];
};

export type MedAgentWorkflowProps = {
  title: string;
};

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const iosFontFamily =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

const phoneWidth = 486;
const phoneHeight = 1048;
const screenInset = 16;
const screenWidth = phoneWidth - screenInset * 2;
const screenLeft = (1920 - phoneWidth) / 2 + screenInset;
const phoneTop = 16;
const screenTop = phoneTop + screenInset;

const messages: ChatMessage[] = [
  {
    id: "hello",
    from: 22,
    side: "patient",
    text: "hey baymax!",
  },
  {
    id: "intro",
    from: 58,
    side: "baymax",
    text: "hey! i'm Baymax - your secure medical assistant for cross-border care. send me your medical history PDF and i'll get you onboarded.",
  },
  {
    id: "pdf",
    from: 124,
    side: "patient",
    kind: "pdf",
  },
  {
    id: "profile",
    from: 166,
    side: "baymax",
    lines: [
      "nice to meet you, Ciara Byrne.",
      "i've read your report and set up your emergency profile.",
      "allergies: 2",
      "medications: 3",
      "conditions: 5",
    ],
  },
  {
    id: "book",
    from: 224,
    side: "patient",
    text: "Book appointment",
  },
  {
    id: "slots",
    from: 258,
    side: "baymax",
    lines: [
      "I found these Belfast appointment slots:",
      "1. Sun 26 Apr, 15:00 - Orthopaedics / MSK",
      "2. Mon 27 Apr, 10:00 - General Practice",
      "3. Mon 27 Apr, 14:00 - Emergency Medicine / A&E",
      "Reply with a number to book.",
    ],
  },
  {
    id: "three",
    from: 326,
    side: "patient",
    text: "3",
  },
  {
    id: "booked",
    from: 356,
    side: "baymax",
    lines: [
      "you're booked in!",
      "doctor: Dr. Chidi Okonkwo",
      "when: Mon 27 Apr, 14:00",
      "where: Royal Victoria Hospital, Belfast",
      "share your record for this appointment?",
    ],
  },
  {
    id: "yes",
    from: 420,
    side: "patient",
    text: "YES",
  },
  {
    id: "done",
    from: 450,
    side: "baymax",
    kind: "receipt",
    lines: [
      "done. your medical record is shared with Dr. Chidi Okonkwo.",
      "doctor link created",
      "Solana receipt: 632NPjgP...LP4nY",
      "revoke access anytime from your dashboard",
    ],
  },
  {
    id: "dashboard",
    from: 548,
    side: "baymax",
    lines: [
      "i've also updated your patient dashboard.",
      "Live record share: ACTIVE",
      "Access log: record_shared",
      "You can revoke the doctor link anytime.",
    ],
  },
];

const frameFor = (seconds: number, fps: number) => Math.round(seconds * fps);

const Background = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(circle at 24% 18%, rgba(10,132,255,0.24), transparent 28%), radial-gradient(circle at 78% 78%, rgba(20,241,149,0.16), transparent 28%), linear-gradient(135deg, #06111b 0%, #0d1420 45%, #111111 100%)",
      fontFamily: iosFontFamily,
    }}
  />
);

const IPhoneShell = ({ children }: { children: ReactNode }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: (1920 - phoneWidth) / 2,
        top: phoneTop,
        width: phoneWidth,
        height: phoneHeight,
        borderRadius: 72,
        background: "linear-gradient(145deg, #3d4045 0%, #0b0c0f 42%, #1d1f24 100%)",
        boxShadow:
          "0 48px 120px rgba(0,0,0,0.62), inset 0 0 0 2px rgba(255,255,255,0.18), inset 0 0 0 7px rgba(0,0,0,0.72)",
        padding: screenInset,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -5,
          top: 186,
          width: 5,
          height: 82,
          borderRadius: "5px 0 0 5px",
          background: "#24262b",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -5,
          top: 246,
          width: 5,
          height: 104,
          borderRadius: "0 5px 5px 0",
          background: "#24262b",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 56,
          overflow: "hidden",
          background: "#000",
          fontFamily: iosFontFamily,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const StatusBar = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: 54,
      color: "#fff",
      zIndex: 9,
      fontSize: 15,
      fontWeight: 700,
    }}
  >
    <div style={{ position: "absolute", left: 31, top: 17 }}>7:19</div>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 12,
        width: 126,
        height: 36,
        marginLeft: -63,
        borderRadius: 999,
        background: "#050505",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 22,
          top: 10,
          width: 12,
          height: 12,
          borderRadius: 999,
          background: "#111827",
          boxShadow: "0 0 0 2px #070707, inset 0 0 4px rgba(74,144,226,0.45)",
        }}
      />
    </div>
    <div style={{ position: "absolute", right: 30, top: 18, display: "flex", gap: 7 }}>
      <div style={{ display: "flex", gap: 2, alignItems: "end", height: 13 }}>
        {[5, 7, 10, 13].map((height) => (
          <div key={height} style={{ width: 3, height, borderRadius: 2, background: "#fff" }} />
        ))}
      </div>
      <div
        style={{
          width: 17,
          height: 12,
          border: "2px solid #fff",
          borderRadius: 4,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -5,
            top: 3,
            width: 2,
            height: 4,
            borderRadius: 2,
            background: "#fff",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 2,
            top: 2,
            width: 10,
            height: 4,
            borderRadius: 2,
            background: "#fff",
          }}
        />
      </div>
    </div>
  </div>
);

const ChatHeader = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 54,
      height: 82,
      zIndex: 8,
      background: "rgba(28,28,30,0.92)",
      backdropFilter: "blur(18px)",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}
  >
    <div style={{ position: "absolute", left: 17, top: 28, color: "#0a84ff", fontSize: 36 }}>
      ‹
    </div>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 9,
        width: 76,
        marginLeft: -38,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, #8e8e93, #48484a)",
          color: "#fff",
          fontSize: 20,
          fontWeight: 800,
        }}
      >
        B
      </div>
      <div
        style={{
          marginTop: 3,
          display: "flex",
          alignItems: "center",
          gap: 3,
          color: "#f5f5f7",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Baymax <span style={{ color: "rgba(245,245,247,0.42)", fontSize: 12 }}>›</span>
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        right: 20,
        top: 31,
        width: 23,
        height: 23,
        borderRadius: 999,
        border: "2px solid #0a84ff",
        color: "#0a84ff",
        display: "grid",
        placeItems: "center",
        fontSize: 15,
        fontWeight: 800,
      }}
    >
      i
    </div>
  </div>
);

const DatePill = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16, 98, 120], [0, 1, 1, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        top: 151,
        left: 0,
        right: 0,
        textAlign: "center",
        color: "rgba(235,235,245,0.52)",
        fontSize: 12,
        fontWeight: 600,
        opacity,
        zIndex: 2,
      }}
    >
      Today 7:19 AM
    </div>
  );
};

const tailStyle = (isPatient: boolean, color: string): CSSProperties => ({
  position: "absolute",
  bottom: 0,
  [isPatient ? "left" : "right"]: -5,
  width: 18,
  height: 18,
  background: color,
  borderBottomLeftRadius: isPatient ? 16 : 0,
  borderBottomRightRadius: isPatient ? 0 : 16,
});

const BubbleText = ({ message }: { message: ChatMessage }) => {
  if (message.kind === "pdf") {
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "center", width: 252 }}>
        <div
          style={{
            width: 52,
            height: 62,
            borderRadius: 8,
            background: "#f7f7f8",
            position: "relative",
            color: "#ff3b30",
            display: "grid",
            placeItems: "end center",
            paddingBottom: 8,
            fontSize: 13,
            fontWeight: 800,
            flex: "0 0 auto",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 18,
              height: 18,
              background: "linear-gradient(135deg, #f7f7f8 50%, #d1d1d6 50%)",
              borderBottomLeftRadius: 5,
            }}
          />
          PDF
        </div>
        <div>
          <div style={{ fontSize: 15, lineHeight: 1.08, fontWeight: 700 }}>
            test-patient-ciara-byrne.pdf
          </div>
          <div
            style={{
              marginTop: 4,
              color: "rgba(235,235,245,0.58)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            PDF Document • 3 KB
          </div>
        </div>
      </div>
    );
  }

  if (message.kind === "receipt" && message.lines) {
    return (
      <div style={{ width: 276 }}>
        <div style={{ marginBottom: 10 }}>{message.lines[0]}</div>
        <div style={{ display: "grid", gap: 7 }}>
          {message.lines.slice(1).map((line, index) => (
            <div key={line} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: index === 1 ? "#14f195" : "rgba(255,255,255,0.28)",
                  color: index === 1 ? "#03140b" : "#fff",
                  fontSize: 11,
                  fontWeight: 900,
                  flex: "0 0 auto",
                }}
              >
                ✓
              </div>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <>{message.lines ? message.lines.join("\n") : message.text}</>;
};

const TypingDots = ({ from }: { from: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - from;
  const opacity = interpolate(local, [0, 8, 30, 39], [0, 1, 1, 0], clamp);

  if (local < 0 || local > 39) {
    return null;
  }

  return (
    <div
      style={{
        alignSelf: "flex-end",
        marginTop: 7,
        marginRight: 8,
        width: 58,
        height: 34,
        borderRadius: 18,
        background: "#0a84ff",
        display: "flex",
        gap: 5,
        alignItems: "center",
        justifyContent: "center",
        opacity,
        position: "relative",
      }}
    >
      {[0, 1, 2].map((dot) => {
        const y = interpolate(
          Math.sin(((local + dot * 5) / fps) * Math.PI * 4),
          [-1, 1],
          [2.5, -2.5],
        );
        return (
          <div
            key={dot}
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "rgba(255,255,255,0.78)",
              transform: `translateY(${y}px)`,
            }}
          />
        );
      })}
    </div>
  );
};

const Bubble = ({ message, index }: { message: ChatMessage; index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - message.from;
  const intro = spring({
    frame: local,
    fps,
    config: { damping: 200 },
    durationInFrames: frameFor(0.42, fps),
  });

  if (local < 0) {
    return null;
  }

  const isPatient = message.side === "patient";
  const bubbleColor = isPatient ? "#3a3a3c" : "#0a84ff";
  const maxWidth = message.kind === "receipt" ? 315 : message.kind === "pdf" ? 310 : 318;

  return (
    <div
      style={{
        alignSelf: isPatient ? "flex-start" : "flex-end",
        maxWidth,
        marginTop: index === 0 ? 0 : 8,
        padding: message.kind === "pdf" ? "10px 12px" : "9px 13px 10px",
        borderRadius: 20,
        borderBottomLeftRadius: isPatient ? 5 : 20,
        borderBottomRightRadius: isPatient ? 20 : 5,
        background: bubbleColor,
        color: "#fff",
        fontSize: message.text && message.text.length < 18 ? 20 : 16,
        lineHeight: 1.18,
        fontWeight: 500,
        letterSpacing: 0,
        whiteSpace: "pre-wrap",
        position: "relative",
        opacity: interpolate(intro, [0, 1], [0, 1], clamp),
        transform: `translateY(${interpolate(intro, [0, 1], [12, 0], clamp)}px) scale(${interpolate(
          intro,
          [0, 1],
          [0.985, 1],
          clamp,
        )})`,
      }}
    >
      <BubbleText message={message} />
      <div style={tailStyle(isPatient, bubbleColor)} />
    </div>
  );
};

const ChatTranscript = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scroll = interpolate(
    frame,
    [
      0,
      frameFor(4.7, fps),
      frameFor(8.2, fps),
      frameFor(11.9, fps),
      frameFor(15.25, fps),
      frameFor(18.4, fps),
      frameFor(21.2, fps),
    ],
    [0, 0, -208, -486, -694, -846, -970],
    { ...clamp, easing: Easing.inOut(Easing.sin) },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        top: 166,
        bottom: 294,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", transform: `translateY(${scroll}px)` }}>
        {messages.map((message, index) => (
          <div
            key={message.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: message.side === "patient" ? "flex-start" : "flex-end",
            }}
          >
            {message.side === "baymax" ? <TypingDots from={message.from - 40} /> : null}
            <Bubble message={message} index={index} />
          </div>
        ))}
      </div>
    </div>
  );
};

const Keyboard = () => {
  const keys = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["⇧", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 286,
        background: "#2c2c2e",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "11px 8px 0",
        zIndex: 7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: "#3a3a3c",
            color: "#8e8e93",
            fontSize: 22,
            fontWeight: 400,
          }}
        >
          +
        </div>
        <div
          style={{
            flex: 1,
            height: 35,
            borderRadius: 18,
            border: "1px solid #55555a",
            color: "#8e8e93",
            display: "flex",
            alignItems: "center",
            padding: "0 13px",
            fontSize: 17,
          }}
        >
          iMessage
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: "#0a84ff",
            color: "#fff",
            fontSize: 21,
            fontWeight: 800,
          }}
        >
          ↑
        </div>
      </div>
      <div style={{ display: "grid", gap: 7 }}>
        {keys.map((row, rowIndex) => (
          <div
            key={row.join("")}
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 5,
              paddingLeft: rowIndex === 1 ? 12 : 0,
              paddingRight: rowIndex === 1 ? 12 : 0,
            }}
          >
            {row.map((key) => {
              const wide = key === "⇧" || key === "⌫";
              return (
                <div
                  key={key}
                  style={{
                    width: wide ? 42 : 35,
                    height: 42,
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                    background: wide ? "#5a5a5f" : "#f2f2f7",
                    color: wide ? "#fff" : "#111",
                    fontSize: wide ? 18 : 20,
                    fontWeight: 500,
                    boxShadow: "0 1px 0 rgba(0,0,0,0.38)",
                  }}
                >
                  {key}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
        <div
          style={{
            width: 82,
            height: 42,
            borderRadius: 6,
            background: "#5a5a5f",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 15,
          }}
        >
          123
        </div>
        <div
          style={{
            flex: 1,
            height: 42,
            borderRadius: 6,
            background: "#f2f2f7",
            boxShadow: "0 1px 0 rgba(0,0,0,0.38)",
          }}
        />
        <div
          style={{
            width: 82,
            height: 42,
            borderRadius: 6,
            background: "#5a5a5f",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 15,
          }}
        >
          return
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 141,
          right: 141,
          bottom: 8,
          height: 5,
          borderRadius: 999,
          background: "#fff",
        }}
      />
    </div>
  );
};

const TapIndicator = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tapFrames = [frameFor(7.46, fps), frameFor(10.9, fps), frameFor(14.02, fps)];
  const active = tapFrames.find((tap) => frame >= tap && frame <= tap + 16);

  if (!active) {
    return null;
  }

  const local = frame - active;
  const scale = interpolate(local, [0, 16], [0.2, 1.45], clamp);
  const opacity = interpolate(local, [0, 16], [0.56, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: 20,
        bottom: 316,
        width: 45,
        height: 45,
        borderRadius: 999,
        border: "4px solid rgba(10,132,255,0.9)",
        transform: `scale(${scale})`,
        opacity,
        zIndex: 6,
      }}
    />
  );
};

const SpotlightLabels = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [frameFor(15.2, fps), frameFor(16.1, fps)], [0, 1], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: screenLeft + screenWidth + 52,
        top: screenTop + 596,
        width: 360,
        color: "#f8fafc",
        opacity,
      }}
    >
      <div style={{ fontSize: 21, fontWeight: 800, color: "#14f195", marginBottom: 10 }}>
        frontend updated
      </div>
      <div style={{ fontSize: 34, lineHeight: 1.04, fontWeight: 900, letterSpacing: 0 }}>
        Consent, share link, Solana proof, and revocation all surface in the app.
      </div>
    </div>
  );
};

const StatusDot = ({ tone }: { tone: "green" | "blue" | "amber" }) => {
  const color = tone === "green" ? "#22c55e" : tone === "blue" ? "#0a84ff" : "#f59e0b";
  return (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 18px ${color}88`,
        flex: "0 0 auto",
      }}
    />
  );
};

const AuditLogPanel = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [frameFor(13.7, fps), frameFor(14.6, fps)], [0, 1], clamp);
  const lift = interpolate(opacity, [0, 1], [22, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: 92,
        top: 548,
        width: 500,
        borderRadius: 24,
        background: "rgba(248,250,252,0.94)",
        color: "#0f172a",
        border: "1px solid rgba(148,163,184,0.32)",
        boxShadow: "0 28px 90px rgba(0,0,0,0.34)",
        overflow: "hidden",
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid #dbe3ef" }}>
        <div
          style={{
            fontSize: 13,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            color: "#64748b",
            fontWeight: 800,
          }}
        >
          Access log
        </div>
        <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 10 }}>
          <StatusDot tone="green" />
          <div style={{ fontSize: 18, fontWeight: 850 }}>Live Solana mode</div>
        </div>
        <div style={{ marginTop: 5, color: "#166534", fontSize: 14, lineHeight: 1.25 }}>
          Audit logging is configured for Solana. Non-PHI metadata only.
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 0.8fr 0.9fr",
          padding: "12px 18px",
          gap: 12,
          color: "#64748b",
          fontSize: 12,
          fontWeight: 800,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div>Time</div>
        <div>Event</div>
        <div>Decision</div>
        <div>Tx</div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 0.8fr 0.9fr",
          padding: "15px 18px 18px",
          gap: 12,
          fontSize: 13,
          alignItems: "center",
        }}
      >
        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#334155" }}>
          04/26/2026
          <br />
          07:19 UTC
        </div>
        <div style={{ fontWeight: 800 }}>record_shared</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#15803d", fontWeight: 800 }}>
          <StatusDot tone="green" /> Allowed
        </div>
        <div style={{ color: "#2563eb", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800 }}>
          632NP...LP4nY
        </div>
      </div>
    </div>
  );
};

const PatientDashboardPanel = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [frameFor(17.8, fps), frameFor(18.7, fps)], [0, 1], clamp);
  const lift = interpolate(opacity, [0, 1], [24, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        right: 84,
        top: 96,
        width: 518,
        borderRadius: 28,
        background: "rgba(255,255,255,0.94)",
        color: "#111827",
        border: "1px solid rgba(203,213,225,0.72)",
        boxShadow: "0 30px 100px rgba(0,0,0,0.36)",
        opacity,
        transform: `translateY(${lift}px)`,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "23px 25px", borderBottom: "1px solid #e5e7eb" }}>
        <div
          style={{
            color: "#94a3b8",
            fontSize: 12,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            fontWeight: 900,
          }}
        >
          Patient portal
        </div>
        <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900, letterSpacing: 0 }}>
          Patient dashboard
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.1fr", gap: 10, padding: "18px 18px 14px" }}>
        {[
          ["Total interactions", "1"],
          ["Unique doctors", "1"],
          ["Last access", "just now"],
        ].map(([label, value]) => (
          <div key={label} style={{ border: "1px solid #dbe3ef", borderRadius: 14, padding: "14px 12px" }}>
            <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 900 }}>
              {label}
            </div>
            <div style={{ marginTop: 7, fontSize: value === "just now" ? 15 : 26, fontWeight: 900 }}>
              {value}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "0 18px 20px", display: "grid", gap: 12 }}>
        <div style={{ border: "1px solid #dbe3ef", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "12px 15px", fontSize: 15, fontWeight: 850, borderBottom: "1px solid #e5e7eb" }}>
            Live record shares
          </div>
          <div style={{ padding: "13px 15px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 850 }}>
                Full medical record shared with Dr. Chidi Okonkwo
              </div>
              <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                Royal Victoria Hospital · expires in 15 min
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ borderRadius: 999, padding: "5px 9px", background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 900 }}>
                LIVE
              </span>
              <span style={{ borderRadius: 999, padding: "5px 9px", background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 900 }}>
                Revoke
              </span>
            </div>
          </div>
        </div>
        <div style={{ border: "1px solid #dbe3ef", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "12px 15px", fontSize: 15, fontWeight: 850, borderBottom: "1px solid #e5e7eb" }}>
            Interaction timeline
          </div>
          <div style={{ padding: "13px 15px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 850 }}>record_shared</div>
              <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                Fields: full_record · NI · Dr. Chidi Okonkwo
              </div>
            </div>
            <span style={{ borderRadius: 999, padding: "5px 9px", background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 900 }}>
              Verified on Solana
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MedAgentWorkflow = ({ title }: MedAgentWorkflowProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleOpacity = interpolate(frame, [0, 20, 90, 118], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ fontFamily: iosFontFamily }}>
      <Background />
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 112,
          width: 430,
          color: "#f8fafc",
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleOpacity, [0, 1], [18, 0], clamp)}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            borderRadius: 999,
            padding: "12px 16px",
            background: "rgba(10,132,255,0.16)",
            border: "1px solid rgba(10,132,255,0.34)",
            color: "#9bd0ff",
            fontSize: 21,
            fontWeight: 800,
          }}
        >
          live iMessage assistant
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 62,
            lineHeight: 0.98,
            fontWeight: 900,
            letterSpacing: 0,
          }}
        >
          {title}
        </div>
      </div>
      <IPhoneShell>
        <StatusBar />
        <ChatHeader />
        <DatePill />
        <ChatTranscript />
        <TapIndicator />
        <Keyboard />
      </IPhoneShell>
      <AuditLogPanel />
      <PatientDashboardPanel />
      <SpotlightLabels />
    </AbsoluteFill>
  );
};
