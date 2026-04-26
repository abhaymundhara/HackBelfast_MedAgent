/** @jsxRuntime automatic */
/** @jsxImportSource @oai/artifact-tool/presentation-jsx */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  Presentation,
  PresentationFile,
  auto,
  column,
  fill,
  fixed,
  fr,
  grid,
  grow,
  hug,
  image,
  row,
  rule,
  shape,
  text,
  wrap,
} from "@oai/artifact-tool";

const W = 1920;
const H = 1080;
const OUT = "output/medagent-imessage-solana-pitch.pptx";
const RENDER_DIR = "scratch/renders";
const REPORT_DIR = "scratch/reports";
const ASSET_DIR = "scratch/assets/medagent-pitch";

const assetPaths = {
  cover: `${ASSET_DIR}/cover-imessage.png`,
  chat: `${ASSET_DIR}/imessage-chat.png`,
  workflow: `${ASSET_DIR}/workflow.png`,
  solana: `${ASSET_DIR}/solana-audit.png`,
  dashboard: `${ASSET_DIR}/dashboard.png`,
  auditPage: `${ASSET_DIR}/audit-page.png`,
};

async function dataUrl(path) {
  const bytes = await readFile(path);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

const assets = Object.fromEntries(
  await Promise.all(Object.entries(assetPaths).map(async ([key, path]) => [key, await dataUrl(path)])),
);

const C = {
  bg: "#06121B",
  bg2: "#092235",
  ink: "#F7FBFF",
  muted: "#A7B7C7",
  quiet: "#6E7F91",
  blue: "#1696FF",
  cyan: "#48C6FF",
  green: "#53E0A5",
  mint: "#C9FFE5",
  amber: "#FFCF5A",
  red: "#FF6B7A",
  line: "#1F4054",
  soft: "#102636",
  card: "#0C1B27",
  white: "#FFFFFF",
};

const font = "Avenir Next";
const fontCond = "Avenir Next Condensed";

const s = {
  eyebrow: { fontFamily: font, fontSize: 22, bold: true, color: C.green },
  title: { fontFamily: font, fontSize: 72, bold: true, color: C.ink },
  titleSmall: { fontFamily: font, fontSize: 58, bold: true, color: C.ink },
  coverTitle: { fontFamily: font, fontSize: 106, bold: true, color: C.ink },
  body: { fontFamily: font, fontSize: 30, color: C.muted },
  bodyWhite: { fontFamily: font, fontSize: 31, color: C.ink },
  label: { fontFamily: font, fontSize: 20, bold: true, color: C.quiet },
  small: { fontFamily: font, fontSize: 16, color: C.quiet },
  metric: { fontFamily: fontCond, fontSize: 108, bold: true, color: C.green },
};

function slide(presentation) {
  const sl = presentation.slides.add();
  sl.compose(shape({ name: "background", width: fill, height: fill, fill: C.bg }), {
    frame: { left: 0, top: 0, width: W, height: H },
    baseUnit: 8,
  });
  return sl;
}

function put(sl, node, frame) {
  sl.compose(node, { frame, baseUnit: 8 });
}

function txt(sl, value, frame, style, name = "text") {
  put(
    sl,
    text(value, {
      name,
      width: fill,
      height: hug,
      style,
    }),
    frame,
  );
}

function img(sl, source, frame, fit = "cover", name = "image", borderRadius = undefined) {
  const imageSource = source.startsWith("data:") ? { dataUrl: source } : { path: source };
  put(
    sl,
    image({
      name,
      ...imageSource,
      width: fill,
      height: fill,
      fit,
      alt: name,
      borderRadius,
    }),
    frame,
  );
}

function rect(sl, frame, fillColor, name = "shape", line = undefined, borderRadius = undefined) {
  put(
    sl,
    shape({
      name,
      width: fill,
      height: fill,
      fill: fillColor,
      line,
      borderRadius,
    }),
    frame,
  );
}

function footer(sl, index, label = "MedAgent pitch") {
  txt(
    sl,
    `${label} / ${String(index).padStart(2, "0")}`,
    { left: 116, top: 1016, width: 600, height: 32 },
    { ...s.small, color: "#607A8E" },
    "footer-left",
  );
  put(
    sl,
    rule({ name: "footer-rule", width: fixed(164), stroke: C.line, weight: 2 }),
    { left: 1640, top: 1030, width: 164, height: 4 },
  );
}

function titleBlock(sl, eyebrow, title, sub, index, titleWidth = 1280, subWidth = 1060) {
  txt(sl, eyebrow, { left: 116, top: 86, width: 1080, height: 36 }, s.eyebrow, "eyebrow");
  txt(sl, title, { left: 116, top: 136, width: titleWidth, height: 150 }, s.titleSmall, "slide-title");
  if (sub) {
    txt(sl, sub, { left: 116, top: 290, width: subWidth, height: 90 }, s.body, "slide-subtitle");
  }
  footer(sl, index);
}

function openNumber(sl, num, label, frame, color = C.green) {
  txt(sl, num, { left: frame.left, top: frame.top, width: frame.width, height: 120 }, { ...s.metric, color }, `metric-${num}`);
  txt(sl, label, { left: frame.left, top: frame.top + 120, width: frame.width, height: 92 }, { ...s.body, fontSize: 27 }, `metric-label-${num}`);
}

function addCover(p) {
  const sl = slide(p);
  img(sl, assets.cover, { left: 0, top: 0, width: W, height: H }, "cover", "cover-product-shot");
  rect(sl, { left: 0, top: 0, width: 760, height: H }, "#06121B", "cover-left-field");
  rect(sl, { left: 0, top: 0, width: 760, height: H }, "#06121B", "cover-left-field-2");
  txt(sl, "MedAgent", { left: 96, top: 96, width: 620, height: 120 }, s.coverTitle, "cover-title");
  txt(
    sl,
    "Emergency medical access over iMessage, with Solana-verifiable audit trails.",
    { left: 104, top: 320, width: 620, height: 160 },
    { ...s.bodyWhite, fontSize: 34 },
    "cover-promise",
  );
  put(sl, rule({ name: "cover-rule", width: fixed(210), stroke: C.green, weight: 6 }), {
    left: 104,
    top: 516,
    width: 210,
    height: 8,
  });
  txt(
    sl,
    "HackBelfast 2026 / Belfast 2036\nCross-border emergency care",
    { left: 104, top: 574, width: 520, height: 86 },
    { ...s.body, fontSize: 24, color: "#8FA6B8" },
    "cover-context",
  );
  txt(
    sl,
    "No PHI on-chain. Deterministic access. Patient-visible proof.",
    { left: 104, top: 920, width: 580, height: 56 },
    { ...s.label, fontSize: 19, color: C.green },
    "cover-footer-claim",
  );
}

function addProblem(p) {
  const sl = slide(p);
  titleBlock(
    sl,
    "WHY THIS PROBLEM",
    "Emergency care fails in the gap between systems.",
    "The need is not another portal. It is fast, narrow, auditable access when a traveler becomes a patient.",
    2,
  );
  rect(sl, { left: 116, top: 438, width: 1688, height: 2 }, C.line, "route-line");
  const items = [
    ["1", "Clinician has minutes", "A treating doctor needs allergies, meds, risks, and context before the home system can be reached."],
    ["2", "Patient may be unavailable", "Consent matters, but unconscious-patient emergencies need a narrow break-glass path."],
    ["3", "Trust crosses borders badly", "Different jurisdictions, boards, and hospitals create uncertainty around who should see what."],
  ];
  items.forEach(([n, h, b], i) => {
    const x = 120 + i * 570;
    txt(sl, n, { left: x, top: 508, width: 74, height: 78 }, { ...s.metric, fontSize: 84, color: i === 1 ? C.cyan : C.green }, `problem-num-${n}`);
    txt(sl, h, { left: x + 92, top: 520, width: 380, height: 54 }, { ...s.bodyWhite, fontSize: 34, bold: true }, `problem-head-${n}`);
    txt(sl, b, { left: x + 92, top: 594, width: 410, height: 172 }, { ...s.body, fontSize: 27 }, `problem-body-${n}`);
  });
  txt(
    sl,
    "MedAgent narrows the question: what emergency subset can be released, to this requester, for this reason, for this amount of time?",
    { left: 250, top: 826, width: 1420, height: 96 },
    { ...s.bodyWhite, fontSize: 34, bold: true },
    "problem-landing",
  );
}

function addIMessage(p) {
  const sl = slide(p);
  titleBlock(
    sl,
    "WHY iMESSAGE",
    "The crisis interface is already in hand.",
    "A demo that starts in chat feels closer to how emergency coordination actually begins: messy, immediate, and mobile.",
    3,
    720,
    650,
  );
  img(sl, assets.chat, { left: 856, top: 124, width: 940, height: 838 }, "cover", "chat-surface", "rounded-xl");
  const reasons = [
    ["No app install", "Patient onboarding, PDF upload, booking, consent, and revocation can happen from one familiar thread."],
    ["Consent is conversational", "Tier 2 approval is a plain YES/NO loop, not a hidden portal state."],
    ["Demo is visceral", "Judges can see the message arrive, the workflow run, and the receipt return."],
  ];
  reasons.forEach(([h, b], i) => {
    const y = 438 + i * 148;
    txt(sl, h, { left: 124, top: y, width: 510, height: 44 }, { ...s.bodyWhite, fontSize: 34, bold: true }, `imessage-head-${i}`);
    txt(sl, b, { left: 124, top: y + 52, width: 610, height: 78 }, { ...s.body, fontSize: 25 }, `imessage-body-${i}`);
  });
  rect(sl, { left: 116, top: 866, width: 600, height: 3 }, C.green, "imessage-rule");
}

function addWorkflow(p) {
  const sl = slide(p);
  titleBlock(sl, "THE CONCEPT", "Text in. Verified access out.", "MedAgent turns a natural-language emergency request into a policy-bound release and a visible receipt.", 4, 560, 560);
  img(sl, assets.workflow, { left: 710, top: 118, width: 1092, height: 820 }, "cover", "workflow-shot", "rounded-xl");
  const steps = [
    ["01", "Onboard", "Traveler sends a report and gets an emergency profile."],
    ["02", "Coordinate", "Belfast appointments and clinician context stay in the same thread."],
    ["03", "Consent", "The patient approves a named doctor before wider sharing."],
    ["04", "Prove", "The release returns a doctor link plus a Solana receipt."],
  ];
  steps.forEach(([n, h, b], i) => {
    const y = 426 + i * 112;
    txt(sl, n, { left: 124, top: y, width: 76, height: 42 }, { ...s.label, color: i === 2 ? C.green : C.quiet, fontSize: 28, bold: true }, `workflow-step-${n}`);
    txt(sl, h, { left: 220, top: y - 4, width: 330, height: 42 }, { ...s.bodyWhite, fontSize: 32, bold: true }, `workflow-head-${n}`);
    txt(sl, b, { left: 220, top: y + 42, width: 410, height: 56 }, { ...s.body, fontSize: 23 }, `workflow-body-${n}`);
  });
}

function addPolicy(p) {
  const sl = slide(p);
  titleBlock(
    sl,
    "WHY DETERMINISTIC POLICY",
    "The model helps with language. It never decides access.",
    "Medical authorization needs rules that can be tested, replayed, and defended.",
    5,
  );
  rect(sl, { left: 118, top: 424, width: 1686, height: 2 }, C.line, "table-top");
  const cols = [130, 430, 785, 1140, 1490];
  ["Path", "Requester condition", "Release scope", "Human role", "Audit"].forEach((h, i) => {
    txt(sl, h, { left: cols[i], top: 452, width: i === 0 ? 230 : 300, height: 38 }, { ...s.label, color: C.green, fontSize: 21 }, `policy-header-${i}`);
  });
  const rows = [
    ["Tier 1", "Verified clinician, same jurisdiction", "Emergency summary", "None", "Granted"],
    ["Tier 2", "Verified clinician, cross-jurisdiction", "Fuller summary after approval", "Patient YES", "Granted"],
    ["Tier 3", "Break-glass emergency", "Critical-only fields", "Unavailable patient", "Granted"],
    ["Denied", "No valid path", "No data released", "None", "Logged"],
  ];
  rows.forEach((r, ri) => {
    const y = 525 + ri * 104;
    rect(sl, { left: 118, top: y - 24, width: 1686, height: 1 }, ri === 0 ? C.line : "#173247", `policy-row-rule-${ri}`);
    r.forEach((cell, ci) => {
      const color = ri === 3 && ci === 0 ? C.red : ci === 0 ? C.cyan : C.ink;
      const fs = ci === 0 ? 30 : 24;
      txt(sl, cell, { left: cols[ci], top: y, width: ci === 2 ? 330 : 300, height: 66 }, { ...s.bodyWhite, fontSize: fs, bold: ci === 0, color }, `policy-cell-${ri}-${ci}`);
    });
  });
  txt(
    sl,
    "The LLM only interprets requests, translates approved content, and answers follow-up questions from the released subset.",
    { left: 190, top: 904, width: 1540, height: 72 },
    { ...s.body, fontSize: 29, color: C.mint },
    "policy-bottom",
  );
}

function addSolana(p) {
  const sl = slide(p);
  titleBlock(
    sl,
    "WHY SOLANA",
    "Solana is the receipt layer.",
    "The medical record stays off-chain. The chain proves access happened under a specific scope and decision.",
    6,
    610,
    620,
  );
  img(sl, assets.solana, { left: 808, top: 142, width: 994, height: 758 }, "cover", "solana-product-proof", "rounded-xl");
  openNumber(sl, "0", "PHI fields written on-chain", { left: 126, top: 438, width: 300, height: 240 }, C.green);
  openNumber(sl, "4", "Core demo decisions logged", { left: 430, top: 438, width: 360, height: 240 }, C.cyan);
  const points = [
    "Anchor-backed audit writes create live network evidence.",
    "Audit payloads use hashes, scope, decision, expiry, and transaction metadata.",
    "Solscan links make the proof inspectable outside MedAgent.",
  ];
  points.forEach((pnt, i) => {
    txt(sl, pnt, { left: 132, top: 716 + i * 56, width: 620, height: 48 }, { ...s.bodyWhite, fontSize: 27 }, `solana-point-${i}`);
  });
}

function addAgentic(p) {
  const sl = slide(p);
  titleBlock(
    sl,
    "WHY AGENTIC",
    "Agentic where it reduces friction. Deterministic where it controls risk.",
    "The workflow branches, pauses, resumes, and records evidence. It is not a chatbot deciding access.",
    7,
  );
  const y = 530;
  const nodes = [
    ["Natural language", "clinician or patient text", C.blue],
    ["Tool calls", "identity, patient, booking, retrieval", C.cyan],
    ["Policy gate", "tier logic outside the LLM", C.green],
    ["Authorized subset", "released vs withheld fields", C.amber],
    ["Audit receipt", "hashes, scope, tx, expiry", C.green],
  ];
  nodes.forEach(([h, b, color], i) => {
    const x = 132 + i * 342;
    rect(sl, { left: x, top: y, width: 250, height: 4 }, color, `agent-line-${i}`);
    txt(sl, h, { left: x, top: y + 40, width: 250, height: 48 }, { ...s.bodyWhite, fontSize: 31, bold: true, color }, `agent-head-${i}`);
    txt(sl, b, { left: x, top: y + 98, width: 252, height: 90 }, { ...s.body, fontSize: 23 }, `agent-body-${i}`);
    if (i < nodes.length - 1) {
      txt(sl, ">", { left: x + 272, top: y + 70, width: 44, height: 54 }, { ...s.bodyWhite, fontSize: 42, bold: true, color: C.quiet }, `agent-arrow-${i}`);
    }
  });
  txt(sl, "Tier 2 pause/resume", { left: 132, top: 812, width: 420, height: 52 }, { ...s.metric, fontSize: 54, color: C.green }, "agent-hitl");
  txt(
    sl,
    "The same request waits for patient approval, then resumes with the original request id. That is operational agent behavior the judge can see.",
    { left: 560, top: 820, width: 1050, height: 86 },
    { ...s.bodyWhite, fontSize: 30 },
    "agent-hitl-copy",
  );
}

function addDemo(p) {
  const sl = slide(p);
  titleBlock(
    sl,
    "DEMO PROOF",
    "Four scenes prove the policy, the interface, and the audit trail.",
    "Each path creates an understandable result in iMessage and a patient-visible audit event.",
    8,
  );
  const items = [
    ["Tier 1", "HSE clinician", "Same-jurisdiction verified access"],
    ["Tier 2", "NHS NI clinician", "Patient approval then release"],
    ["Tier 3", "Break glass", "Critical-only emergency access"],
    ["Denied", "Invalid path", "No data release, denial logged"],
  ];
  rect(sl, { left: 180, top: 560, width: 1560, height: 3 }, C.line, "demo-track");
  items.forEach(([h, a, b], i) => {
    const x = 170 + i * 410;
    rect(sl, { left: x, top: 528, width: 80, height: 80 }, i === 3 ? C.red : i === 2 ? C.amber : C.green, `demo-dot-${i}`, undefined, "rounded-full");
    txt(sl, String(i + 1), { left: x + 24, top: 544, width: 50, height: 48 }, { ...s.bodyWhite, fontSize: 30, bold: true, color: C.bg }, `demo-num-${i}`);
    txt(sl, h, { left: x, top: 644, width: 260, height: 48 }, { ...s.bodyWhite, fontSize: 34, bold: true, color: i === 3 ? C.red : C.ink }, `demo-head-${i}`);
    txt(sl, a, { left: x, top: 700, width: 300, height: 40 }, { ...s.label, fontSize: 20, color: C.cyan }, `demo-actor-${i}`);
    txt(sl, b, { left: x, top: 744, width: 315, height: 86 }, { ...s.body, fontSize: 24 }, `demo-body-${i}`);
  });
  txt(
    sl,
    "Pitch beat: Every access has a reason, a scope, an expiry, and a Solana receipt. PHI stays encrypted off-chain.",
    { left: 198, top: 904, width: 1490, height: 72 },
    { ...s.bodyWhite, fontSize: 31, bold: true },
    "demo-landing",
  );
}

function addMarket(p) {
  const sl = slide(p);
  titleBlock(
    sl,
    "WHY IT CAN START SMALL",
    "The first wedge is emergency summaries for travelers.",
    "That keeps the product credible: narrow scope, clear buyers, visible value, and auditable events.",
    9,
  );
  const left = [
    ["Customers", "Travelers with chronic conditions, allergies, implants, anticoagulants, or complex care plans."],
    ["Channels", "Hospital innovation teams, travel insurers, airport health networks, corporate travel programs."],
    ["Metrics", "Time to authorized summary, tier distribution, emergency sessions opened, auditor review usage."],
  ];
  left.forEach(([h, b], i) => {
    const y = 430 + i * 150;
    txt(sl, h, { left: 124, top: y, width: 280, height: 44 }, { ...s.bodyWhite, fontSize: 33, bold: true, color: i === 1 ? C.cyan : C.green }, `market-head-${i}`);
    txt(sl, b, { left: 398, top: y, width: 760, height: 86 }, { ...s.body, fontSize: 26 }, `market-body-${i}`);
  });
  rect(sl, { left: 1280, top: 408, width: 2, height: 440 }, C.line, "market-rule");
  openNumber(sl, "1,000", "travelers can map to patient-scoped audit logs without moving medical records on-chain", { left: 1336, top: 414, width: 420, height: 220 }, C.green);
  openNumber(sl, "100", "daily emergency lookups mean about 100 decision writes per day", { left: 1336, top: 666, width: 420, height: 220 }, C.cyan);
}

function addClose(p) {
  const sl = slide(p);
  img(sl, assets.dashboard, { left: 1260, top: 150, width: 540, height: 304 }, "contain", "dashboard-proof", "rounded-xl");
  img(sl, assets.solana, { left: 1260, top: 574, width: 540, height: 304 }, "cover", "solana-proof-strip", "rounded-xl");
  txt(sl, "THE CLAIM", { left: 112, top: 92, width: 400, height: 42 }, s.eyebrow, "close-eyebrow");
  txt(
    sl,
    "Emergency records should be accessible, narrow, temporary, and provable.",
    { left: 112, top: 156, width: 1040, height: 250 },
    { ...s.coverTitle, fontSize: 84 },
    "close-title",
  );
  const claims = [
    "iMessage gives the user interface a crisis-native starting point.",
    "Deterministic tiers keep access defensible.",
    "The agent workflow handles language, translation, pause/resume, and summaries.",
    "Solana provides tamper-evident proof without storing PHI.",
  ];
  claims.forEach((claim, i) => {
    txt(sl, claim, { left: 160, top: 500 + i * 80, width: 940, height: 54 }, { ...s.bodyWhite, fontSize: 31 }, `close-claim-${i}`);
    rect(sl, { left: 112, top: 512 + i * 80, width: 24, height: 24 }, i === 0 ? C.blue : C.green, `close-mark-${i}`, undefined, "rounded-full");
  });
  txt(sl, "MedAgent", { left: 112, top: 928, width: 380, height: 62 }, { ...s.metric, fontSize: 58, color: C.green }, "close-brand");
  txt(sl, "Right summary. Right clinician. Right proof.", { left: 520, top: 944, width: 760, height: 42 }, { ...s.body, fontSize: 24, color: C.mint }, "close-tagline");
}

async function saveBlob(blob, path) {
  await writeFile(path, Buffer.from(await blob.arrayBuffer()));
}

async function exportArtifacts(presentation) {
  await mkdir("output", { recursive: true });
  await mkdir(RENDER_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT);

  const report = {
    slideCount: presentation.slides.count,
    renders: [],
    layouts: [],
  };

  for (let i = 0; i < presentation.slides.count; i += 1) {
    const sl = presentation.slides.getItem(i);
    const num = String(i + 1).padStart(2, "0");
    const pngPath = `${RENDER_DIR}/slide-${num}.png`;
    const layoutPath = `${REPORT_DIR}/slide-${num}.layout.json`;
    await saveBlob(await sl.export({ format: "png" }), pngPath);
    await saveBlob(await sl.export({ format: "layout" }), layoutPath);
    report.renders.push(pngPath);
    report.layouts.push(layoutPath);
  }

  await writeFile(`${REPORT_DIR}/build-report.json`, JSON.stringify(report, null, 2));
  return report;
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });
addCover(presentation);
addProblem(presentation);
addIMessage(presentation);
addWorkflow(presentation);
addPolicy(presentation);
addSolana(presentation);
addAgentic(presentation);
addDemo(presentation);
addMarket(presentation);
addClose(presentation);

const report = await exportArtifacts(presentation);
console.log(JSON.stringify({ output: OUT, slideCount: report.slideCount, renders: report.renders }, null, 2));
