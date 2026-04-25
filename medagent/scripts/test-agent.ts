import { pathToFileURL } from "url";

import { config } from "dotenv";

import { resumeApprovedRequest, runMedAgentWorkflow } from "@/lib/agent/medagent";
import { getApprovalByRequestId, listAuditEvents, resetDatabase, updateApprovalStatus } from "@/lib/db";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";
import { seedDemo } from "@/scripts/seed-demo";

config({ path: ".env.local" });
config();

async function runScenario(input: {
  patientId: string;
  requesterId: string;
  naturalLanguageRequest: string;
  emergencyMode: boolean;
}) {
  const persona = DEMO_CLINICIANS.find((item) => item.requesterId === input.requesterId);

  return runMedAgentWorkflow({
    input: {
      patientId: input.patientId,
      requesterId: input.requesterId,
      naturalLanguageRequest: input.naturalLanguageRequest,
      targetLocale: persona?.locale ?? "en-GB",
      emergencyMode: input.emergencyMode,
    },
  });
}

async function main() {
  resetDatabase();
  await seedDemo();

  const tier1 = await runScenario({
    patientId: "sarah-bennett",
    requesterId: DEMO_CLINICIANS[0].requesterId,
    naturalLanguageRequest: "Verified Barcelona doctor needs immediate emergency summary.",
    emergencyMode: false,
  });

  const tier2Pending = await runScenario({
    patientId: "sarah-bennett",
    requesterId: DEMO_CLINICIANS[1].requesterId,
    naturalLanguageRequest: "Need a narrower summary while patient can still approve.",
    emergencyMode: false,
  });
  const approval = getApprovalByRequestId(tier2Pending.requestId);
  if (!approval) {
    throw new Error("Tier 2 approval was not created");
  }
  updateApprovalStatus(approval.token, "approved");
  const tier2Granted = await resumeApprovedRequest(tier2Pending.requestId);

  const tier3 = await runScenario({
    patientId: "sarah-bennett",
    requesterId: DEMO_CLINICIANS[2].requesterId,
    naturalLanguageRequest: "Unknown emergency clinician requests break-glass summary.",
    emergencyMode: true,
  });

  console.log("Tier 1 outcome:", tier1.decision, tier1.tier, tier1.sessionId);
  console.log("Tier 2 pending:", tier2Pending.decision, tier2Pending.approvalToken);
  console.log("Tier 2 resumed:", tier2Granted.decision, tier2Granted.tier, tier2Granted.sessionId);
  console.log("Tier 3 outcome:", tier3.decision, tier3.tier, tier3.sessionId);

  const auditRows = listAuditEvents("sarah-bennett");
  console.log("Audit rows:", auditRows.length);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
