import fs from "fs";
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const fixturePath = process.argv[2];
  if (!fixturePath) {
    console.error("Usage: tsx scripts/imessage-replay.ts <fixture.json>");
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
  const webhookUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/api/imessage/webhook`;
  const secret = process.env.IMESSAGE_WEBHOOK_SECRET;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["x-webhook-secret"] = secret;

  console.log(`Replaying ${fixturePath} to ${webhookUrl}`);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  console.log(`Status: ${res.status}`);
  console.log(await res.json());
}

main().catch((err) => { console.error(err); process.exit(1); });
