import { NextResponse } from "next/server";
import { parseInbound } from "@/lib/imessage/inbound";
import { classifyIntent } from "@/lib/imessage/intents";
import { resolveHandle, listHandleMappings } from "@/lib/imessage/handles";
import { loadConversation, saveConversation, clearActiveRequest } from "@/lib/imessage/conversationState";
import { formatOutbound, formatApprovalPrompt, formatPatientConfirmation, formatHelp, formatAskPatientId, formatAskApproval, formatAck, formatFollowUpAnswer } from "@/lib/imessage/outbound";
import { getBridge } from "@/lib/imessage/bridge";
import { runAccessRequest } from "@/lib/agent/runAccessRequest";
import { resumeApprovedRequest, denyApprovedRequest, answerFollowUpQuestion } from "@/lib/agent/medagent";
import { getDemoClinician } from "@/lib/ips/seed";
import type { ConversationState } from "@/lib/imessage/conversationState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 1. Auth check
  const secret = process.env.IMESSAGE_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization") ?? request.headers.get("x-webhook-secret");
    if (authHeader !== secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // 2. Parse inbound
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ignored: true, reason: "invalid_json" });
  }

  const message = parseInbound(body);
  if (!message) {
    return NextResponse.json({ ignored: true, reason: "filtered" });
  }

  const bridge = getBridge();
  const { chatGuid, handle, text } = message;

  // 3. Resolve identity
  const handleMapping = resolveHandle(handle);
  let conv = loadConversation(handle);

  // Check for persona override in metadata
  let identityId = handleMapping?.identityId ?? "unknown-emergency";
  let identityKind = handleMapping?.identityKind ?? "clinician" as const;
  let label = handleMapping?.label ?? "Unknown";

  if (conv?.metadata?.personaOverride) {
    const override = conv.metadata.personaOverride as string;
    const overrideMapping = listHandleMappings().find(m => m.identityId === override);
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

  // 4. Classify intent
  const intent = classifyIntent(text, conv.awaiting);

  // 5. Dispatch
  try {
    if (intent.kind === "slash") {
      await handleSlashCommand(intent.command, intent.args, conv, chatGuid, bridge);
    } else if (intent.kind === "approval") {
      await handleApproval(intent.decision, conv, chatGuid, bridge);
    } else if (intent.kind === "freeform_clinician" && identityKind === "clinician") {
      await handleClinicianRequest(text, intent, conv, chatGuid, bridge);
    } else if (conv.awaiting === "patient_id") {
      // Treat freeform as patient ID response
      const patientHint = text.trim().toLowerCase();
      await handleClinicianRequest(text, { kind: "freeform_clinician", patientHint, emergencyMode: false }, conv, chatGuid, bridge);
    } else {
      await bridge.sendText({ chatGuid, text: formatAskApproval() });
    }
  } catch (err) {
    console.error("[webhook] dispatch error:", err);
    await bridge.sendText({ chatGuid, text: "MedAgent encountered an error. Please try again." }).catch(() => {});
  }

  saveConversation(conv);
  return NextResponse.json({ ok: true });
}

async function handleSlashCommand(command: string, args: string[], conv: ConversationState, chatGuid: string, bridge: ReturnType<typeof getBridge>) {
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
        await bridge.sendText({ chatGuid, text: `Persona set to ${args[0]}. Reply /persona reset to clear.` });
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
        { kind: "freeform_clinician", patientHint: args[0], emergencyMode: false },
        conv, chatGuid, bridge
      );
      break;
    }
    case "approve":
      await handleApproval("approve", conv, chatGuid, bridge);
      break;
    case "deny":
      await handleApproval("deny", conv, chatGuid, bridge);
      break;
    case "status":
      await bridge.sendText({ chatGuid, text: conv.activeRequestId ? `Active request: ${conv.activeRequestId}` : "No active request." });
      break;
    case "end":
      clearActiveRequest(conv.handle);
      conv.activeRequestId = null;
      conv.awaiting = null;
      await bridge.sendText({ chatGuid, text: "Session ended." });
      break;
    case "audit": {
      const appUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
      const patientId = args[0]?.toLowerCase() ?? "sarah-bennett";
      await bridge.sendText({ chatGuid, text: `View audit log: ${appUrl}/audit/${patientId}` });
      break;
    }
    default:
      await bridge.sendText({ chatGuid, text: `Unknown command: /${command}. Reply /help for available commands.` });
  }
}

