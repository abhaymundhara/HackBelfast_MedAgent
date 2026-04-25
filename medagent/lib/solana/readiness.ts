import { solanaAuditStore } from "@/lib/solana/auditStore";

export async function runDemoReadinessCheck() {
  return solanaAuditStore.readinessCheck({ dryRun: true });
}
