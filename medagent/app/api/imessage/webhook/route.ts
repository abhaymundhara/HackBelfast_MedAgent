import { NextResponse } from "next/server";
import { parseInbound } from "@/lib/imessage/inbound";
import {
  classifyIntent,
  stripActivationKeyword,
  type ParsedIntent,
} from "@/lib/imessage/intents";
import { resolveHandle, listHandleMappings } from "@/lib/imessage/handles";
import {
  loadConversation,
  saveConversation,
  clearActiveRequest,
} from "@/lib/imessage/conversationState";
import {
  formatOutbound,
  formatApprovalPrompt,
  formatPatientConfirmation,
  formatHelp,
  formatAskPatientId,
  formatAskApproval,
  formatAck,
  formatAppointmentShareCreated,
  formatFollowUpAnswer,
  formatSolanaProof,
} from "@/lib/imessage/outbound";
import { getBridge } from "@/lib/imessage/bridge";
import { runAccessRequest } from "@/lib/agent/runAccessRequest";
import {
  resumeApprovedRequest,
  denyApprovedRequest,
  answerFollowUpQuestion,
  answerPatientRecordQuery,
} from "@/lib/agent/medagent";
import { getDemoClinician } from "@/lib/ips/seed";
import { searchAppointmentSlots } from "@/lib/appointments/availability";
import { bookAppointmentSlot } from "@/lib/appointments/bookAppointment";
import { getPublicAppBaseUrl } from "@/lib/appUrl";
import {
  formatAppointmentConfirmation,
  formatAppointmentOptions,
} from "@/lib/appointments/formatAppointment";
import { createShareRecord } from "@/lib/sharing/createShare";
import { sendAppointmentShareLinkEmail } from "@/lib/sharing/shareEmail";
import {
  listPatientsSafe,
  getPatientSummary,
  getPatientRow,
  getAppointment,
  touchImessageUser,
  updateImessageUser,
  logMessageEvent,
  getClinicianHandleForRequest,
  type ImessageOnboardingStage,
} from "@/lib/db";
import { sha256Hash } from "@/lib/crypto";
import { solanaAuditStore } from "@/lib/solana/auditStore";
import { parseNameDobInput } from "@/lib/imessage/onboardingNlp";
import {
  isPdfAttachment,
  processMedicalReportPdfOnboarding,
} from "@/lib/imessage/medicalReportPdf";
import type { InboundAttachment } from "@/lib/imessage/inbound";
import type { ConversationState } from "@/lib/imessage/conversationState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isDebugEnabled(): boolean {
  const raw = (process.env.IMESSAGE_DEBUG ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

function debugLog(message: string, data?: unknown) {
  if (!isDebugEnabled()) return;
  if (data === undefined) {
    console.log(`[imessage/webhook] ${message}`);
    return;
  }
  console.log(`[imessage/webhook] ${message}`, data);
}

export async function POST(request: Request) {
  // 1. Auth check
  const secret = process.env.IMESSAGE_WEBHOOK_SECRET;
  if (secret) {
    const authHeader =
      request.headers.get("authorization") ??
      request.headers.get("x-webhook-secret");
    if (authHeader !== secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // 2. Parse inbound
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    debugLog("ignored invalid_json");
    return NextResponse.json({ ignored: true, reason: "invalid_json" });
  }

  const message = parseInbound(body);
  if (!message) {
    debugLog("ignored filtered inbound");
    return NextResponse.json({ ignored: true, reason: "filtered" });
  }

  const bridge = getBridge();
  const { chatGuid, handle, text, attachments, bridgeMessageGuid: messageId } = message;
  debugLog("inbound accepted", {
    handle,
    chatGuid,
    messageId,
    textPreview: text.slice(0, 200),
    attachmentCount: attachments.length,
  });
  await markInboundSeen(bridge, chatGuid);

  // Log inbound message event for correlation
  logMessageEvent({
    messageId,
    handle,
    direction: "inbound",
    eventType: "message_received",
    metadata: { textPreview: text.slice(0, 100) },
  });

  // 3. Resolve identity
  const handleMapping = resolveHandle(handle);
  let conv = loadConversation(handle);

  // Check for persona override in metadata
  let identityId = handleMapping?.identityId ?? "unknown-emergency";
  let identityKind = handleMapping?.identityKind ?? ("clinician" as const);
  let label = handleMapping?.label ?? "Unknown";

  if (conv?.metadata?.personaOverride) {
    const override = conv.metadata.personaOverride as string;
    const overrideMapping = listHandleMappings().find(
      (m) => m.identityId === override,
    );
    if (overrideMapping) {
      identityId = overrideMapping.identityId;
      identityKind = overrideMapping.identityKind;
      label = overrideMapping.label;
    }
  }

  if (!conv) {
    conv = {
      handle,
      identityId,
      identityKind,
      activeRequestId: null,
      awaiting: null,
      lastMessageAt: new Date().toISOString(),
      metadata: {},
    };
  }
  conv.lastMessageAt = new Date().toISOString();
  conv.identityId = identityId;
  conv.identityKind = identityKind;

  const imessageUser = touchImessageUser(handle);
  if (imessageUser.stage === "onboarded" && imessageUser.patientId) {
    identityId = imessageUser.patientId;
    identityKind = "patient";
    label = imessageUser.fullName ?? label;
    conv.identityId = identityId;
    conv.identityKind = identityKind;
  }
  debugLog("loaded user stage", {
    handle,
    stage: imessageUser.stage,
    awaiting: conv.awaiting,
  });
  if (!conv.awaiting) {
    if (imessageUser.stage === "awaiting_name_dob")
      conv.awaiting = "onboarding_name_dob";
    if (imessageUser.stage === "awaiting_ready_yes_no")
      conv.awaiting = "onboarding_ready_yes_no";
    if (imessageUser.stage === "awaiting_new_user_record")
      conv.awaiting = "onboarding_new_user_record";
  }

  // Activation keyword should not reset completed onboarding. It resumes current stage only.
  const activationReset = stripActivationKeyword(text);
  if (activationReset.activated && !activationReset.cleanedText) {
    debugLog("activation keyword detected", { stage: imessageUser.stage });
    if (imessageUser.stage === "onboarded") {
      await bridge.sendText({
        chatGuid,
        text: "You're already onboarded. Your emergency profile is ready for audited clinician access when needed.",
      });
    } else if (imessageUser.stage === "new") {
      await startBaymaxOnboarding(conv, handle, chatGuid, bridge);
    } else {
      await promptOnboardingStage(imessageUser.stage, chatGuid, bridge);
    }
    saveConversation(conv);
    return NextResponse.json({ ok: true });
  }

  // 4. Classify intent
  const intent = classifyIntent(text, conv.awaiting);
  debugLog("intent classified", {
    kind: intent.kind,
    awaiting: conv.awaiting,
    identityKind,
  });

  // 5. Dispatch
  try {
    if (intent.kind === "slash") {
      await handleSlashCommand(
        intent.command,
        intent.args,
        conv,
        chatGuid,
        bridge,
        messageId,
      );
    } else if (intent.kind === "approval") {
      await handleApproval(intent.decision, conv, chatGuid, bridge, messageId);
    } else if (
      identityKind === "patient" &&
      intent.kind === "patient_query"
    ) {
      await handlePatientRecordQuery(
        intent.query,
        conv,
        chatGuid,
        bridge,
      );
    } else if (
      identityKind === "patient" &&
      (intent.kind === "appointment_search" ||
        intent.kind === "appointment_slot_selection" ||
        intent.kind === "appointment_share")
    ) {
      await handlePatientAppointmentIntent(
        text,
        intent,
        conv,
        chatGuid,
        bridge,
      );
    } else if (conv.awaiting === "onboarding_name_dob") {
      await handleOnboardingNameDob(text, handle, conv, chatGuid, bridge);
    } else if (conv.awaiting === "onboarding_ready_yes_no") {
      await handleOnboardingReadyReply(text, handle, conv, chatGuid, bridge);
    } else if (conv.awaiting === "onboarding_new_user_record") {
      await handleOnboardingMedicalReportUpload(
        attachments,
        handle,
        conv,
        chatGuid,
        bridge,
      );
    } else if (
      intent.kind === "freeform_clinician" &&
      identityKind === "clinician"
    ) {
      const activation = stripActivationKeyword(text);
      const canSkipActivation = conv.awaiting === "patient_id";
      if (!activation.activated && !canSkipActivation) {
        await bridge.sendText({
          chatGuid,
          text: `Just start your message with "${activation.keyword}" and I'll jump in! For example: "${activation.keyword} I need Sarah Bennett's allergy info."`,
        });
      } else {
        const routedText = activation.activated ? activation.cleanedText : text;
        const routedIntent = classifyIntent(routedText, conv.awaiting);
        if (routedIntent.kind !== "freeform_clinician") {
          await bridge.sendText({
            chatGuid,
            text: `Hmm, I didn't quite catch that. Try starting with "${activation.keyword}" and tell me what you need — or send /help to see what I can do.`,
          });
        } else {
          await handleClinicianRequest(
            routedText,
            routedIntent,
            conv,
            chatGuid,
            bridge,
            messageId,
          );
        }
      }
    } else if (conv.awaiting === "patient_id") {
      // Treat freeform as patient ID response
      const patientHint = text.trim().toLowerCase();
      await handleClinicianRequest(
        text,
        { kind: "freeform_clinician", patientHint, emergencyMode: false },
        conv,
        chatGuid,
        bridge,
        messageId,
      );
    } else {
      // Friendly out-of-scope catch-all — redirect naturally
      await handleOutOfScope(text, conv, chatGuid, bridge);
    }
  } catch (err) {
    console.error("[webhook] dispatch error:", err);
    await bridge
      .sendText({
        chatGuid,
        text: "Oops, something went wrong on my end. Give it another go in a moment — I'll be ready!",
      })
      .catch(() => {});
  }

  saveConversation(conv);
  debugLog("conversation saved", {
    handle: conv.handle,
    awaiting: conv.awaiting,
    activeRequestId: conv.activeRequestId,
  });
  return NextResponse.json({ ok: true });
}

function normalizeName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ");
}

type PatientLookupEntry = {
  patientId: string;
  summary: NonNullable<ReturnType<typeof getPatientSummary>>;
  normalizedName: string;
  dob: string;
};

function buildPatientLookupEntries(): PatientLookupEntry[] {
  return listPatientsSafe().flatMap((candidate) => {
    const summary = getPatientSummary(candidate.patientId);
    if (!summary) return [];
    return [
      {
        patientId: candidate.patientId,
        summary,
        normalizedName: normalizeName(summary.demographics.name),
        dob: summary.demographics.dob,
      },
    ];
  });
}

function findPatientByNameDob(
  name: string,
  dob: string,
): {
  patientId: string;
  summary: ReturnType<typeof getPatientSummary>;
} | null {
  const normalizedName = normalizeName(name);
  const match = buildPatientLookupEntries().find(
    (candidate) =>
      candidate.normalizedName === normalizedName && candidate.dob === dob,
  );
  if (!match) return null;
  return { patientId: match.patientId, summary: match.summary };
}

function buildSetupPreviewMessage(input: {
  patientId: string;
  summary: NonNullable<ReturnType<typeof getPatientSummary>>;
}): string {
  const { summary } = input;
  const allergies = summary.allergies?.slice(0, 3) ?? [];
  const conditions = summary.conditions?.slice(0, 3) ?? [];

  const lines = [
    "Great, I found your medical profile.",
    `• Name: ${summary.demographics.name}`,
    `• DOB: ${summary.demographics.dob}`,
    summary.demographics.bloodType
      ? `• Blood type: ${summary.demographics.bloodType}`
      : "",
    allergies.length
      ? `• Allergies: ${allergies.map((a) => `${a.substance} (${a.severity})`).join(", ")}`
      : "• Allergies: none recorded",
    conditions.length
      ? `• Key conditions: ${conditions.map((c) => c.label).join(", ")}`
      : "• Key conditions: none recorded",
    "",
    "Ready to set up emergency sharing for cross-border care?",
    "Reply YES to continue or NO to cancel.",
  ];

  return lines.filter(Boolean).join("\n");
}

function buildNewUserSetupMessage(input: {
  name: string;
  dob: string;
}): string {
  const lines = [
    "Thanks — I’ve got your details.",
    `• Name: ${input.name}`,
    `• DOB: ${input.dob}`,
    "",
    "Would you like to set up your emergency profile now?",
    "Reply YES to continue or NO to cancel.",
  ];
  return lines.filter(Boolean).join("\n");
}

async function startBaymaxOnboarding(
  conv: ConversationState,
  handle: string,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
) {
  debugLog("start onboarding", { handle });
  conv.awaiting = "onboarding_new_user_record";
  conv.metadata.onboardingMode = "new_user";
  conv.metadata.onboardingPatientId = null;
  conv.metadata.onboardingName = null;
  conv.metadata.onboardingDob = null;
  updateImessageUser(handle, {
    stage: "awaiting_new_user_record",
    fullName: null,
    dob: null,
    patientId: null,
    onboardingRecordDraft: null,
  });
  await bridge.sendText({
    chatGuid,
    text: "hey! i'm baymax — your secure medical assistant for cross-border care on the island of ireland. everything's private and auditable on solana. why don't you send me your medical history report as a PDF and i'll get you onboarded!",
  });
}

async function markInboundSeen(
  bridge: ReturnType<typeof getBridge>,
  chatGuid: string,
) {
  try {
    const result = await bridge.markChatRead({ chatGuid });
    debugLog("mark chat read", result);
  } catch (err) {
    debugLog("mark chat read failed", err instanceof Error ? err.message : err);
  }
}

async function pulseTypingIndicator(
  bridge: ReturnType<typeof getBridge>,
  chatGuid: string,
) {
  try {
    const result = await bridge.showTypingIndicator({ chatGuid });
    debugLog("typing indicator", result);
  } catch (err) {
    debugLog("typing indicator failed", err instanceof Error ? err.message : err);
  }
}

async function handleOnboardingNameDob(
  text: string,
  handle: string,
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
) {
  debugLog("onboarding name/dob input", {
    handle,
    textPreview: text.slice(0, 200),
  });
  await pulseTypingIndicator(bridge, chatGuid);
  const parsed = await parseNameDobInput(text);
  if (!parsed) {
    debugLog("name/dob parse failed", { handle });
    await bridge.sendText({
      chatGuid,
      text: "I couldn't read that yet. Please reply with your full name and DOB (for example: Sarah Bennett 1991-08-14 or Sarah Bennett 14/08/1991).",
    });
    return;
  }

  const patient = findPatientByNameDob(parsed.name, parsed.dob);
  if (!patient?.summary) {
    debugLog("no existing profile matched; new user path", {
      handle,
      hasName: Boolean(parsed.name),
      hasDob: Boolean(parsed.dob),
    });
    conv.awaiting = "onboarding_ready_yes_no";
    conv.metadata.onboardingMode = "new_user";
    conv.metadata.onboardingName = parsed.name;
    conv.metadata.onboardingDob = parsed.dob;
    conv.metadata.onboardingPatientId = null;
    updateImessageUser(handle, {
      stage: "awaiting_ready_yes_no",
      fullName: parsed.name,
      dob: parsed.dob,
      patientId: null,
    });
    await bridge.sendText({
      chatGuid,
      text: buildNewUserSetupMessage({
        name: parsed.name,
        dob: parsed.dob,
      }),
    });
    return;
  }

  conv.awaiting = "onboarding_ready_yes_no";
  debugLog("existing profile matched", {
    handle,
    patientId: patient.patientId,
    hasName: Boolean(parsed.name),
    hasDob: Boolean(parsed.dob),
  });
  conv.metadata.onboardingMode = "existing_user";
  conv.metadata.onboardingPatientId = patient.patientId;
  conv.metadata.onboardingName = patient.summary.demographics.name;
  conv.metadata.onboardingDob = patient.summary.demographics.dob;
  updateImessageUser(handle, {
    stage: "awaiting_ready_yes_no",
    fullName: patient.summary.demographics.name,
    dob: patient.summary.demographics.dob,
    patientId: patient.patientId,
  });
  await bridge.sendText({
    chatGuid,
    text: buildSetupPreviewMessage({
      patientId: patient.patientId,
      summary: patient.summary,
    }),
  });
}

async function handleOnboardingReadyReply(
  text: string,
  handle: string,
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
) {
  const normalized = text
    .replace(/^[^\w]+/, "")
    .trim()
    .toUpperCase();
  const onboardingMode = String(
    conv.metadata.onboardingMode ?? "existing_user",
  );
  debugLog("onboarding ready reply", { handle, normalized, onboardingMode });
  if (["YES", "Y", "READY", "OK"].includes(normalized)) {
    if (onboardingMode === "new_user") {
      conv.awaiting = "onboarding_new_user_record";
      updateImessageUser(handle, {
        stage: "awaiting_new_user_record",
      });
      await bridge.sendText({
        chatGuid,
        text: "Great. Please upload your medical report PDF here in iMessage. I'll read it on this Mac, extract your emergency details, and store them in your MedAgent profile.",
      });
    } else {
      conv.awaiting = null;
      updateImessageUser(handle, {
        stage: "onboarded",
      });
      await bridge.sendText({
        chatGuid,
        text: 'Perfect. Setup is ready. To request emergency access next time, start with "hey baymax!" and describe the case.',
      });
    }
    return;
  }
  if (["NO", "N", "CANCEL"].includes(normalized)) {
    conv.awaiting = null;
    updateImessageUser(handle, {
      stage: "new",
    });
    await bridge.sendText({
      chatGuid,
      text: 'No problem. Setup cancelled. Message "hey baymax!" whenever you want to start again.',
    });
    return;
  }
  await bridge.sendText({
    chatGuid,
    text: "Just say yes to keep going, or no if you'd rather not right now.",
  });
}

async function handleOnboardingMedicalReportUpload(
  attachments: InboundAttachment[],
  handle: string,
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
) {
  const pdfAttachment = attachments.find(isPdfAttachment);
  debugLog("onboarding pdf upload input", {
    handle,
    attachmentCount: attachments.length,
    hasPdf: Boolean(pdfAttachment),
  });
  if (!pdfAttachment) {
    await bridge.sendText({
      chatGuid,
      text: "just send me your medical report as a PDF and i'll take care of the rest!",
    });
    return;
  }

  await pulseTypingIndicator(bridge, chatGuid);

  // Name/DOB from conversation metadata if available, otherwise extracted from PDF automatically
  const name =
    typeof conv.metadata.onboardingName === "string"
      ? conv.metadata.onboardingName
      : undefined;
  const dob =
    typeof conv.metadata.onboardingDob === "string"
      ? conv.metadata.onboardingDob
      : undefined;

  try {
    const profile = await processMedicalReportPdfOnboarding({
      attachment: pdfAttachment,
      fullName: name,
      dob,
      handle,
    });

    conv.metadata.onboardingPatientId = profile.patientId;
    conv.metadata.onboardingRecordDraft = `pdf:${profile.documentId}`;
    conv.awaiting = null;
    conv.identityId = profile.patientId;
    conv.identityKind = "patient";
    updateImessageUser(handle, {
      stage: "onboarded",
      fullName: profile.summary.demographics.name,
      dob: profile.summary.demographics.dob,
      patientId: profile.patientId,
      onboardingRecordDraft: `pdf:${profile.documentId}`,
    });

    let onboardChainRef: string | null = null;
    try {
      const patient = getPatientRow(profile.patientId);
      const patientHash = patient?.patient_hash ?? sha256Hash(profile.patientId);
      const auditResult = await solanaAuditStore.writeAuditEvent({
        requestId: profile.patientId,
        patientId: profile.patientId,
        event: {
          event_type: "profile_created",
          request_id: profile.patientId,
          doctor_hash: "",
          patient_hash: patientHash,
          jurisdiction: "GB-NIR",
          decision: "allow",
          token_expiry: null,
          timestamp: new Date().toISOString(),
          interaction_type: "onboarding",
          summary_hash: sha256Hash(`${profile.patientId}:${profile.summary.demographics.name}`),
        },
      });
      onboardChainRef = auditResult.chainRef;
    } catch (err) {
      // Non-blocking — Solana failure doesn't break onboarding
    }

    const proofLine = formatSolanaProof({ action: "medical record", chainRef: onboardChainRef });
    const auditTrailUrl = `${getPublicAppBaseUrl()}/audit/${profile.patientId}`;
    await bridge.sendText({
      chatGuid,
      text: [
        `nice to meet you, ${profile.summary.demographics.name}! i've read your medical report and set up your emergency profile.`,
        "",
        `here's what i found:`,
        `• allergies: ${profile.summary.allergies.length}`,
        `• medications: ${profile.summary.medications.length}`,
        `• conditions: ${profile.summary.conditions.length}`,
        "",
        "you're all set! you can now ask me about your record (\"what are my allergies?\") or book a GP appointment in belfast. just text me anytime.",
        ...(proofLine ? ["", proofLine] : []),
        "",
        `your audit trail: ${auditTrailUrl}`,
      ].join("\n"),
    });
  } catch (error) {
    debugLog("pdf onboarding failed", {
      handle,
      reason: error instanceof Error ? error.message : "unknown",
    });
    const hint = error instanceof Error && error.message.includes("name and date of birth")
      ? "hmm, i couldn't find your name or date of birth in that PDF. make sure it has a line like \"Name: Ciara Byrne\" and \"Date of Birth: 1994-02-17\" and try sending it again."
      : "hmm, i couldn't pull enough medical info from that PDF. could you try a different one? a GP summary with your allergies, medications, and conditions works great.";
    await bridge.sendText({ chatGuid, text: hint });
  }
}

async function promptOnboardingStage(
  stage: ImessageOnboardingStage,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
) {
  if (stage === "awaiting_name_dob") {
    await bridge.sendText({
      chatGuid,
      text: "i just need your name and date of birth to continue — type something like: Ciara Byrne 1994-02-17",
    });
    return;
  }
  if (stage === "awaiting_ready_yes_no") {
    await bridge.sendText({
      chatGuid,
      text: "ready to keep going? just say yes or no.",
    });
    return;
  }
  if (stage === "awaiting_new_user_record") {
    await bridge.sendText({
      chatGuid,
      text: "just send me your medical report PDF and i'll get you set up!",
    });
    return;
  }

  debugLog("unknown onboarding stage", { stage, chatGuid });
  await bridge.sendText({
    chatGuid,
    text: `I couldn't determine your setup step (${stage}). Reply "hey baymax!" to continue onboarding.`,
  });
}

async function handleSlashCommand(
  command: string,
  args: string[],
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
  messageId: string,
) {
  switch (command) {
    case "help":
      await bridge.sendText({ chatGuid, text: formatHelp() });
      break;
    case "persona": {
      if (args[0] === "reset") {
        delete conv.metadata.personaOverride;
        await bridge.sendText({ chatGuid, text: "Persona reset to default." });
      } else if (args[0]) {
        conv.metadata.personaOverride = args[0];
        await bridge.sendText({
          chatGuid,
          text: `Persona set to ${args[0]}. Reply /persona reset to clear.`,
        });
      }
      break;
    }
    case "access": {
      if (!args[0]) {
        conv.awaiting = "patient_id";
        await bridge.sendText({ chatGuid, text: formatAskPatientId() });
        return;
      }
      await handleClinicianRequest(
        `Access request for patient ${args[0]}`,
        {
          kind: "freeform_clinician",
          patientHint: args[0],
          emergencyMode: false,
        },
        conv,
        chatGuid,
        bridge,
        messageId,
      );
      break;
    }
    case "approve":
      await handleApproval("approve", conv, chatGuid, bridge, messageId);
      break;
    case "deny":
      await handleApproval("deny", conv, chatGuid, bridge, messageId);
      break;
    case "status":
      await bridge.sendText({
        chatGuid,
        text: conv.activeRequestId
          ? `Active request: ${conv.activeRequestId}`
          : "No active request.",
      });
      break;
    case "end":
      clearActiveRequest(conv.handle);
      conv.activeRequestId = null;
      conv.awaiting = null;
      await bridge.sendText({ chatGuid, text: "Session ended." });
      break;
    case "audit": {
      const appUrl = getPublicAppBaseUrl();
      const patientId = args[0]?.toLowerCase() ?? "sarah-bennett";
      await bridge.sendText({
        chatGuid,
        text: `View audit log: ${appUrl}/audit/${patientId}`,
      });
      break;
    }
    default:
      await bridge.sendText({
        chatGuid,
        text: `I don't know that one! Send /help to see what I can do, or just tell me what you need in plain English.`,
      });
  }
}

async function handleApproval(
  decision: "approve" | "deny",
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
  messageId: string,
) {
  if (!conv.activeRequestId) {
    await bridge.sendText({
      chatGuid,
      text: "No pending approval to respond to.",
    });
    return;
  }

  logMessageEvent({
    messageId,
    handle: conv.handle,
    direction: "inbound",
    linkedRequestId: conv.activeRequestId,
    eventType: `approval_${decision}`,
  });

  try {
    if (decision === "approve") {
      const outcome = await resumeApprovedRequest(conv.activeRequestId);

      // Send grant to the clinician (find their handle from DB)
      const clinicianInfo = getClinicianHandleForRequest(
        conv.activeRequestId,
      );
      if (clinicianInfo) {
        const messages = formatOutbound({ outcome, identityKind: "clinician" });
        for (const msg of messages) {
          await bridge.sendText({
            chatGuid: clinicianInfo.chatGuid,
            text: msg,
          });
        }
        // Log outbound to clinician
        logMessageEvent({
          messageId,
          handle: clinicianInfo.handle,
          direction: "outbound",
          linkedRequestId: conv.activeRequestId,
          linkedChainRef: outcome.auditLog?.chainRef,
          eventType: "approval_grant_sent_to_clinician",
        });
        // Update clinician conversation state
        const clinicianConv = loadConversation(clinicianInfo.handle);
        if (clinicianConv) {
          clinicianConv.activeRequestId = null;
          clinicianConv.awaiting = null;
          saveConversation(clinicianConv);
        }
      }

      // Confirm to patient
      const appUrl = getPublicAppBaseUrl();
      const requesterLabel =
        outcome.verification?.requesterLabel ?? "The clinician";
      const ttlMinutes = Math.round(outcome.ttlSeconds / 60);
      await bridge.sendText({
        chatGuid,
        text: formatPatientConfirmation({
          requesterLabel,
          ttlMinutes,
          patientId: outcome.patientId,
          appBaseUrl: appUrl,
        }),
      });
    } else {
      await denyApprovedRequest(conv.activeRequestId);
      await bridge.sendText({
        chatGuid,
        text: "Approval denied. No data was released.",
      });

      // Notify clinician
      const deniedClinicianInfo = getClinicianHandleForRequest(
        conv.activeRequestId,
      );
      if (deniedClinicianInfo) {
        await bridge.sendText({
          chatGuid: deniedClinicianInfo.chatGuid,
          text: "✗ MedAgent · Patient DENIED your access request.\n\nNo data was released. If this is a life-threatening emergency, reply BREAK GLASS.",
        });
        logMessageEvent({
          messageId,
          handle: deniedClinicianInfo.handle,
          direction: "outbound",
          linkedRequestId: conv.activeRequestId,
          eventType: "approval_deny_sent_to_clinician",
        });
      }
    }
  } catch (err) {
    console.error("[webhook] approval error:", err);
    await bridge.sendText({
      chatGuid,
      text: "Error processing approval. Please try again.",
    });
  }

  conv.activeRequestId = null;
  conv.awaiting = null;
}

function getStringArrayMetadata(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function handlePatientAppointmentIntent(
  rawText: string,
  intent: Extract<
    ParsedIntent,
    | { kind: "appointment_search" }
    | { kind: "appointment_slot_selection" }
    | { kind: "appointment_share" }
  >,
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
) {
  const patientId = conv.identityId;
  if (!patientId || conv.identityKind !== "patient") {
    await bridge.sendText({
      chatGuid,
      text: "I'd love to help with that! Let's get your profile set up first though — say \"hey baymax!\" to start.",
    });
    return;
  }

  if (intent.kind === "appointment_search") {
    const candidates = searchAppointmentSlots({
      patientId,
      location: "Belfast",
      reason: rawText,
      requestedDate: intent.requestedDate ?? undefined,
    });
    conv.awaiting = "appointment_slot_selection";
    conv.metadata.appointmentCandidates = candidates.map((candidate) => candidate.id);
    conv.metadata.appointmentReason = rawText;
    await bridge.sendText({ chatGuid, text: formatAppointmentOptions(candidates) });
    return;
  }

  if (intent.kind === "appointment_slot_selection") {
    const candidateIds = getStringArrayMetadata(conv.metadata.appointmentCandidates);
    const slotId = candidateIds[intent.selection - 1];
    if (!slotId) {
      await bridge.sendText({
        chatGuid,
        text: "I couldn't match that slot. Reply with one of the listed numbers, or send a future date in YYYY-MM-DD format.",
      });
      return;
    }
    try {
      const appointment = await bookAppointmentSlot({
        patientId,
        slotId,
        symptomSummary: String(conv.metadata.appointmentReason ?? rawText),
      });
      conv.awaiting = "appointment_share_yes_no";
      conv.metadata.pendingAppointmentId = appointment.id;
      conv.metadata.pendingShareDoctor = appointment.doctorName;
      conv.metadata.pendingShareScope = "full_record";
      await bridge.sendText({
        chatGuid,
        text: formatAppointmentConfirmation(appointment),
      });
    } catch (error) {
      await bridge.sendText({
        chatGuid,
        text:
          error instanceof Error
            ? error.message
            : "That appointment slot is no longer available.",
      });
    }
    return;
  }

  const appointmentId =
    typeof conv.metadata.pendingAppointmentId === "string"
      ? conv.metadata.pendingAppointmentId
      : "";
  const appointment = appointmentId ? getAppointment(appointmentId) : null;
  if (!appointment) {
    conv.awaiting = null;
    await bridge.sendText({
      chatGuid,
      text: "I couldn't find the confirmed appointment to share against. Please ask for appointments again.",
    });
    return;
  }

  if (intent.decision === "deny") {
    conv.awaiting = null;
    delete conv.metadata.pendingAppointmentId;
    delete conv.metadata.pendingShareDoctor;
    delete conv.metadata.pendingShareScope;
    await bridge.sendText({
      chatGuid,
      text: "Appointment stays confirmed. No medical data was shared.",
    });
    return;
  }

  const appBaseUrl =
    process.env.APP_BASE_URL?.trim().replace(/\/+$/, "") ||
    "http://localhost:3000";
  const result = await createShareRecord({
    patientId,
    doctorName: appointment.doctorName,
    doctorEmail: appointment.doctorEmail,
    fieldsToShare: [],
    ttlHours: 24,
    shareScope: "full_record",
    appointmentId: appointment.id,
  });
  const shareUrl = `${appBaseUrl}${result.shareUrl}`;
  const emailResult = await sendAppointmentShareLinkEmail({
    doctorName: appointment.doctorName,
    shareUrl,
    patientId,
  });
  if (!emailResult.sent) {
    debugLog("appointment share email not sent", {
      patientId,
      to: emailResult.to,
      error: emailResult.error,
    });
  }
  conv.awaiting = null;
  delete conv.metadata.pendingAppointmentId;
  delete conv.metadata.pendingShareDoctor;
  delete conv.metadata.pendingShareScope;
  await bridge.sendText({
    chatGuid,
    text: formatAppointmentShareCreated({
      doctorName: appointment.doctorName,
      shareUrl,
      dashboardUrl: `${appBaseUrl}/patient/dashboard`,
      chainRef: result.chainRef,
      shareId: result.shareId,
    }),
  });
}

const OUT_OF_SCOPE_RESPONSES_PATIENT = [
  "hey! that's a bit outside my wheelhouse — i'm really just set up for medical stuff. i can check your allergies, meds, conditions, or help you book a GP appointment in belfast. what do you need?",
  "haha i wish i could help with that one! i'm only really useful for medical things though — your health record, booking appointments, sharing info with a doctor. anything like that?",
  "not sure i can help there! but if you need anything medical — like \"what are my allergies?\" or \"i need an appointment for my knee\" — i'm all yours.",
  "i'm more of a medical assistant than a general one, but i'm really good at the medical stuff! ask me about your record, book an appointment, or check your meds — whatever you need.",
];

const OUT_OF_SCOPE_RESPONSES_CLINICIAN = [
  "hey — i'm set up for emergency record access and patient lookups. if you need a patient's summary, just tell me who and i'll get on it. try something like \"access patient SARAHB.\"",
  "that's a bit outside what i do! i'm here for clinical record access — patient lookups, emergency summaries, audit-trailed access. just let me know who you need.",
];

const OUT_OF_SCOPE_RESPONSES_NEW = [
  "hey! i'm medagent — i help with cross-border medical care on the island of ireland. i can store your emergency profile and help you find a GP when you're travelling. say \"hey baymax!\" to get started!",
  "hi there! i'm a secure medical assistant for travellers between ireland and northern ireland. i keep your medical info safe and help you book appointments when you need one. say \"hey baymax!\" to set things up.",
];

function pickResponse(responses: string[]): string {
  return responses[Math.floor(Math.random() * responses.length)];
}

async function handleOutOfScope(
  _text: string,
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
) {
  let response: string;

  if (conv.identityKind === "patient") {
    const imessageUser = touchImessageUser(conv.handle);
    if (imessageUser.stage === "onboarded") {
      response = pickResponse(OUT_OF_SCOPE_RESPONSES_PATIENT);
    } else {
      response = pickResponse(OUT_OF_SCOPE_RESPONSES_NEW);
    }
  } else if (conv.identityKind === "clinician") {
    response = pickResponse(OUT_OF_SCOPE_RESPONSES_CLINICIAN);
  } else {
    response = pickResponse(OUT_OF_SCOPE_RESPONSES_NEW);
  }

  await bridge.sendText({ chatGuid, text: response });
}

async function handlePatientRecordQuery(
  query: string,
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
) {
  const patientId = conv.identityId;
  if (!patientId || conv.identityKind !== "patient") {
    await bridge.sendText({
      chatGuid,
      text: "I'd love to look that up for you! Let's get your profile set up first — say \"hey baymax!\" to start.",
    });
    return;
  }

  await pulseTypingIndicator(bridge, chatGuid);

  try {
    const result = await answerPatientRecordQuery(patientId, query);
    const lines = [result.answer];
    if (result.sources.length > 0) {
      lines.push("", `Sources: ${[...new Set(result.sources)].join(", ")}`);
    }
    await bridge.sendText({ chatGuid, text: lines.join("\n") });
  } catch (err) {
    debugLog("patient query error", err instanceof Error ? err.message : err);
    await bridge.sendText({
      chatGuid,
      text: "I couldn't retrieve that information right now. Please try again.",
    });
  }
}

const PATIENT_SHORTCODES: Record<string, string> = {
  SARAHB: "sarah-bennett",
  OMARH: "omar-haddad",
  LUCIAM: "lucia-martin",
};

async function handleClinicianRequest(
  rawText: string,
  intent: {
    kind: "freeform_clinician";
    patientHint: string | null;
    emergencyMode: boolean;
  },
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
  messageId: string,
) {
  let patientId = intent.patientHint;

  // Resolve shortcodes
  if (patientId) {
    const upper = patientId.toUpperCase();
    if (PATIENT_SHORTCODES[upper]) {
      patientId = PATIENT_SHORTCODES[upper];
    }
  }

  if (!patientId) {
    conv.awaiting = "patient_id";
    await bridge.sendText({ chatGuid, text: formatAskPatientId() });
    saveConversation(conv);
    return;
  }

  conv.awaiting = null;

  // Send ack immediately
  await bridge.sendText({ chatGuid, text: formatAck() });
  await pulseTypingIndicator(bridge, chatGuid);

  // Check if this is a follow-up on an active session
  if (conv.activeRequestId && !intent.emergencyMode) {
    try {
      const answer = await answerFollowUpQuestion(
        conv.activeRequestId,
        rawText,
      );
      await bridge.sendText({
        chatGuid,
        text: formatFollowUpAnswer({
          sessionId: conv.activeRequestId,
          answer: answer.answer,
          citedFields: answer.citedFields,
        }),
      });
      saveConversation(conv);
      return;
    } catch {
      // Not a valid follow-up — treat as new request
    }
  }

  // Run the workflow asynchronously
  const requesterId = conv.identityId;

  logMessageEvent({
    messageId,
    handle: conv.handle,
    direction: "inbound",
    eventType: "access_request_initiated",
    metadata: { patientId, requesterId },
  });

  // Use setImmediate to avoid blocking — Next.js nodejs runtime keeps the process alive
  const workflowPromise = runAccessRequest({
    patientId,
    requesterId,
    naturalLanguageRequest: rawText,
    emergencyMode: intent.emergencyMode,
    sourceMessageId: messageId,
    clinicianHandle: conv.handle,
    clinicianChatGuid: chatGuid,
  });

  try {
    const outcome = await workflowPromise;
    const messages = formatOutbound({ outcome, identityKind: "clinician" });
    for (const msg of messages) {
      await bridge.sendText({ chatGuid, text: msg });
    }

    // Log outbound with chain correlation
    logMessageEvent({
      messageId,
      handle: conv.handle,
      direction: "outbound",
      linkedRequestId: outcome.requestId,
      linkedChainRef: outcome.auditLog?.chainRef,
      eventType: "access_response_sent",
      metadata: { decision: outcome.decision, tier: outcome.tier },
    });

    if (outcome.sessionId) {
      conv.activeRequestId = outcome.sessionId;
    }

    // If Tier 2 awaiting_human, send approval prompt to patient
    if (outcome.decision === "awaiting_human") {
      conv.activeRequestId = outcome.requestId;

      // Find patient handle
      const patientHandles = listHandleMappings().filter(
        (h) => h.identityId === patientId && h.identityKind === "patient",
      );
      const patientHandle = patientHandles[0];

      if (patientHandle) {
        const persona = getDemoClinician(requesterId);
        const approvalText = formatApprovalPrompt({
          requesterLabel: persona?.requesterLabel ?? requesterId,
          issuerLabel: persona?.issuerLabel ?? "Unknown",
          fieldsRequested: outcome.fieldsAllowed,
          ttlMinutes: Math.round(outcome.ttlSeconds / 60),
          requestId: outcome.requestId,
        });
        await bridge.sendText({
          chatGuid: `iMessage;-;${patientHandle.handle}`,
          text: approvalText,
        });

        // Set patient conversation state
        let patientConv = loadConversation(patientHandle.handle);
        if (!patientConv) {
          patientConv = {
            handle: patientHandle.handle,
            identityId: patientHandle.identityId,
            identityKind: "patient",
            activeRequestId: null,
            awaiting: null,
            lastMessageAt: new Date().toISOString(),
            metadata: {},
          };
        }
        patientConv.activeRequestId = outcome.requestId;
        patientConv.awaiting = "approval_yes_no";
        saveConversation(patientConv);
      }
    }

    saveConversation(conv);
  } catch (err) {
    console.error("[webhook] workflow error:", err);
    await bridge
      .sendText({
        chatGuid,
        text: "MedAgent workflow failed. Please try again.",
      })
      .catch(() => {});
  }
}