async function handleApproval(decision: "approve" | "deny", conv: ConversationState, chatGuid: string, bridge: ReturnType<typeof getBridge>) {
  if (!conv.activeRequestId) {
    await bridge.sendText({ chatGuid, text: "No pending approval to respond to." });
    return;
  }

  try {
    if (decision === "approve") {
      const outcome = await resumeApprovedRequest(conv.activeRequestId);

      // Send grant to the clinician (find their handle)
      const clinicianHandle = findClinicianHandleForRequest(conv.activeRequestId);
      if (clinicianHandle) {
        const messages = formatOutbound({ outcome, identityKind: "clinician" });
        for (const msg of messages) {
          await bridge.sendText({ chatGuid: `iMessage;-;${clinicianHandle}`, text: msg });
        }
        // Update clinician conversation state
        const clinicianConv = loadConversation(clinicianHandle);
        if (clinicianConv) {
          clinicianConv.activeRequestId = null;
          clinicianConv.awaiting = null;
          saveConversation(clinicianConv);
        }
      }

      // Confirm to patient
      const appUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
      const requesterLabel = outcome.verification?.requesterLabel ?? "The clinician";
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
      await bridge.sendText({ chatGuid, text: "Approval denied. No data was released." });

      // Notify clinician
      const clinicianHandle = findClinicianHandleForRequest(conv.activeRequestId);
      if (clinicianHandle) {
        await bridge.sendText({
          chatGuid: `iMessage;-;${clinicianHandle}`,
          text: "✗ MedAgent · Patient DENIED your access request.\n\nNo data was released. If this is a life-threatening emergency, reply BREAK GLASS.",
        });
      }
    }
  } catch (err) {
    console.error("[webhook] approval error:", err);
    await bridge.sendText({ chatGuid, text: "Error processing approval. Please try again." });
  }

  conv.activeRequestId = null;
  conv.awaiting = null;
}

// Helper to find the clinician handle associated with a request
function findClinicianHandleForRequest(_requestId: string): string | null {
  // In the demo, we look through active conversations to find the clinician
  // who initiated this request. For hackathon scope, return null and the
  // clinician notification will be skipped.
  // TODO: store clinician handle in request metadata for proper routing
  return null;
}

const PATIENT_SHORTCODES: Record<string, string> = {
  SARAHB: "sarah-bennett",
  OMARH: "omar-haddad",
  LUCIAM: "lucia-martin",
};

async function handleClinicianRequest(
  rawText: string,
  intent: { kind: "freeform_clinician"; patientHint: string | null; emergencyMode: boolean },
  conv: ConversationState,
  chatGuid: string,
  bridge: ReturnType<typeof getBridge>,
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

  // Check if this is a follow-up on an active session
  if (conv.activeRequestId && !intent.emergencyMode) {
    try {
      const answer = await answerFollowUpQuestion(conv.activeRequestId, rawText);
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

  // Use setImmediate to avoid blocking — Next.js nodejs runtime keeps the process alive
  const workflowPromise = runAccessRequest({
    patientId,
    requesterId,
    naturalLanguageRequest: rawText,
    emergencyMode: intent.emergencyMode,
  });

  try {
    const outcome = await workflowPromise;
    const messages = formatOutbound({ outcome, identityKind: "clinician" });
    for (const msg of messages) {
      await bridge.sendText({ chatGuid, text: msg });
    }

    if (outcome.sessionId) {
      conv.activeRequestId = outcome.sessionId;
    }

    // If Tier 2 awaiting_human, send approval prompt to patient
    if (outcome.decision === "awaiting_human") {
      conv.activeRequestId = outcome.requestId;

      // Find patient handle
      const patientHandles = listHandleMappings().filter(
        h => h.identityId === patientId && h.identityKind === "patient"
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
    await bridge.sendText({ chatGuid, text: "MedAgent workflow failed. Please try again." }).catch(() => {});
  }
}
