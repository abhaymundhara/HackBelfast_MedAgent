import { pathToFileURL } from "url";

import { config } from "dotenv";

import { resetDatabase } from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";

config({ path: ".env.local" });
config();

async function main() {
  resetDatabase();
  await seedDemo();
  console.log("Demo state reset and reseeded.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
