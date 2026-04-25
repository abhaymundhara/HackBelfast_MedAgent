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
} {
  const db = getDb();
  const handles = listOnboardedHandles();

  return db.transaction(() => {
    const onboardedDeleted = db
      .prepare("DELETE FROM imessage_users WHERE stage = 'onboarded'")
      .run().changes;

    let conversationsDeleted = 0;
    if (handles.length > 0) {
      const placeholders = handles.map(() => "?").join(",");
      conversationsDeleted = db
        .prepare(
          `DELETE FROM imessage_conversations WHERE handle IN (${placeholders})`,
        )
        .run(...handles).changes;
    }

    return { onboardedDeleted, conversationsDeleted };
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

  const { onboardedDeleted, conversationsDeleted } = clearOnboardedUsers();
  const after = countOnboarded();

  console.log(
    JSON.stringify(
      {
        mode: "delete",
        before,
        onboardedDeleted,
        conversationsDeleted,
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
