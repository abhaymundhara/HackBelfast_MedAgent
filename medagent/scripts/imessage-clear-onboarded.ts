import { config } from "dotenv";

import { getDb } from "@/lib/db";

config({ path: ".env.local" });
config();

type CountRow = { count: number };
type HandleRow = { handle: string };

function countOnboarded(): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count FROM imessage_users WHERE stage = 'onboarded'",
    )
    .get() as CountRow;
  return row.count;
}

function listOnboardedHandles(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT handle FROM imessage_users WHERE stage = 'onboarded'")
    .all() as HandleRow[];
  return rows.map((row) => row.handle);
}

function clearOnboardedUsers(): {
  onboardedDeleted: number;
  conversationsDeleted: number;
  appointmentsFreed: number;
} {
  const db = getDb();
  
  const users = db
    .prepare("SELECT handle, patient_id FROM imessage_users WHERE stage = 'onboarded'")
    .all() as { handle: string; patient_id: string | null }[];

  const handles = users.map((u) => u.handle);
  const patientIds = users
    .filter((u) => u.patient_id)
    .map((u) => u.patient_id as string);

  return db.transaction(() => {
    // 1. Delete onboarded users
    const onboardedDeleted = db
      .prepare("DELETE FROM imessage_users WHERE stage = 'onboarded'")
      .run().changes;

    // 2. Delete conversations
    let conversationsDeleted = 0;
    if (handles.length > 0) {
      const placeholders = handles.map(() => "?").join(",");
      conversationsDeleted = db
        .prepare(
          `DELETE FROM imessage_conversations WHERE handle IN (${placeholders})`,
        )
        .run(...handles).changes;
    }

    // 3. Free up associated appointments
    let appointmentsFreed = 0;
    if (patientIds.length > 0) {
      const pPlaceholders = patientIds.map(() => "?").join(",");
      
      const appointments = db
        .prepare(`SELECT slot_id FROM appointments WHERE patient_id IN (${pPlaceholders})`)
        .all(...patientIds) as { slot_id: string }[];
        
      const slotIds = appointments.map((a) => a.slot_id);

      if (slotIds.length > 0) {
        const sPlaceholders = slotIds.map(() => "?").join(",");
        
        appointmentsFreed = db
          .prepare(
            `UPDATE appointment_slots SET status = 'available', updated_at = ? WHERE id IN (${sPlaceholders})`,
          )
          .run(new Date().toISOString(), ...slotIds).changes;
      }

      // Also clean up these patients' appointments and patient records
      db.prepare(`DELETE FROM appointments WHERE patient_id IN (${pPlaceholders})`).run(...patientIds);
      db.prepare(`DELETE FROM patients WHERE id IN (${pPlaceholders})`).run(...patientIds);
    }

    return { onboardedDeleted, conversationsDeleted, appointmentsFreed };
  })();
}

function parseDryRunArg(args: string[]): boolean {
  return args.includes("--dry-run") || args.includes("-n");
}

async function main() {
  const dryRun = parseDryRunArg(process.argv.slice(2));
  const before = countOnboarded();

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          onboardedUsers: before,
        },
        null,
        2,
      ),
    );
    return;
  }

  const { onboardedDeleted, conversationsDeleted, appointmentsFreed } = clearOnboardedUsers();
  const after = countOnboarded();

  console.log(
    JSON.stringify(
      {
        mode: "delete",
        before,
        onboardedDeleted,
        conversationsDeleted,
        appointmentsFreed,
        after,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
