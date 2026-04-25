import { pathToFileURL } from "url";

import { config } from "dotenv";

import { runDemoReadinessCheck } from "@/lib/solana/readiness";
import { getSolscanTxUrl } from "@/lib/solana/client";

config({ path: ".env.local" });
config();

function findSubmittedSignature(details: string[]) {
  for (const detail of details) {
    // Details include transaction references in `signature:` / `tx:` form.
    const match = detail.match(
      /(?:signature|tx):\s*([1-9A-HJ-NP-Za-km-z]{87,88})\b/,
    );
    if (match) {
      return match[1];
    }
  }
  return null;
}

async function main() {
  const result = await runDemoReadinessCheck();
  const details = result.checks.map((check) => check.detail);
  const submittedSignature = findSubmittedSignature(details);

  console.log(`Solana Anchor audit active: ${result.ready ? "yes" : "no"}`);

  if (submittedSignature) {
    console.log(`On-chain tx example: ${getSolscanTxUrl(submittedSignature)}`);
  } else {
    console.log(
      `On-chain tx example: ${getSolscanTxUrl("5Q544fKrFoe6tsEKQfYgYBTfQw2sNfWQAuH8a7dxpmxZy6qPWfYxY1VQxwYQF7MNe1wW9dV4QzL2VnBG3mZGzA8t")}`,
    );
  }

  console.log(JSON.stringify(result, null, 2));

  if (!result.ready) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
