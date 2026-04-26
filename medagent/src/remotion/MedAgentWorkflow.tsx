import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ReactNode } from "react";

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

const messages: ChatMessage[] = [
  {
    id: "hello",
    from: 22,
    side: "patient",
    text: "hey baymax!",
  },
  {
    id: "intro",
    from: 54,
    side: "baymax",
    text: "hey! i'm Baymax, your secure medical assistant for cross-border care on the island of Ireland. send me your medical history PDF and i'll get you onboarded.",
  },
  {
    id: "pdf",
    from: 112,
    side: "patient",
    kind: "pdf",
  },
  {
    id: "profile",
    from: 154,
    side: "baymax",
    lines: [
      "nice to meet you, Ciara Byrne.",
      "i've read your report and set up your emergency profile.",
      "allergies: 2   medications: 3   conditions: 5",
    ],
  },
  {
    id: "book",
    from: 216,
    side: "patient",
    text: "Book appointment",
  },
  {
    id: "slots",
    from: 250,
    side: "baymax",
    lines: [
      "I found Belfast appointment slots:",
      "1. Sun 26 Apr, 15:00 - Orthopaedics / MSK",
      "2. Mon 27 Apr, 10:00 - General Practice",
      "3. Mon 27 Apr, 14:00 - Emergency Medicine / A&E",
      "Reply with a number to book.",
    ],
  },
  {
    id: "three",
    from: 318,
    side: "patient",
    text: "3",
  },
  {
    id: "booked",
    from: 348,
    side: "baymax",
    lines: [
      "you're booked in with Dr. Chidi Okonkwo.",
      "Mon 27 Apr, 14:00",
      "Royal Victoria Hospital, Belfast",
      "share your emergency record for this appointment?",
    ],
  },
  {
    id: "yes",
    from: 410,
    side: "patient",
    text: "YES",
  },
  {
    id: "done",
    from: 438,
    side: "baymax",
    kind: "receipt",
    lines: [
      "done - your record is shared with Dr. Chidi Okonkwo.",
      "doctor link created",
      "Solana audit receipt stored",
      "revoke access anytime from your dashboard",
    ],
  },
];

const frameFor = (seconds: number, fps: number) => Math.round(seconds * fps);

const Shell = ({ children }: { children: ReactNode }) => {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 18% 8%, rgba(56,189,248,0.18), transparent 30%), radial-gradient(circle at 84% 24%, rgba(45,212,191,0.14), transparent 26%), linear-gradient(135deg, #071018 0%, #111827 52%, #151515 100%)",
        color: "#f8fafc",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 54,
          borderRadius: 52,
          background: "#1c1c1e",
          overflow: "hidden",
          boxShadow:
            "0 42px 120px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.10)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 116,
            background: "rgba(31,31,34,0.96)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "grid",
            gridTemplateColumns: "210px 1fr 210px",
            alignItems: "center",
            padding: "0 46px",
            zIndex: 4,
          }}
        >
          <div style={{ color: "#0a84ff", fontSize: 31, fontWeight: 650 }}>Messages</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #0a84ff, #64d2ff)",
                color: "#fff",
                fontSize: 27,
                fontWeight: 900,
              }}
            >
              B
            </div>
            <div style={{ fontSize: 21, color: "rgba(248,250,252,0.82)", fontWeight: 700 }}>
              Baymax
            </div>
          </div>
          <div style={{ justifySelf: "end", color: "#0a84ff", fontSize: 26, fontWeight: 700 }}>
            secure
          </div>
        </div>
        {children}
      </div>
    </AbsoluteFill>
  );
};

const TypingDots = ({ from }: { from: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - from;
  const opacity = interpolate(local, [0, 8, 28, 38], [0, 1, 1, 0], clamp);

  if (local < 0 || local > 38) {
    return null;
  }

  return (
    <div
      style={{
        alignSelf: "flex-start",
        display: "flex",
        gap: 8,
        padding: "18px 22px",
        borderRadius: 28,
        background: "#3a3a3c",
        opacity,
        marginLeft: 2,
      }}
    >
      {[0, 1, 2].map((dot) => {
        const y = interpolate(
          Math.sin(((local + dot * 5) / fps) * Math.PI * 4),
          [-1, 1],
          [4, -4],
        );
        return (
          <div
            key={dot}
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "rgba(255,255,255,0.72)",
              transform: `translateY(${y}px)`,
            }}
          />
        );
      })}
    </div>
  );
};

const PdfCard = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 24,
      width: 560,
      padding: 24,
    }}
  >
    <Img src={staticFile("file.svg")} style={{ width: 72, height: 72, filter: "invert(1)" }} />
    <div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>test-patient-ciara-byrne.pdf</div>
      <div style={{ marginTop: 5, color: "rgba(255,255,255,0.58)", fontSize: 22, fontWeight: 650 }}>
        PDF Document - 3 KB
      </div>
    </div>
  </div>
);

