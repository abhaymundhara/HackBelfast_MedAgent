import { spawn } from "child_process";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

function startProcess(name: string, args: string[]) {
  const child = spawn("npm", args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  child.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.log(`[imessage-live] ${name} exited (${reason})`);
  });

  return child;
}

function requireLocalBridgeMode() {
  const kind = (process.env.IMESSAGE_BRIDGE_KIND ?? "").trim().toLowerCase();
  if (kind !== "macos-local") {
    throw new Error(
      `IMESSAGE_BRIDGE_KIND must be "macos-local" for imessage:live (received "${kind || "(empty)"}").`,
    );
  }
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("imessage:live requires macOS.");
  }

  requireLocalBridgeMode();

  console.log("[imessage-live] starting Next.js dev server and iMessage poller...");
  const dev = startProcess("dev", ["run", "dev"]);
  const poller = startProcess("poller", ["run", "imessage:poll"]);
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[imessage-live] received ${signal}, shutting down...`);
    poller.kill("SIGTERM");
    dev.kill("SIGTERM");
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[imessage-live] fatal:", err);
  process.exit(1);
});
