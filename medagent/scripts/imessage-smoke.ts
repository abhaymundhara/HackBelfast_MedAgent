import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { getBridge } from "@/lib/imessage/bridge";

async function main() {
  const args = process.argv.slice(2);
  let chatGuid = "";
  let text = "MedAgent online — smoke test.";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--chat" && args[i + 1]) chatGuid = args[++i];
    if (args[i] === "--text" && args[i + 1]) text = args[++i];
  }

  if (!chatGuid) {
    console.error("Usage: tsx scripts/imessage-smoke.ts --chat <guid> [--text <message>]");
    process.exit(1);
  }

  const bridge = getBridge();
  const health = await bridge.isHealthy();
  if (!health.healthy) {
    console.error(`Bridge unhealthy: ${health.detail}`);
    process.exit(1);
  }

  console.log(`Sending to ${chatGuid}: ${text}`);
  const result = await bridge.sendText({ chatGuid, text });
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
