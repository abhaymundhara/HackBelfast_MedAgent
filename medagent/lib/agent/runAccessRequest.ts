import { runMedAgentWorkflow } from "@/lib/agent/medagent";
import { getDemoClinician } from "@/lib/ips/seed";
import type { MedAgentOutcome } from "@/lib/types";

export async function runAccessRequest(input: {
  patientId: string;
  requesterId: string;
  naturalLanguageRequest: string;
  emergencyMode: boolean;
  presentedCredential?: string;
  sourceMessageId?: string;
  clinicianHandle?: string;
  clinicianChatGuid?: string;
}): Promise<MedAgentOutcome> {
  const persona = getDemoClinician(input.requesterId);
  return runMedAgentWorkflow({
    input: {
      patientId: input.patientId,
      requesterId: input.requesterId,
      naturalLanguageRequest: input.naturalLanguageRequest,
      targetLocale: persona?.locale ?? "en-GB",
      emergencyMode: input.emergencyMode,
      presentedCredential: input.presentedCredential,
      sourceMessageId: input.sourceMessageId,
    },
    clinicianHandle: input.clinicianHandle,
    clinicianChatGuid: input.clinicianChatGuid,
  });
}
