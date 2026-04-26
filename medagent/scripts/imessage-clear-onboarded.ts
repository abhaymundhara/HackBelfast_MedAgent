import { config } from "dotenv";

import { clearOnboardedImessageState } from "@/lib/imessage/clearOnboarded";

config({ path: ".env.local" });
config();

function parseDryRunArg(args: string[]): boolean {
  return args.includes("--dry-run") || args.includes("-n");
}

async function main() {
  const dryRun = parseDryRunArg(process.argv.slice(2));
  const result = clearOnboardedImessageState({ dryRun });

  console.log(
    JSON.stringify(result, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
