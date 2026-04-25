import { spawn, type ChildProcess } from "child_process";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

function startProcess(name: string, args: string[]) {
  const child = spawn("npm", args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
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
  let shutdownExitCode = 0;
  let remainingChildren = 2;

  const markChildExit = () => {
    remainingChildren -= 1;
    if (shuttingDown && remainingChildren <= 0) {
      process.exit(shutdownExitCode);
    }
  };

  const terminateChild = (child: ChildProcess, name: string) => {
    if (child.killed) return;
    const killed = child.kill("SIGTERM");
    if (!killed) {
      console.warn(`[imessage-live] failed to SIGTERM ${name}`);
    }
  };

  const handleChildExit =
    (name: string, siblingName: string, sibling: ChildProcess) =>
    (code: number | null, signal: NodeJS.Signals | null) => {
      const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      console.log(`[imessage-live] ${name} exited (${reason})`);

      if (shuttingDown) {
        markChildExit();
        return;
      }

      const abnormalExit = signal !== null || (code !== null && code !== 0);
      if (!abnormalExit) {
        markChildExit();
        return;
      }

      const exitCode = code && code !== 0 ? code : 1;
      shuttingDown = true;
      shutdownExitCode = exitCode;
      console.error(
        `[imessage-live] ${name} failed (${reason}); terminating ${siblingName} and exiting.`,
      );
      terminateChild(sibling, siblingName);
      markChildExit();
      setTimeout(() => process.exit(exitCode), 200);
    };

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    shutdownExitCode = 0;
    console.log(`[imessage-live] received ${signal}, shutting down...`);
    terminateChild(poller, "poller");
    terminateChild(dev, "dev");
    setTimeout(() => process.exit(0), 3_000);
  };

  dev.on("exit", handleChildExit("dev", "poller", poller));
  poller.on("exit", handleChildExit("poller", "dev", dev));

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[imessage-live] fatal:", err);
  process.exit(1);
});
