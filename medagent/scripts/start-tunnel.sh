#!/usr/bin/env bash
# Start ngrok tunnel and launch a command with public URL env.
# Usage:
#   ./scripts/start-tunnel.sh [port]
#   ./scripts/start-tunnel.sh [port] -- npm run imessage:live

set -euo pipefail

PORT="3000"
ENV_FILE=".env.local"
if [ $# -gt 0 ] && [ "$1" != "--" ]; then
  PORT="$1"
  shift
fi

if [ $# -gt 0 ] && [ "$1" = "--" ]; then
  shift
fi

RUN_CMD=("$@")
if [ ${#RUN_CMD[@]} -eq 0 ]; then
  RUN_CMD=(npm run dev)
fi

if command -v ngrok &>/dev/null; then
  NGROK_CMD=(ngrok)
elif command -v npx &>/dev/null; then
  NGROK_CMD=(npx -y ngrok)
else
  echo "ngrok not found and npx is unavailable. Install ngrok: https://ngrok.com/download"
  exit 1
fi

# Kill any existing ngrok
pkill -f "ngrok http" 2>/dev/null || true
sleep 1

# Start ngrok in background
echo "Starting ngrok tunnel on port $PORT..."
"${NGROK_CMD[@]}" http "$PORT" --log=stdout > /dev/null &
NGROK_PID=$!
sleep 3

# Get public URL from ngrok API
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | node -e "
  let data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    const tunnels = JSON.parse(data).tunnels;
    const https = tunnels.find(t => t.proto === 'https');
    console.log(https ? https.public_url : tunnels[0]?.public_url || '');
  });
")

if [ -z "$NGROK_URL" ]; then
  echo "Failed to get ngrok URL. Check ngrok is running."
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

echo ""
echo "========================================="
echo "  ngrok tunnel: $NGROK_URL"
echo "========================================="
echo ""

export APP_BASE_URL="$NGROK_URL"
export NGROK_PUBLIC_URL="$NGROK_URL"

ENV_FILE="$ENV_FILE" APP_BASE_URL="$APP_BASE_URL" NGROK_PUBLIC_URL="$NGROK_PUBLIC_URL" node <<'NODE'
const fs = require("fs");

const envFile = process.env.ENV_FILE;
const updates = {
  APP_BASE_URL: process.env.APP_BASE_URL,
  NGROK_PUBLIC_URL: process.env.NGROK_PUBLIC_URL,
};
const existing = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
const lines = existing.split(/\r?\n/).filter((line) => line.length > 0);
const seen = new Set();
const next = lines.map((line) => {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (!match || !(match[1] in updates)) return line;
  seen.add(match[1]);
  return `${match[1]}=${updates[match[1]]}`;
});
for (const [key, value] of Object.entries(updates)) {
  if (!seen.has(key)) next.push(`${key}=${value}`);
}
fs.writeFileSync(envFile, `${next.join("\n")}\n`);
NODE

echo "Updated $ENV_FILE with APP_BASE_URL=$NGROK_URL"
echo "Starting: ${RUN_CMD[*]}"
echo ""

# Cleanup on exit
trap "kill $NGROK_PID 2>/dev/null" EXIT

"${RUN_CMD[@]}"