const ReceiptCard = ({ lines }: { lines: string[] }) => (
  <div style={{ padding: "26px 30px", width: 720 }}>
    <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 18 }}>{lines[0]}</div>
    <div style={{ display: "grid", gap: 12 }}>
      {lines.slice(1).map((line, index) => (
        <div
          key={line}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            fontSize: 25,
            lineHeight: 1.12,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              background: index === 1 ? "#14f195" : "rgba(255,255,255,0.22)",
              color: index === 1 ? "#07111b" : "#fff",
              fontSize: 18,
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

const Bubble = ({ message, index }: { message: ChatMessage; index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - message.from;
  const intro = spring({
    frame: local,
    fps,
    config: { damping: 200 },
    durationInFrames: frameFor(0.55, fps),
  });
  const visible = local >= 0;
  const isPatient = message.side === "patient";

  if (!visible) {
    return null;
  }

  const bubbleColor = isPatient ? "#3a3a3c" : "#0a84ff";
  const width = message.kind === "receipt" ? 760 : message.kind === "pdf" ? 610 : 760;

  return (
    <div
      style={{
        alignSelf: isPatient ? "flex-start" : "flex-end",
        maxWidth: width,
        borderRadius: 34,
        borderBottomLeftRadius: isPatient ? 10 : 34,
        borderBottomRightRadius: isPatient ? 34 : 10,
        background: bubbleColor,
        color: "#fff",
        fontSize: message.text && message.text.length < 18 ? 32 : 28,
        lineHeight: 1.16,
        fontWeight: 650,
        boxShadow: "0 16px 45px rgba(0,0,0,0.28)",
        overflow: "hidden",
        opacity: interpolate(intro, [0, 1], [0, 1], clamp),
        transform: `translateY(${interpolate(intro, [0, 1], [24, 0], clamp)}px) scale(${interpolate(
          intro,
          [0, 1],
          [0.98, 1],
          clamp,
        )})`,
        marginTop: index === 0 ? 0 : 18,
      }}
    >
      {message.kind === "pdf" ? (
        <PdfCard />
      ) : message.kind === "receipt" && message.lines ? (
        <ReceiptCard lines={message.lines} />
      ) : (
        <div style={{ padding: "22px 28px", whiteSpace: "pre-wrap" }}>
          {message.lines ? message.lines.join("\n") : message.text}
        </div>
      )}
    </div>
  );
};

const LiveMetrics = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [frameFor(12.8, fps), frameFor(13.8, fps)], [0, 1], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        bottom: 66,
        display: "flex",
        gap: 14,
        opacity,
      }}
    >
      {["Consent captured", "Doctor link active", "Audit receipt"].map((label, index) => (
        <div
          key={label}
          style={{
            borderRadius: 999,
            padding: "14px 18px",
            background: index === 2 ? "rgba(20,241,149,0.16)" : "rgba(255,255,255,0.10)",
            border: `1px solid ${index === 2 ? "rgba(20,241,149,0.42)" : "rgba(255,255,255,0.14)"}`,
            color: index === 2 ? "#9fffd1" : "rgba(248,250,252,0.88)",
            fontSize: 21,
            fontWeight: 750,
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
};

const MessageStack = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scroll = interpolate(
    frame,
    [0, frameFor(4.8, fps), frameFor(8.2, fps), frameFor(12.1, fps), frameFor(15.4, fps)],
    [0, 0, -220, -520, -790],
    { ...clamp, easing: Easing.inOut(Easing.sin) },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 86,
        right: 86,
        top: 150,
        bottom: 54,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${scroll}px)`,
        }}
      >
        {messages.map((message, index) => (
          <div
            key={message.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: message.side === "patient" ? "flex-start" : "flex-end",
            }}
          >
            {message.side === "baymax" ? <TypingDots from={message.from - 39} /> : null}
            <Bubble message={message} index={index} />
          </div>
        ))}
      </div>
    </div>
  );
};

const TapIndicator = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tapFrames = [frameFor(7.25, fps), frameFor(10.7, fps), frameFor(13.7, fps)];
  const active = tapFrames.find((tap) => frame >= tap && frame <= tap + 18);

  if (!active) {
    return null;
  }

  const local = frame - active;
  const scale = interpolate(local, [0, 18], [0.2, 1.6], clamp);
  const opacity = interpolate(local, [0, 18], [0.8, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: 132,
        bottom: 126,
        width: 54,
        height: 54,
        borderRadius: 999,
        border: "5px solid rgba(10,132,255,0.9)",
        transform: `scale(${scale})`,
        opacity,
      }}
    />
  );
};

export const MedAgentWorkflow = ({ title }: MedAgentWorkflowProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleOpacity = interpolate(frame, [0, 18, 70, 96], [0, 1, 1, 0], clamp);

  return (
    <Shell>
      <div
        style={{
          position: "absolute",
          left: 86,
          top: 150,
          zIndex: 3,
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleOpacity, [0, 1], [18, 0], clamp)}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            borderRadius: 999,
            padding: "13px 18px",
            background: "rgba(10,132,255,0.16)",
            border: "1px solid rgba(10,132,255,0.34)",
            color: "#9bd0ff",
            fontSize: 23,
            fontWeight: 800,
          }}
        >
          live iMessage assistant
        </div>
        <div
          style={{
            marginTop: 22,
            maxWidth: 840,
            fontSize: 72,
            lineHeight: 0.98,
            letterSpacing: 0,
            fontWeight: 900,
          }}
        >
          {title}
        </div>
      </div>
      <MessageStack />
      <TapIndicator />
      <LiveMetrics />
    </Shell>
  );
};
